// Import necessary modules
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import 'dotenv/config';

console.log('--- SERVER WITH SUPABASE STORAGE (v21.3 - FORMATTER FIX 2 + CORS OPTIONS) LOADING ---'); // Updated version note

// --- Supabase Client Setup ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.JWT_SECRET) {
    console.error('CRITICAL ERROR: SUPABASE_URL, SUPABASE_SERVICE_KEY, and JWT_SECRET must be defined in your .env file');
    process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET_NAME = 'image-uploads'; // Your bucket name

const app = express();
// Render injects the PORT environment variable. Use it or default to 5000 for local dev.
const port = process.env.PORT || 5000;
let clients = []; // For SSE connections

// --- Middleware ---
// Read allowed origins from environment variable, split by comma, default to localhost:5173
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
console.log('Allowed CORS origins:', allowedOrigins);

// Create CORS options object
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests, or server-to-server)
        // Allow origins specified in the environment variable array
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true); // Allow the request
        } else {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            console.error(`CORS Blocked: Origin '${origin}' not in allowed list: ${allowedOrigins.join(', ')}`); // Log the blocked origin for debugging
            return callback(new Error(msg), false); // Block the request
        }
    }
};

// Apply CORS middleware globally using the defined options
app.use(cors(corsOptions));
// Explicitly handle OPTIONS preflight requests for all routes using the same CORS options
// This ensures preflight checks pass before actual requests (like POST with JSON) are sent.
app.options('*', cors(corsOptions));

// Middleware to parse JSON request bodies
app.use(express.json());

// Simple logging middleware for incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url}`);
    next(); // Pass control to the next middleware/route handler
});

// --- Multer Setup for In-Memory File Storage ---
// Stores uploaded files as buffers in memory, suitable for small files and immediate processing/uploading elsewhere.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }); // Multer instance using memory storage

// --- AUTHENTICATION MIDDLEWARE ---
// Verifies JWT token from Authorization header or query parameter
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Check for standard 'Bearer <token>' format
    let token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];

    // Allow token via query parameter (useful for SSE connections initiated from browser JS)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    // If no token found, deny access
    if (token == null) {
        return res.status(401).json({ error: 'Unauthorized: Token is required.' });
    }

    // Verify the token using the secret key
    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.error("JWT Verification Error:", err.message); // Log specific error (e.g., expired, invalid)
            return res.status(403).json({ error: 'Forbidden: Token is not valid.' }); // Use 403 Forbidden for invalid tokens
        }
        // If token is valid, attach the decoded user payload to the request object
        req.user = userPayload;
        next(); // Proceed to the next middleware or route handler
    });
};

// --- ADMIN ROLE CHECK MIDDLEWARE ---
// Ensures the authenticated user has the 'admin' role
const requireAdmin = (req, res, next) => {
    // Assumes authenticateToken middleware has run and attached req.user
    if (req.user && req.user.role === 'admin') {
        next(); // User is admin, proceed
    } else {
        // User is not an admin or req.user is missing
        res.status(403).json({ error: 'Forbidden: Admin access is required for this action.' });
    }
};

// --- HELPER FUNCTIONS ---

// Function to upload a file buffer to Supabase Storage
async function uploadToSupabase(file) {
    if (!file) return null; // Handle cases where no file is provided

    // Generate a unique filename using random bytes and original extension
    const fileExt = path.extname(file.originalname).toLowerCase(); // Ensure consistent extension case
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${randomName}${fileExt}`;

    // Upload the file buffer to the specified Supabase bucket
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype, // Set content type based on uploaded file
            cacheControl: '3600', // Cache the file for 1 hour
            upsert: false // Prevent overwriting existing files (unlikely with random names)
        });

    if (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error('Failed to upload file to Supabase.'); // Throw error for handling in route
    }

    // Get the public URL of the uploaded file
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    // If getting the URL fails after successful upload, log a warning and attempt cleanup
    if (!data || !data.publicUrl) {
        console.warn(`Could not get public URL for ${fileName} after upload, attempting removal.`);
        // Try to remove the orphaned file from storage
        await supabase.storage.from(BUCKET_NAME).remove([fileName]).catch(removeError => {
            console.error(`Failed to remove orphaned file ${fileName} after URL fetch error:`, removeError);
        });
        throw new Error('Could not get public URL for the uploaded file.');
    }

    console.log(`Successfully uploaded ${fileName} to Supabase.`);
    return data.publicUrl; // Return the public URL
}

// Function to delete files from Supabase Storage based on their public URLs
async function deleteFromSupabase(fileUrls) {
    // Handle cases with no URLs or empty array
    if (!fileUrls || (Array.isArray(fileUrls) && fileUrls.length === 0)) return;

    // Ensure input is always an array
    const urlsToDelete = Array.isArray(fileUrls) ? fileUrls : [fileUrls];

    // Extract filenames from the public URLs
    const fileNames = urlsToDelete
        .map(url => {
            try {
                // Basic URL validation and check if it contains the bucket path
                if (typeof url !== 'string' || !url.includes(`/${BUCKET_NAME}/`)) return null;
                const parsedUrl = new URL(url);
                // Split the pathname by '/BUCKET_NAME/' and take the part after it
                const pathParts = parsedUrl.pathname.split(`/${BUCKET_NAME}/`);
                return pathParts.length > 1 ? pathParts[1] : null;
            } catch (e) {
                console.error(`Invalid URL format provided for deletion: ${url}`, e);
                return null; // Ignore invalid URLs
            }
        })
        .filter(Boolean); // Remove any null entries from the array

    if (fileNames.length === 0) {
        console.log("No valid filenames extracted from URLs to delete from Supabase storage.");
        return; // Exit if no valid filenames were found
    }

    console.log("Attempting to delete files from Supabase:", fileNames);
    // Perform the deletion operation
    const { data, error } = await supabase.storage.from(BUCKET_NAME).remove(fileNames);

    if (error) {
        console.error('Supabase Storage Deletion Error:', error);
        // Log the error but don't throw; deletion failure might not be critical
    } else {
        console.log("Supabase Storage Deletion Success:", data);
    }
}


// --- DATA FORMATTING HELPER ---
// Formats database rows into a consistent structure expected by the frontend
const formatRowForFrontend = (row) => {
    // Basic validation for the input row
    if (!row || typeof row !== 'object') return null;

    // Helper function to safely extract profile image URL from various possible data structures
    const getProfileImageUrl = (data) => {
        let potentialUrl = null;
        // Check for direct property or nested property via 'users' relationship
        if (data?.profile_image_url) {
            potentialUrl = data.profile_image_url;
        // Check for nested property via 'user_profile' alias (used in some joins)
        } else if (data?.user_profile?.profile_image_url) {
            potentialUrl = data.user_profile.profile_image_url;
        // Check if the property already exists (e.g., if data is already partially formatted)
        } else if (data?.authorProfileImageUrl) {
             potentialUrl = data.authorProfileImageUrl;
        }

        let url = null;
        if (potentialUrl) {
            // Handle cases where profile_image_url might be stored as an array (e.g., allowing multiple profile pics)
            if (Array.isArray(potentialUrl) && potentialUrl.length > 0) {
                url = potentialUrl[0]; // Use the first image if it's an array
            } else if (typeof potentialUrl === 'string') {
                url = potentialUrl; // Use the string directly
            }
        }
        // Basic check if the URL looks valid before returning
        return (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) ? url : null;
    };

    // Create the base formatted object with defaults for common fields
    const formattedRow = {
        id: row.id,
        name: row.name || 'ไม่มีชื่อ', // Default name for locations/products
        author: row.author || 'ไม่ระบุชื่อ', // Default author for reviews/comments
        username: row.username || undefined, // Username for users (undefined if not applicable)
        displayName: row.display_name || row.author || undefined, // Display name for users, fallback to author for others
        description: row.description || '', // Description for locations/products
        comment: row.comment || '', // Comment text for reviews/comments
        category: row.category || 'อื่นๆ', // Category for locations
        rating: isNaN(parseFloat(row.rating)) ? 0 : parseFloat(row.rating || 0), // Rating for locations/reviews, ensure it's a number (0-5)
        likes_count: Number(row.likes_count || 0), // Likes count for reviews/comments, ensure number
        comments_count: Number(row.comments_count || 0), // Comments count for reviews, ensure number
        coords: (row.lat !== undefined && row.lng !== undefined && row.lat !== null && row.lng !== null)
            ? { lat: parseFloat(row.lat), lng: parseFloat(row.lng) } // Coordinates for locations
            : null,
        googleMapUrl: row.google_map_url || null, // Google Maps URL for locations
        imageUrl: row.image_url || row.imageurl || null, // Main image URL (handle potential column name variations)
        image_urls: Array.isArray(row.image_urls) ? row.image_urls.filter(img => typeof img === 'string') : [], // Array of image URLs for reviews
        detailImages: Array.isArray(row.detail_images) ? row.detail_images.filter(img => typeof img === 'string') : [], // Array of detail image URLs for locations
        hours: row.hours || '', // Operating hours for locations
        contact: row.contact || '', // Contact info for locations
        role: row.role || undefined, // User role (e.g., 'user', 'admin')
        created_at: row.created_at || null, // Creation timestamp (keep original format)
        // Specific foreign key IDs, useful for linking data on the frontend
        location_id: row.location_id || undefined,
        user_id: row.user_id || undefined,
        review_id: row.review_id || undefined,
        // Profile image URL extracted using the helper function
        // Checks nested structures commonly returned by Supabase joins ('users', 'user_profile')
        author_profile_image_url: getProfileImageUrl(row.users || row.user_profile || row),
        // Add an alias often used in frontend components for consistency
        authorProfileImageUrl: getProfileImageUrl(row.users || row.user_profile || row)
    };

     // Explicitly set 'profileImageUrl' for user objects (when formatting a user directly)
     if (typeof row.display_name === 'string' && typeof row.username === 'string') {
         formattedRow.profileImageUrl = getProfileImageUrl(row); // Use the helper on the row itself
     }

    return formattedRow;
};

// Function to extract latitude and longitude from various Google Maps URL formats
const extractCoordsFromUrl = (url) => {
    if (!url || typeof url !== 'string') return { lat: null, lng: null }; // Basic validation

    // Regex to capture lat/lng from common Google Maps URL patterns:
    // 1. @(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z  -> Matches @lat,lng,zoomZ
    // 2. ll=(-?\d+\.\d+),(-?\d+\.\d+)      -> Matches ll=lat,lng
    // 3. q=(-?\d+\.\d+),(-?\d+\.\d+)       -> Matches q=lat,lng (often used in search/place URLs)
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z|ll=(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (match) {
        // Check which capture group matched and extract lat/lng accordingly
        if (match[1] && match[2]) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }; // @ format
        if (match[4] && match[5]) return { lat: parseFloat(match[4]), lng: parseFloat(match[5]) }; // ll= format
        if (match[6] && match[7]) return { lat: parseFloat(match[6]), lng: parseFloat(match[7]) }; // q= format
    }

    // If no coordinates are found, log a warning and return nulls
    console.warn(`Could not extract coordinates from Google Maps URL: ${url}`);
    return { lat: null, lng: null };
};


// --- NOTIFICATION HANDLING ---
async function createAndSendNotification({ type, actorId, actorName, actorProfileImageUrl, recipientId, payload }) {
    try {
        // Prepare the notification object to be sent via SSE
        const liveNotification = {
            id: crypto.randomUUID(), // Generate unique ID for the live event
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl,
            type: type,
            payload: payload, // Send the full, potentially rich payload via SSE
            is_read: false,
            created_at: new Date().toISOString(),
        };

        // Prepare a simplified payload for database storage (e.g., only IDs and names)
        const dbNotificationPayload = {};
        if (payload.location) {
            dbNotificationPayload.locationId = payload.location.id;
            dbNotificationPayload.locationName = payload.location.name;
            // Optionally include image URL if needed for display directly from DB payload
            dbNotificationPayload.locationImageUrl = payload.location.imageUrl;
        }
        if (payload.product) {
            dbNotificationPayload.productId = payload.product.id;
            dbNotificationPayload.productName = payload.product.name;
            dbNotificationPayload.productImageUrl = payload.product.imageUrl;
        }
        if (payload.reviewId) dbNotificationPayload.reviewId = payload.reviewId;
        if (payload.commentId) dbNotificationPayload.commentId = payload.commentId;
        if (payload.commentSnippet) dbNotificationPayload.commentSnippet = payload.commentSnippet; // Store snippet if provided

        // Prepare the notification object for database insertion
        const dbNotification = {
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl, // Store actor image URL in DB as well
            type: type,
            payload: dbNotificationPayload, // Store the simplified payload
            is_read: false,
            // created_at will be set by the database default value
        };

        // --- Database Insertion Logic ---
        if (recipientId && recipientId !== actorId) {
            // Send notification to a specific recipient (if not the actor themselves)
            const { error: insertError } = await supabase.from('notifications').insert({ ...dbNotification, user_id: recipientId });
            if (insertError) throw insertError; // Throw error to be caught below
            console.log(`Notification '${type}' sent to user ${recipientId}.`);
        } else if (!recipientId) {
            // Handle broadcast notifications (e.g., for new location)
            // Be cautious with broadcasting to avoid unnecessary load/notifications
            if (type === 'new_location') {
                // Fetch all users except the actor
                const { data: users, error: userFetchError } = await supabase.from('users').select('id').neq('id', actorId);
                if (userFetchError) throw userFetchError; // Throw error if fetching users fails

                if (users && users.length > 0) {
                    // Create an array of notification objects for bulk insertion
                    const notificationsToInsert = users.map(user => ({ ...dbNotification, user_id: user.id }));
                    const { error: bulkInsertError } = await supabase.from('notifications').insert(notificationsToInsert);
                    if (bulkInsertError) throw bulkInsertError; // Throw error if bulk insert fails
                    console.log(`Broadcasted '${type}' notification to ${users.length} users.`);
                }
            } else {
                // Log if a type is not configured for broadcast but has no recipient
                console.log(`Notification type '${type}' not configured for broadcast and has no specific recipient.`);
            }
        }

        // --- SSE Sending Logic ---
        const liveEventPayload = { type: 'notification', data: liveNotification };
        // Iterate through all connected SSE clients
        clients.forEach(client => {
            try {
                // Send to specific recipient OR broadcast (excluding the sender)
                if (recipientId) {
                    // Send only if the client's user ID matches the recipient and is not the actor
                    if (client.userId === recipientId && client.userId !== actorId) {
                        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                    }
                } else if (type === 'new_location') { // Only broadcast 'new_location' type live
                    // Send to all clients except the actor
                    if (client.userId !== actorId) {
                        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                    }
                }
            } catch (e) {
                // Handle errors during SSE write (e.g., client disconnected)
                console.error(`Error writing SSE for client ${client.id} (User ${client.userId}):`, e.message);
                // Remove the client immediately if writing fails
                clients = clients.filter(c => c.id !== client.id);
                console.log(`Client ${client.id} removed due to write error. Remaining clients: ${clients.length}`);
            }
        });
    } catch (error) {
        // Catch errors from database operations or user fetching
        console.error(`Error creating/sending notification (Type: ${type}):`, error);
    }
}


// --- SERVER-SENT EVENTS (SSE) SETUP ---
// Sends a keep-alive comment every 15 seconds to prevent connection timeouts
const sendHeartbeat = () => {
    // console.log(`Sending heartbeat to ${clients.length} clients...`); // Optional: verbose logging
    clients.forEach(client => {
        try {
            client.res.write(':keep-alive\n\n'); // Send comment line as heartbeat
        } catch (e) {
            // If writing fails, assume client disconnected and remove them
            console.error(`Heartbeat failed for client ${client.id} (User ${client.userId}):`, e.message);
            clients = clients.filter(c => c.id !== client.id);
            console.log(`Client ${client.id} disconnected (Heartbeat failed). Remaining clients: ${clients.length}`);
        }
    });
};
const heartbeatInterval = setInterval(sendHeartbeat, 15000); // Run every 15 seconds

// Endpoint for clients to establish an SSE connection
app.get('/api/events', authenticateToken, async (req, res) => {
    // Set headers required for SSE connection
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no' // Important for Nginx or similar proxies
    };
    res.writeHead(200, headers);

    // Generate a unique ID for this client connection
    const clientId = Date.now() + Math.random().toString(36).substring(2, 15);
    // Store client details including response object and authenticated user ID
    const newClient = { id: clientId, res: res, userId: req.user.userId };
    clients.push(newClient);
    console.log(`Client ${clientId} connected (User ${newClient.userId}). Total clients: ${clients.length}`);

    // Immediately send a confirmation message to the client
    try {
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);
        // Send an initial comment (like a heartbeat) to confirm write capability
        res.write(':initial-connection\n\n');
    } catch (e) {
        // If initial write fails, remove client immediately
        console.error(`Initial write failed for client ${clientId}:`, e.message);
        clients = clients.filter(client => client.id !== clientId);
        // Don't keep the connection open if we can't write to it
        // res.end(); // Optionally end the response here
        return;
    }

    // Attempt to send past (historic) notifications to the newly connected client
    try {
        const { data: pastNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId) // Fetch only for the authenticated user
            .order('created_at', { ascending: false }) // Get latest first
            .limit(20); // Limit the number of past notifications sent

        if (error) throw error; // Throw DB errors to be caught below

        if (pastNotifications && pastNotifications.length > 0) {
            const payload = { type: 'historic_notifications', data: pastNotifications };
            // Ensure the client is still in the active list before attempting to write
            if (clients.some(c => c.id === clientId)) {
                try {
                    newClient.res.write(`data: ${JSON.stringify(payload)}\n\n`);
                } catch (e) {
                    // If writing historic data fails, remove the client
                    console.error(`Error writing historic notifications for ${clientId}:`, e.message);
                    clients = clients.filter(client => client.id !== clientId);
                }
            }
        }
    } catch (err) {
        // Log errors during fetching/sending historic notifications, but don't kill connection
        console.error(`[SSE ERROR] Could not fetch/send past notifications for user ${req.user.userId}:`, err);
    }

    // Handle client disconnection (e.g., browser tab closed)
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`Client ${clientId} disconnected (closed connection). Remaining clients: ${clients.length}`);
    });

    // Keep the connection open indefinitely for SSE; do not call res.end() here.
});


// --- API Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '21.3', database: 'supabase_storage' }));

// --- USER PROFILE ---
app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Fetch specific user data by ID
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, display_name, profile_image_url, role') // Select only necessary public fields
            .eq('id', userId)
            .single(); // Expect only one user

        // Handle database errors (excluding 'not found')
        if (error && error.code !== 'PGRST116') throw error;
        // Handle user not found specifically
        if (!user) return res.status(404).json({ error: 'User not found.' });

        // Format and send the user data
        res.json(formatRowForFrontend(user));
    } catch (err) {
        console.error(`Error fetching user profile ${userId}:`, err);
        // Return 404 if the error was 'not found'
        if (err.code === 'PGRST116') return res.status(404).json({ error: 'User not found.' });
        // Return 500 for other unexpected errors
        res.status(500).json({ error: 'Could not fetch user profile.' });
    }
});

// Endpoint to update user profile information
app.put('/api/users/:userIdToUpdate', authenticateToken, upload.single('profileImage'), async (req, res) => {
    const { userIdToUpdate } = req.params; // ID of the user being updated
    const { userId: authenticatedUserId, role } = req.user; // ID and role of the logged-in user making the request

    // Authorization: Allow update only if the user is updating their own profile or if the user is an admin
    if (userIdToUpdate !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขโปรไฟล์นี้' });
    }

    const { displayName, currentPassword, newPassword, username } = req.body;
    let newImageUrl = null; // To track if a new image was uploaded for potential cleanup on error

    try {
        // Fetch the full user record to verify current password and get existing image URL
        const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('id', userIdToUpdate).single();
        if (fetchError || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

        const updateData = {}; // Object to store fields to be updated

        // --- Password/Username Change Validation ---
        // Require current password if changing password OR username
        if (newPassword || (username && username.trim() && username.trim() !== user.username)) {
            if (!currentPassword) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง' });
            // Verify the provided current password against the stored hash
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        }

        // --- Update Display Name ---
        if (displayName && displayName.trim() && displayName.trim() !== user.display_name) {
            updateData.display_name = displayName.trim();
            // Propagate display name change to related tables (reviews, comments)
            // Use Promise.allSettled to attempt both updates even if one fails
            await Promise.allSettled([
                supabase.from('reviews').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate),
                supabase.from('review_comments').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate)
            ]).then(results => results.forEach((result, i) => result.status === 'rejected' && console.error(`Failed to update author name in ${i === 0 ? 'reviews' : 'comments'}:`, result.reason)));
        }

        // --- Update Username ---
        if (username && username.trim() && username.trim() !== user.username) {
            const trimmedUsername = username.trim();
            // Check for username uniqueness
            const { data: existingUser } = await supabase.from('users').select('id').eq('username', trimmedUsername).maybeSingle();
            if (existingUser && existingUser.id !== userIdToUpdate) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
            // Add basic validation for username format (example: 3-20 chars, alphanumeric + underscore)
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, A-Z, 0-9, _)' });
            updateData.username = trimmedUsername;
        }

        // --- Update Password ---
        if (newPassword) {
            if (newPassword.length < 6) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
            updateData.password = await bcrypt.hash(newPassword, 10); // Hash the new password
        }

        // --- Update Profile Image ---
        if (req.file) { // Check if a new file was uploaded
            // Delete the old profile image from storage, if it exists
            await deleteFromSupabase(user.profile_image_url);
            // Upload the new image and get its URL
            newImageUrl = await uploadToSupabase(req.file);
            // Store the new URL (potentially as an array if design allows multiple)
            updateData.profile_image_url = [newImageUrl];
        }

        // --- Perform Update ---
        // If no fields were actually changed, return current user info and token
        if (Object.keys(updateData).length === 0) {
            const currentFormattedUser = formatRowForFrontend(user);
            // Re-sign token in case role/info changed, though nothing was updated here
            const token = jwt.sign({ userId: currentFormattedUser.id, username: currentFormattedUser.username, displayName: currentFormattedUser.displayName, role: currentFormattedUser.role, profileImageUrl: currentFormattedUser.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต', user: currentFormattedUser, token });
        }

        // Update the user record in the database
        const { data: updatedUserResult, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userIdToUpdate)
            .select('id, username, display_name, profile_image_url, role') // Select the updated fields
            .single(); // Expect one row back

        if (updateError) throw updateError; // Throw DB errors

        // --- Respond with Updated Info and New Token ---
        const formattedUpdatedUser = formatRowForFrontend(updatedUserResult);
        // Generate a new JWT with potentially updated claims (username, displayName, profileImageUrl, role)
        const token = jwt.sign({
            userId: formattedUpdatedUser.id,
            username: formattedUpdatedUser.username,
            displayName: formattedUpdatedUser.displayName,
            role: formattedUpdatedUser.role,
            profileImageUrl: formattedUpdatedUser.profileImageUrl // Ensure updated image URL is in token
        }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ!', user: formattedUpdatedUser, token });

    } catch (err) {
        console.error(`[ERROR] Updating profile for ${userIdToUpdate}:`, err);
        // If an error occurred after a new image was uploaded, attempt to delete the new image
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});

// Endpoint to delete a user account
app.delete('/api/users/:userIdToDelete', authenticateToken, async (req, res) => {
    const { userIdToDelete } = req.params; // ID of the user to delete
    const { userId: authenticatedUserId, role } = req.user; // ID/role of user making request
    const { currentPassword } = req.body; // Password confirmation required

    // Authorization: User can delete own account, or admin can delete any account
    if (userIdToDelete !== authenticatedUserId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบบัญชีนี้' });
    // Require password confirmation
    if (!currentPassword) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ' });

    try {
        // Fetch user to verify password and get profile image URL
        const { data: user, error: fetchError } = await supabase.from('users').select('password, profile_image_url').eq('id', userIdToDelete).single();
        if (fetchError || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

        // Verify the provided password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

        // --- Deletion Process ---
        // 1. Delete associated profile image from storage
        await deleteFromSupabase(user.profile_image_url);

        // 2. Delete related data from other tables (order might matter depending on constraints/cascades)
        // It's generally safer to delete dependent records first.
        // Consider using database CASCADE constraints for simplicity if applicable.
        console.log(`Starting deletion process for user ${userIdToDelete}...`);
        await supabase.from('review_likes').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted review likes for user ${userIdToDelete}.`);
        await supabase.from('comment_likes').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted comment likes for user ${userIdToDelete}.`);
        // Dependent tables need careful handling. Comments depend on Reviews.
        // If deleting Reviews cascades to Comments, deleting Comments first might be redundant or fail.
        // Assuming no cascade or specific order needed for likes/comments/reviews here:
        await supabase.from('review_comments').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted review comments for user ${userIdToDelete}.`);
        // TODO: Also delete comments on reviews *created by* this user? (More complex query needed)
        await supabase.from('reviews').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted reviews for user ${userIdToDelete}.`);
        // TODO: Also delete reviews for locations *created by* this user?
        await supabase.from('favorites').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted favorites for user ${userIdToDelete}.`);
        // Delete items potentially created *by* this user (assuming 'user_id' FK exists)
        await supabase.from('famous_products').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted famous products created by user ${userIdToDelete}.`);
        await supabase.from('attractions').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted attractions created by user ${userIdToDelete}.`);
        await supabase.from('foodShops').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted foodShops created by user ${userIdToDelete}.`);
        // TODO: Handle notifications related to/sent to this user?

        // 3. Finally, delete the user record itself
        const { error: userDeleteError } = await supabase.from('users').delete().eq('id', userIdToDelete);
        if (userDeleteError) throw userDeleteError; // Throw if final delete fails
        console.log(`Successfully deleted user record for ${userIdToDelete}.`);

        res.json({ message: 'ลบบัญชีผู้ใช้สำเร็จ' });

    } catch(err) {
        console.error(`[ERROR] Deleting account for ${userIdToDelete}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดระหว่างการลบบัญชี' });
    }
});


// --- NOTIFICATIONS ---
// Fetch recent notifications for the logged-in user
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*') // Select all columns for now
            .eq('user_id', req.user.userId) // Filter by logged-in user
            .order('created_at', { ascending: false }) // Show newest first
            .limit(20); // Limit results
        if (error) throw error;
        res.json(data); // Return raw notification data (formatting might happen on client)
    } catch (err) {
        console.error(`Error fetching notifications for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch notifications.' });
    }
});

// Get the count of unread notifications for the logged-in user
app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
    try {
        // Use Supabase count feature for efficiency
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true }) // Fetch only the count
            .eq('user_id', req.user.userId) // Filter by user
            .eq('is_read', false); // Filter by unread status
        if (error) throw error;
        res.json({ count: count || 0 }); // Return the count (or 0 if null)
    } catch (err) {
        console.error(`Error fetching unread count for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch unread count.' });
    }
});

// Mark all unread notifications as read for the logged-in user
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true }) // Set is_read to true
            .eq('user_id', req.user.userId) // Filter by user
            .eq('is_read', false); // Only update currently unread ones
        if (error) throw error;
        res.status(200).json({ message: 'Notifications marked as read.' });
    } catch (err) {
        console.error(`Error marking notifications read for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not mark notifications as read.' });
    }
});


// --- FAMOUS PRODUCTS ---
// (Endpoints for famous products: GET all (admin), GET random, GET by ID, POST, PUT, DELETE)
// These sections are collapsed for brevity but contain the full logic as provided previously.
app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    const locationMap = new Map();
    let products = [];
    try {
        const [attractionsRes, foodShopsRes] = await Promise.all([
             supabase.from('attractions').select('id, name'),
             supabase.from('foodShops').select('id, name')
        ]);
        if (attractionsRes.error) console.error("Error fetching attractions for product map:", attractionsRes.error);
        if (foodShopsRes.error) console.error("Error fetching foodShops for product map:", foodShopsRes.error);
        (attractionsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
        (foodShopsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
    } catch (err) { console.error("CRITICAL Error fetching locations for product mapping:", err); }
    try {
        const { data: fetchedProducts, error: productsError } = await supabase.from('famous_products').select('*');
        if (productsError) { console.error("Error fetching famous products:", productsError); return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' }); }
        else { products = fetchedProducts || []; }
    } catch (err) { console.error("CRITICAL Error fetching famous products:", err); return res.status(500).json({ error: 'เกิดข้อผิดพลาดร้ายแรงในการดึงข้อมูลของขึ้นชื่อ' }); }
    const productsWithLocation = products.map(product => {
        const formatted = formatRowForFrontend(product);
        return { ...formatted, locationName: product.location_id ? locationMap.get(product.location_id) || 'ไม่พบสถานที่' : 'ส่วนกลาง' };
    });
    res.json(productsWithLocation);
});
app.get('/api/famous-products/random', async (req, res) => {
    try {
        const { data, error } = await supabase.from('famous_products').select('*').is('location_id', null);
        if (error) throw error;
        const shuffled = (data || []).sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 2).map(formatRowForFrontend));
    } catch (err) { console.error("Error fetching random famous products:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' }); }
});
app.get('/api/famous-products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: product, error } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!product) return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' });
        res.json(formatRowForFrontend(product));
    } catch (err) { console.error(`Error fetching famous product ${id}:`, err); if (err.code === 'PGRST116') { return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' }); } res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' }); }
});
app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    const { userId } = req.user;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    let imageUrl = null;
    try {
        imageUrl = req.file ? await uploadToSupabase(req.file) : null; // Handle optional image
        const newProduct = { id: crypto.randomUUID(), name: name.trim(), description: description ? description.trim() : '', imageurl: imageUrl, location_id: locationId || null, user_id: userId };
        const { data, error } = await supabase.from('famous_products').insert(newProduct).select().single();
        if (error) throw error;
        res.status(201).json(formatRowForFrontend(data));
    } catch (err) { console.error("Error creating product:", err); if(imageUrl) await deleteFromSupabase(imageUrl); res.status(500).json({ error: `Failed to create product: ${err.message}` }); }
});
app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const { userId, role } = req.user;
    let newImageUrl = null;
    try {
        const { data: product, error: fetchError } = await supabase.from('famous_products').select('user_id, imageurl').eq('id', id).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (req.file) { await deleteFromSupabase(product.imageurl); newImageUrl = await uploadToSupabase(req.file); updateData.imageurl = newImageUrl; }
        if (Object.keys(updateData).length > 0) {
            const { data: updatedProduct, error: updateError } = await supabase.from('famous_products').update(updateData).eq('id', id).select().single();
            if (updateError) throw updateError;
            return res.json(formatRowForFrontend(updatedProduct));
        } else {
            const { data: currentProduct, error: currentError } = await supabase.from('famous_products').select('*').eq('id', id).single();
            if(currentError) throw currentError;
            currentProduct.imageurl = product.imageurl; // Ensure current image URL is correct
            return res.json(formatRowForFrontend(currentProduct));
        }
    } catch (err) { console.error(`Error updating product ${id}:`, err); if (newImageUrl) await deleteFromSupabase(newImageUrl); res.status(500).json({ error: 'Failed to update product.' }); }
});
app.delete('/api/famous-products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: product, error: fetchError } = await supabase.from('famous_products').select('user_id, imageurl').eq('id', id).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        await deleteFromSupabase(product.imageurl);
        const { error: deleteError } = await supabase.from('famous_products').delete().eq('id', id);
        if (deleteError) throw deleteError;
        res.status(204).send();
    } catch (err) { console.error(`Error deleting product ${id}:`, err); res.status(500).json({ error: 'Failed to delete product.' }); }
});


// --- LOCATIONS ---
// (Endpoints for locations: GET attractions, GET foodShops, GET by ID, POST, PUT, DELETE,
// GET similar category, GET famous products for location, GET/POST deletion requests)
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [attractionsRes, foodShopsRes] = await Promise.all([
             supabase.from('attractions').select('*').eq('status', 'pending_deletion'),
             supabase.from('foodShops').select('*').eq('status', 'pending_deletion')
        ]);
        let allRequests = [];
        if (attractionsRes.error) console.error("Error fetching attraction deletion requests:", attractionsRes.error); else allRequests = allRequests.concat(attractionsRes.data || []);
        if (foodShopsRes.error) console.error("Error fetching foodShop deletion requests:", foodShopsRes.error); else allRequests = allRequests.concat(foodShopsRes.data || []);
        res.json(allRequests.map(formatRowForFrontend));
    } catch (err) { console.error("CRITICAL Error fetching deletion requests:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดร้ายแรงในการดึงคำขอลบ' }); }
});
app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let { data, error } = await supabase.from('attractions').update({ status: 'approved' }).eq('id', id).eq('status', 'pending_deletion').select('id').maybeSingle();
        if (!data && (!error || error?.code === 'PGRST116')) { ({ data, error } = await supabase.from('foodShops').update({ status: 'approved' }).eq('id', id).eq('status', 'pending_deletion').select('id').maybeSingle()); }
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.status(404).json({ message: 'ไม่พบคำขอลบสำหรับสถานที่นี้ หรือสถานะไม่ใช่ pending_deletion' });
        res.json({ message: 'ปฏิเสธการลบและคืนสถานะสถานที่เรียบร้อยแล้ว' });
    } catch (err) { console.error(`Error denying deletion for ${id}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอลบ' }); }
});
app.get('/api/attractions', async (req, res) => {
    try {
        let query = supabase.from('attractions').select('*').eq('status', 'approved');
        if (req.query.sortBy === 'rating') { query = query.order('rating', { ascending: false, nullsFirst: false }); }
        else { query = query.order('name', { ascending: true }); }
        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) { console.error("Error fetching attractions:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่ท่องเที่ยว' }); }
});
app.get('/api/foodShops', async (req, res) => {
    try {
        let query = supabase.from('foodShops').select('*').eq('status', 'approved');
        if (req.query.sortBy === 'rating') { query = query.order('rating', { ascending: false, nullsFirst: false }); }
        else { query = query.order('name', { ascending: true }); }
        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) { console.error("Error fetching foodShops:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร' }); }
});
app.get('/api/locations/same-category', async (req, res) => {
    const { category, excludeId } = req.query;
    if (!category) return res.status(400).json({ error: 'Category is required' });
    try {
        const [attractionsResult, foodShopsResult] = await Promise.all([
             supabase.from('attractions').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5),
             supabase.from('foodShops').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5)
        ]);
        if (attractionsResult.error) console.error("Error fetching similar attractions:", attractionsResult.error);
        if (foodShopsResult.error) console.error("Error fetching similar foodShops:", foodShopsResult.error);
        const attractions = attractionsResult.data || [];
        const foodShops = foodShopsResult.data || [];
        const combined = [...attractions, ...foodShops];
        const shuffled = combined.sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 5).map(formatRowForFrontend));
    } catch (err) { console.error(`Error fetching locations in category ${category}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสถานที่ในหมวดหมู่เดียวกัน' }); }
});
app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { locationId } = req.params;
    try {
        const { data, error } = await supabase.from('famous_products').select('*').eq('location_id', locationId);
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) { console.error(`Error fetching famous products for location ${locationId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' }); }
});
app.get('/api/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let { data: location, error } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle();
        if (!location && (!error || error?.code === 'PGRST116')) { ({ data: location, error } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle()); }
        if (error && error.code !== 'PGRST116') throw error;
        if (location) res.json(formatRowForFrontend(location));
        else res.status(404).json({ error: 'ไม่พบสถานที่' });
    } catch (err) { console.error(`Error fetching location ${id}:`, err); if (err.code !== 'PGRST116') { res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' }); } else { res.status(404).json({ error: 'ไม่พบสถานที่' }); } }
});
app.post('/api/locations', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { name, category, description, googleMapUrl, hours, contact } = req.body;
    const { userId } = req.user;
    if (!name || !name.trim() || !category) return res.status(400).json({ error: 'กรุณากรอกชื่อและหมวดหมู่' });
    let uploadedImageUrls = [];
    try {
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        uploadedImageUrls = await Promise.all(uploadPromises);
        const coords = extractCoordsFromUrl(googleMapUrl);
        const newLocationData = { id: crypto.randomUUID(), name: name.trim(), category, description: description ? description.trim() : '', google_map_url: googleMapUrl || null, hours: hours || '', contact: contact || '', user_id: userId, status: 'approved', image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, detail_images: uploadedImageUrls.length > 1 ? uploadedImageUrls.slice(1) : [], lat: coords.lat, lng: coords.lng };
        const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(category);
        const tableName = isFoodShop ? 'foodShops' : 'attractions';
        const { data: insertedLocation, error } = await supabase.from(tableName).insert(newLocationData).select().single();
        if (error) throw error;
        // Trigger notification after successful creation
        createAndSendNotification({ type: 'new_location', actorId: userId, actorName: req.user.displayName || req.user.username, actorProfileImageUrl: req.user.profileImageUrl, recipientId: null, payload: { location: formatRowForFrontend(insertedLocation) } });
        res.status(201).json(formatRowForFrontend(insertedLocation));
    } catch (err) { console.error("Error creating location:", err); if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }); }
});
app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { name, category, description, googleMapUrl, hours, contact, existingImages } = req.body;
    let newlyUploadedUrls = [];
    try {
        let location = null; let tableName = null; const { data: attractionData, error: attrError } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle(); if (attrError && attrError.code !== 'PGRST116') throw attrError; if (attractionData) { location = attractionData; tableName = 'attractions'; } else { const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle(); if (foodError && foodError.code !== 'PGRST116') throw foodError; if(foodShopData) { location = foodShopData; tableName = 'foodShops'; } }
        if (!location) return res.status(404).json({ error: 'ไม่พบสถานที่ที่ต้องการแก้ไข' });
        if (role !== 'admin' && location.user_id !== userId) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
        const keptImageUrls = existingImages ? JSON.parse(existingImages) : [];
        const oldImageUrls = [location.image_url, ...(location.detail_images || [])].filter(Boolean);
        const imagesToDelete = oldImageUrls.filter(oldUrl => !keptImageUrls.includes(oldUrl));
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        newlyUploadedUrls = await Promise.all(uploadPromises);
        const allFinalImageUrls = [...keptImageUrls, ...newlyUploadedUrls];
        await deleteFromSupabase(imagesToDelete);
        const coords = extractCoordsFromUrl(googleMapUrl);
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (category !== undefined) updateData.category = category;
        if (description !== undefined) updateData.description = description.trim();
        if (googleMapUrl !== undefined) updateData.google_map_url = googleMapUrl;
        if (hours !== undefined) updateData.hours = hours.trim();
        if (contact !== undefined) updateData.contact = contact.trim();
        if (googleMapUrl !== undefined) { updateData.lat = coords.lat; updateData.lng = coords.lng; }
        updateData.image_url = allFinalImageUrls.length > 0 ? allFinalImageUrls[0] : null;
        updateData.detail_images = allFinalImageUrls.length > 1 ? allFinalImageUrls.slice(1) : [];
        const { data: updatedLocation, error: updateError } = await supabase.from(tableName).update(updateData).eq('id', id).select().single();
        if (updateError) throw updateError;
        res.json(formatRowForFrontend(updatedLocation));
    } catch (err) { console.error('Error updating location:', err); if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสถานที่' }); }
});
app.post('/api/locations/:id/request-deletion', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        let location = null; let tableName = null; const { data: attractionData, error: attrError } = await supabase.from('attractions').select('user_id, status').eq('id', id).maybeSingle(); if (attrError && attrError.code !== 'PGRST116') throw attrError; if (attractionData) { location = attractionData; tableName = 'attractions'; } else { const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('user_id, status').eq('id', id).maybeSingle(); if (foodError && foodError.code !== 'PGRST116') throw foodError; if(foodShopData) { location = foodShopData; tableName = 'foodShops'; } }
        if (!location) return res.status(404).json({ error: 'Location not found.' });
        if (location.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        if (location.status === 'pending_deletion') return res.status(400).json({ error: 'คำขอลบได้ถูกส่งไปแล้ว' });
        const { error: updateError } = await supabase.from(tableName).update({ status: 'pending_deletion' }).eq('id', id);
        if (updateError) throw updateError;
        res.json({ message: 'ส่งคำขอลบเรียบร้อยแล้ว' });
    } catch (err) { console.error(`Error requesting deletion for ${id}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอลบ' }); }
});
app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let location = null; let tableName = null; const { data: attractionData, error: attrError } = await supabase.from('attractions').select('image_url, detail_images').eq('id', id).maybeSingle(); if (attrError && attrError.code !== 'PGRST116') throw attrError; if (attractionData) { location = attractionData; tableName = 'attractions'; } else { const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('image_url, detail_images').eq('id', id).maybeSingle(); if (foodError && foodError.code !== 'PGRST116') throw foodError; if(foodShopData) { location = foodShopData; tableName = 'foodShops'; } }
        if (location) { const imagesToDelete = [location.image_url, ...(location.detail_images || [])].filter(Boolean); await deleteFromSupabase(imagesToDelete); }
        const { data: reviewIdsData, error: reviewIdsError } = await supabase.from('reviews').select('id').eq('location_id', id); if (reviewIdsError) console.error("Error fetching review IDs for deletion:", reviewIdsError); const reviewIds = (reviewIdsData || []).map(r => r.id);
        if (reviewIds.length > 0) { const { data: commentIdsData, error: commentIdsError } = await supabase.from('review_comments').select('id').in('review_id', reviewIds); if(commentIdsError) console.error("Error fetching comment IDs for deletion:", commentIdsError); const commentIds = (commentIdsData || []).map(c => c.id); if (commentIds.length > 0) { await supabase.from('comment_likes').delete().in('comment_id', commentIds); } await supabase.from('review_comments').delete().in('review_id', reviewIds); await supabase.from('review_likes').delete().in('review_id', reviewIds); }
        await supabase.from('reviews').delete().eq('location_id', id);
        await supabase.from('famous_products').delete().eq('location_id', id);
        await supabase.from('favorites').delete().eq('location_id', id);
        const { error: deleteAttrError } = await supabase.from('attractions').delete().eq('id', id);
        const { error: deleteFoodError } = await supabase.from('foodShops').delete().eq('id', id);
        if (deleteAttrError && deleteAttrError.code !== 'PGRST116') console.error(`Error deleting from attractions: ${id}`, deleteAttrError);
        if (deleteFoodError && deleteFoodError.code !== 'PGRST116') console.error(`Error deleting from foodShops: ${id}`, deleteFoodError);
        res.status(204).send();
    } catch (err) { console.error(`Error deleting location ${id}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสถานที่' }); }
});


// --- REVIEWS ---
// (Endpoints for reviews: GET by location, POST, PUT, DELETE, POST toggle like)
app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params; const { userId } = req.query;
    try {
        const { data: reviewsData, error: reviewsError } = await supabase.from('reviews').select(`*, user_profile:user_id ( profile_image_url )`).eq('location_id', locationId).order('created_at', { ascending: false }); // Order by creation time
        if (reviewsError) { console.error(`Supabase error fetching reviews for ${locationId}:`, reviewsError); throw reviewsError; }
        if (!reviewsData || reviewsData.length === 0) return res.json([]);
        const reviewIds = reviewsData.map(review => review.id);
        let commentCounts = {}; try { const { data: comments, error: countError } = await supabase.from('review_comments').select('review_id').in('review_id', reviewIds); if (countError) throw countError; commentCounts = (comments || []).reduce((acc, comment) => { acc[comment.review_id] = (acc[comment.review_id] || 0) + 1; return acc; }, {}); } catch (commentsError) { console.error(`Error fetching comment counts for reviews of ${locationId}:`, commentsError); }
        let likedReviewIds = new Set(); if (userId) { try { const { data: likesData, error: likesError } = await supabase.from('review_likes').select('review_id').eq('user_id', userId).in('review_id', reviewIds); if (likesError) throw likesError; if (likesData) { likedReviewIds = new Set(likesData.map(like => like.review_id)); } } catch (likesFetchError) { console.error(`Error fetching likes for user ${userId} on reviews of ${locationId}:`, likesFetchError); } }
        const formattedReviews = reviewsData.map(review => { const formatted = formatRowForFrontend(review); return { ...formatted, comments_count: commentCounts[review.id] || 0, user_has_liked: likedReviewIds.has(review.id) }; });
        res.json(formattedReviews);
    } catch (err) { console.error(`Error processing reviews request for ${locationId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว' }); }
});
app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params; const { rating, comment } = req.body; const { userId, username, displayName, profileImageUrl } = req.user;
    if (!rating || !comment || !comment.trim()) return res.status(400).json({ error: 'กรุณากรอกคะแนนและเนื้อหารีวิว' }); const numericRating = parseInt(rating, 10); if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) return res.status(400).json({ error: 'คะแนนต้องอยู่ระหว่าง 1 ถึง 5' });
    let uploadedImageUrls = [];
    try {
        const uploadPromises = (req.files || []).map(uploadToSupabase); uploadedImageUrls = await Promise.all(uploadPromises);
        const newReview = { id: crypto.randomUUID(), location_id: locationId, user_id: userId, author: displayName || username, rating: numericRating, comment: comment.trim(), image_urls: uploadedImageUrls, likes_count: 0 };
        const { data: insertedReview, error: insertError } = await supabase.from('reviews').insert(newReview).select().single(); if (insertError) throw insertError;
        const { data: locationOwnerData } = await supabase.rpc('get_location_owner', { loc_id: locationId }).maybeSingle(); // Assumes get_location_owner function exists
        // Recalculate average rating
        const { data: allReviews, error: ratingError } = await supabase.from('reviews').select('rating').eq('location_id', locationId);
        if (ratingError) { console.error(`Error fetching ratings for recalculation on ${locationId}:`, ratingError); } else { const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0); const averageRating = (allReviews && allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0; await Promise.allSettled([ supabase.from('attractions').update({ rating: averageRating }).eq('id', locationId), supabase.from('foodShops').update({ rating: averageRating }).eq('id', locationId) ]); }
        // Send notification
        if (locationOwnerData && locationOwnerData.user_id && locationOwnerData.user_id !== userId) { createAndSendNotification({ type: 'new_review', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl, recipientId: locationOwnerData.user_id, payload: { location: { id: locationId, name: locationOwnerData.name }, reviewId: insertedReview.id } }); }
        const formattedReview = formatRowForFrontend({ ...insertedReview, user_profile: { profile_image_url: profileImageUrl } });
        res.status(201).json(formattedReview);
    } catch (err) { console.error("Error creating review:", err); if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' }); }
});
app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { reviewId } = req.params; const { rating, comment, existingImages } = req.body; const { userId, role, profileImageUrl } = req.user; let newlyUploadedUrls = [];
    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('user_id, location_id, image_urls, rating').eq('id', reviewId).single(); if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการแก้ไข' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });
        const keptImages = existingImages ? JSON.parse(existingImages) : []; const imagesToDelete = (review.image_urls || []).filter(url => !keptImages.includes(url)); const uploadPromises = (req.files || []).map(uploadToSupabase); newlyUploadedUrls = await Promise.all(uploadPromises); const allFinalImageUrls = [...keptImages, ...newlyUploadedUrls];
        await deleteFromSupabase(imagesToDelete);
        const updateData = {}; let ratingChanged = false; if (rating !== undefined) { const numericRating = parseInt(rating, 10); if (!isNaN(numericRating) && numericRating >= 1 && numericRating <= 5) { if (numericRating !== review.rating) ratingChanged = true; updateData.rating = numericRating; } else { console.warn(`Invalid rating value received during update: ${rating}`); } } if (comment !== undefined) updateData.comment = comment.trim(); updateData.image_urls = allFinalImageUrls;
        let updatedReviewData = null; if (Object.keys(updateData).length > 0) { const { data, error: updateError } = await supabase.from('reviews').update(updateData).eq('id', reviewId).select(`*`).single(); if (updateError) throw updateError; updatedReviewData = data; } else { updatedReviewData = review; }
        if (ratingChanged && review.location_id) { const { data: allReviews, error: ratingError } = await supabase.from('reviews').select('rating').eq('location_id', review.location_id); if (ratingError) { console.error(`Error fetching ratings for recalculation on ${review.location_id}:`, ratingError); } else { const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0); const averageRating = (allReviews && allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0; await Promise.allSettled([ supabase.from('attractions').update({ rating: averageRating }).eq('id', review.location_id), supabase.from('foodShops').update({ rating: averageRating }).eq('id', review.location_id) ]); } }
        const formattedReview = formatRowForFrontend({ ...updatedReviewData, user_profile: { profile_image_url: profileImageUrl } });
        res.json(formattedReview);
    } catch (err) { console.error('Error updating review:', err); if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรีวิว' }); }
});
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params; const { userId, role } = req.user;
    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('user_id, location_id, image_urls').eq('id', reviewId).single(); if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการลบ' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรีวิวนี้' });
        const effectiveLocationId = review.location_id;
        await deleteFromSupabase(review.image_urls);
        // Delete dependents first
        const { data: commentIdsData } = await supabase.from('review_comments').select('id').eq('review_id', reviewId);
        const commentIds = (commentIdsData || []).map(c => c.id);
        if (commentIds.length > 0) await supabase.from('comment_likes').delete().in('comment_id', commentIds);
        await supabase.from('review_comments').delete().eq('review_id', reviewId);
        await supabase.from('review_likes').delete().eq('review_id', reviewId);
        // Delete the review
        const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId); if (deleteError) throw deleteError;
        // Recalculate average rating
        if (effectiveLocationId) { const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('rating').eq('location_id', effectiveLocationId); if (reviewsError) { console.error(`Error fetching ratings for recalc after delete on ${effectiveLocationId}:`, reviewsError); } else { const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0); const averageRating = (allReviews && allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0; await Promise.allSettled([ supabase.from('attractions').update({ rating: averageRating }).eq('id', effectiveLocationId), supabase.from('foodShops').update({ rating: averageRating }).eq('id', effectiveLocationId) ]); } }
        res.status(204).send();
    } catch (err) { console.error('Error deleting review:', err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบรีวิว' }); }
});
app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, async (req, res) => {
    const { reviewId } = req.params; const { userId, username, displayName, profileImageUrl } = req.user;
    try {
        const { data: existingLike, error: findError } = await supabase.from('review_likes').select('id').match({ user_id: userId, review_id: reviewId }).maybeSingle(); if (findError && findError.code !== 'PGRST116') throw findError;
        const { data: review, error: reviewError } = await supabase.from('reviews').select('likes_count, user_id, location_id, comment').eq('id', reviewId).single(); if (reviewError || !review) return res.status(404).json({ error: 'Review not found' });
        let currentLikes = Number(review.likes_count || 0); let status;
        if (existingLike) { await supabase.from('review_likes').delete().match({ id: existingLike.id }); currentLikes = Math.max(0, currentLikes - 1); status = 'unliked'; }
        else { await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId }); currentLikes += 1; status = 'liked'; if (review.user_id !== userId) { let { data: location } = await supabase.from('attractions').select('id, name, image_url').eq('id', review.location_id).maybeSingle(); if (!location) { ({ data: location } = await supabase.from('foodShops').select('id, name, image_url').eq('id', review.location_id).maybeSingle()); } if (location) { createAndSendNotification({ type: 'new_like', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl, recipientId: review.user_id, payload: { location: {id: location.id, name: location.name, imageUrl: location.image_url}, commentSnippet: review.comment ? review.comment.substring(0, 50) : '', reviewId: reviewId } }); } else { console.warn(`Could not find location ${review.location_id} for like notification.`); } } }
        const { data: updatedReview, error: updateError } = await supabase.from('reviews').update({ likes_count: currentLikes }).eq('id', reviewId).select('likes_count').single(); if (updateError) throw updateError;
        res.json({ status: status, likesCount: updatedReview.likes_count });
    } catch (err) { console.error(`Error toggling like for review ${reviewId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการกดไลค์รีวิว' }); }
});


// --- REVIEW COMMENTS ---
// (Endpoints for comments: GET by review, POST, DELETE, POST toggle like)
app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { reviewId } = req.params;
    try {
        const { data, error } = await supabase.from('review_comments').select(`*, user_profile:user_id ( profile_image_url )`).eq('review_id', reviewId).order('created_at', { ascending: true });
        if (error) { console.error(`Supabase error fetching comments for review ${reviewId}:`, error); throw error; }
        const formattedComments = (data || []).map(comment => formatRowForFrontend(comment));
        res.json(formattedComments);
    } catch (err) { console.error(`Error processing comments request for review ${reviewId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคิดเห็น' }); }
});
app.post('/api/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
    const { reviewId } = req.params; const { comment } = req.body; const { userId, username, displayName, profileImageUrl } = req.user;
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'เนื้อหาคอมเมนต์ห้ามว่างเปล่า' });
    try {
        const newComment = { id: crypto.randomUUID(), review_id: reviewId, user_id: userId, author: displayName || username, comment: comment.trim(), likes_count: 0 };
        const { data: insertedComment, error } = await supabase.from('review_comments').insert(newComment).select().single(); if (error) throw error;
        const { data: review } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
        if (review && review.user_id !== userId) { let { data: location } = await supabase.from('attractions').select('id, name, image_url').eq('id', review.location_id).maybeSingle(); if (!location) { ({ data: location } = await supabase.from('foodShops').select('id, name, image_url').eq('id', review.location_id).maybeSingle()); } if (location) { createAndSendNotification({ type: 'new_reply', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl, recipientId: review.user_id, payload: { location: {id: location.id, name: location.name, imageUrl: location.image_url}, commentSnippet: comment.trim().substring(0, 50), reviewId: reviewId, commentId: insertedComment.id } }); } else { console.warn(`Could not find location ${review.location_id} for reply notification.`); } }
        const formattedComment = formatRowForFrontend({ ...insertedComment, user_profile: { profile_image_url: profileImageUrl } });
        res.status(201).json(formattedComment);
    } catch (err) { console.error("Error creating comment:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกคอมเมนต์' }); }
});
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
    const { commentId } = req.params; const { userId, role } = req.user;
    try {
        const { data: comment, error: fetchError } = await supabase.from('review_comments').select('user_id').eq('id', commentId).single(); if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; if (!comment) return res.status(404).json({ error: 'ไม่พบความคิดเห็นที่ต้องการลบ' });
        if (comment.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบความคิดเห็นนี้' });
        await supabase.from('comment_likes').delete().eq('comment_id', commentId);
        const { error: deleteError } = await supabase.from('review_comments').delete().eq('id', commentId); if (deleteError) throw deleteError;
        res.status(204).send();
    } catch (err) { console.error('Error deleting comment:', err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบความคิดเห็น' }); }
});
app.post('/api/comments/:commentId/toggle-like', authenticateToken, async (req, res) => {
    const { commentId } = req.params; const { userId, username, displayName, profileImageUrl } = req.user;
    try {
        const { data: comment, error: commentError } = await supabase.from('review_comments').select('user_id, review_id, comment, likes_count').eq('id', commentId).single(); if (commentError || !comment) return res.status(404).json({ error: 'Comment not found.' });
        const { data: existingLike, error: findError } = await supabase.from('comment_likes').select('id').match({ user_id: userId, comment_id: commentId }).maybeSingle(); if (findError && findError.code !== 'PGRST116') throw findError;
        let currentLikes = Number(comment.likes_count || 0); let status;
        if (existingLike) { await supabase.from('comment_likes').delete().match({ id: existingLike.id }); currentLikes = Math.max(0, currentLikes - 1); status = 'unliked'; }
        else { await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId }); currentLikes += 1; status = 'liked'; if (comment.user_id !== userId) { const { data: review } = await supabase.from('reviews').select('location_id').eq('id', comment.review_id).single(); if (review) { let { data: location } = await supabase.from('attractions').select('id, name, image_url').eq('id', review.location_id).maybeSingle(); if (!location) { ({ data: location } = await supabase.from('foodShops').select('id, name, image_url').eq('id', review.location_id).maybeSingle()); } if (location) { createAndSendNotification({ type: 'new_comment_like', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl, recipientId: comment.user_id, payload: { location: {id: location.id, name: location.name, imageUrl: location.image_url}, commentSnippet: comment.comment ? comment.comment.substring(0, 50) : '', reviewId: comment.review_id, commentId: commentId } }); } else { console.warn(`Could not find location ${review.location_id} for comment like notification.`); } } } }
        const { data: updatedComment, error: updateError } = await supabase.from('review_comments').update({ likes_count: currentLikes }).eq('id', commentId).select('likes_count').single(); if (updateError) throw updateError;
        res.json({ status, likesCount: updatedComment.likes_count });
    } catch (err) { console.error(`Error toggling like for comment ${commentId}:`, err); res.status(500).json({ error: 'Failed to toggle like on comment.' }); }
});


// --- AUTHENTICATION ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !username.trim() || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    if (password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, A-Z, 0-9, _)' });

    try {
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', username.trim()).maybeSingle();
        if (existingUser) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: crypto.randomUUID(), username: username.trim(), display_name: username.trim(), password: hashedPassword, role: 'user' };
        const { error } = await supabase.from('users').insert(newUser);
        if (error) throw error;
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (err) { console.error("Error during registration:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });

    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) { console.log(`Login attempt failed for user: ${username}. Reason: User not found or DB error.`); return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const formattedUser = formatRowForFrontend(user);
            const token = jwt.sign({ userId: formattedUser.id, username: formattedUser.username, displayName: formattedUser.displayName, role: formattedUser.role, profileImageUrl: formattedUser.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.json({ message: 'เข้าสู่ระบบสำเร็จ!', user: formattedUser, token });
        } else { console.log(`Login attempt failed for user: ${username}. Reason: Incorrect password.`); res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); }
    } catch (err) { console.error("Error during login:", err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }); }
});


// --- FAVORITES ---
// (Endpoints for favorites: GET list of IDs, POST toggle)
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    try {
        const { data, error } = await supabase.from('favorites').select('location_id').eq('user_id', userId);
        if (error) throw error;
        const favoriteIds = (data || []).map(fav => fav.location_id);
        res.json(favoriteIds);
    } catch (err) { console.error(`Error fetching favorites for user ${userId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการโปรด' }); }
});
app.post('/api/favorites/toggle', authenticateToken, async (req, res) => {
    const { locationId } = req.body; const { userId } = req.user;
    if (!locationId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (locationId is missing)' });
    try {
        const { data: existing, error: findError } = await supabase.from('favorites').select('id').match({ user_id: userId, location_id: locationId }).maybeSingle();
        if (findError && findError.code !== 'PGRST116') throw findError;
        if (existing) { const { error: deleteError } = await supabase.from('favorites').delete().match({ id: existing.id }); if (deleteError) throw deleteError; res.json({ status: 'removed' }); }
        else { const { error: insertError } = await supabase.from('favorites').insert({ user_id: userId, location_id: locationId }); if (insertError) throw insertError; res.json({ status: 'added' }); }
    } catch (err) { console.error(`Error toggling favorite for user ${userId}, location ${locationId}:`, err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรายการโปรด' }); }
});


// --- START SERVER ---
app.listen(port, () => {
    // Log the actual port the server is listening on
    console.log(`✅✅✅ SERVER (SUPABASE STORAGE + JOIN FIX 3 + OPTIONS FIX) IS RUNNING at http://localhost:${port}`);
});

