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

console.log('--- SERVER WITH SUPABASE STORAGE (v21.3 - Migration Fix) LOADING ---'); // Updated version note

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
    // console.warn(`Could not extract coordinates from Google Maps URL: ${url}`); // Maybe too noisy
    return { lat: null, lng: null };
};

// --- HELPER: Determine table based on category ---
// *** NEW HELPER FUNCTION ADDED HERE ***
const foodShopCategories = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'];
/**
 * Determines the correct Supabase table name based on the location category.
 * @param {string} category - The category of the location (e.g., 'วัด', 'ร้านอาหาร').
 * @returns {string} The name of the table ('attractions' or 'foodShops').
 */
const getLocationTableByCategory = (category) => {
    // ถ้า category อยู่ใน list ของ foodShopCategories, ให้ใช้ตาราง 'foodShops'
    // นอกนั้นให้ใช้ 'attractions' ทั้งหมด
    return foodShopCategories.includes(category) ? 'foodShops' : 'attractions';
};
// *** END OF NEW HELPER FUNCTION ***


// --- NOTIFICATION HANDLING ---
async function createAndSendNotification({ type, actorId, actorName, actorProfileImageUrl, recipientId, payload }) {
    try {
        const liveNotification = {
            id: crypto.randomUUID(),
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl,
            type: type,
            payload: payload, // Send full payload live
            is_read: false,
            created_at: new Date().toISOString(),
        };
        const dbNotificationPayload = {};
        if (payload.location) {
            dbNotificationPayload.locationId = payload.location.id;
            dbNotificationPayload.locationName = payload.location.name;
            dbNotificationPayload.locationImageUrl = payload.location.imageUrl; // Add image URL for location
        }
        if (payload.product) {
            dbNotificationPayload.productId = payload.product.id;
            dbNotificationPayload.productName = payload.product.name;
            dbNotificationPayload.productImageUrl = payload.product.imageUrl; // Add image URL for product
        }
        if (payload.reviewId) dbNotificationPayload.reviewId = payload.reviewId;
        if (payload.commentId) dbNotificationPayload.commentId = payload.commentId;
        if (payload.commentSnippet) dbNotificationPayload.commentSnippet = payload.commentSnippet;
        const dbNotification = {
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl, // Store actor image
            type: type,
            payload: dbNotificationPayload, // Store simplified payload
            is_read: false,
        };
        // Send notification to a specific recipient (if not the actor themselves)
        if (recipientId && recipientId !== actorId) {
            await supabase.from('notifications').insert({ ...dbNotification, user_id: recipientId });
        }
        // Handle broadcast notifications (e.g., for new locations)
        else if (!recipientId) {
            if (type === 'new_location') {
                const { data: users, error: userFetchError } = await supabase.from('users').select('id').neq('id', actorId); // Don't notify the actor
                if (userFetchError) {
                    console.error("Error fetching users for broadcast:", userFetchError);
                    // Decide if we should proceed or throw
                    // For now, just log and continue without broadcasting
                } else if (users && users.length > 0) {
                    const notificationsToInsert = users.map(user => ({ ...dbNotification, user_id: user.id }));
                    await supabase.from('notifications').insert(notificationsToInsert);
                    console.log(`Broadcasted '${type}' notification to ${users.length} users.`);
                }
            } else {
                // Log if a type is marked for broadcast but not handled
                // console.log(`Notification type '${type}' not configured for broadcast.`);
            }
        }
        // Send the live notification via SSE
        const liveEventPayload = { type: 'notification', data: liveNotification };
        clients.forEach(client => {
            try {
                // Send to specific recipient OR broadcast (excluding sender)
                if (recipientId) { // Direct notification
                    if (client.userId === recipientId && client.userId !== actorId) {
                        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                    }
                } else if (type === 'new_location') { // Broadcast notification
                    if (client.userId !== actorId) { // Don't send to the person who triggered it
                        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                    }
                }
            } catch (e) {
                // Handle errors writing to a specific client (likely disconnected)
                console.error(`Error writing SSE for client ${client.id}:`, e);
                // Remove the failed client from the active list
                clients = clients.filter(c => c.id !== client.id);
                console.log(`Client ${client.id} removed due to write error. Remaining: ${clients.length}`);
            }
        });
    } catch (error) {
        // Catch errors during DB insertion or user fetching
        console.error('Error creating/sending notification:', error);
    }
}


// --- SERVER-SENT EVENTS (SSE) SETUP ---
// Sends heartbeats to keep connections alive and handles new client connections
const sendHeartbeat = () => {
    clients.forEach(client => {
        try {
            client.res.write(':keep-alive\n\n'); // Send comment line as heartbeat
        } catch (e) {
            // If writing fails, assume client disconnected
            console.error(`Heartbeat failed for client ${client.id}:`, e);
            clients = clients.filter(c => c.id !== client.id); // Remove client
            console.log(`Client ${client.id} disconnected (Heartbeat failed). Remaining clients: ${clients.length}`);
        }
    });
};
// Start sending heartbeats every 15 seconds
const heartbeatInterval = setInterval(sendHeartbeat, 15000);

// Endpoint for clients to establish an SSE connection
app.get('/api/events', authenticateToken, async (req, res) => {
    // Set headers required for SSE
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no' // Important for Nginx proxies
    };
    res.writeHead(200, headers); // Send headers immediately

    // Generate a unique ID for this client connection
    const clientId = Date.now() + Math.random();
    // Store client details (ID, response object, user ID)
    const newClient = { id: clientId, res: res, userId: req.user.userId };
    clients.push(newClient);
    console.log(`Client ${clientId} connected (User ${newClient.userId}). Total clients: ${clients.length}`);

    // Send a confirmation message to the client
    try {
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);
        // Send an initial comment line (can be used by client to confirm connection)
        res.write(':initial-connection\n\n');
    } catch (e) {
        // If initial write fails, remove the client immediately
        console.error(`Initial write failed for client ${clientId}:`, e);
        clients = clients.filter(client => client.id !== clientId);
        return; // Stop processing for this failed connection
    }

    // Attempt to send past notifications to the newly connected client
    try {
        const { data: pastNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId) // Only for this user
            .order('created_at', { ascending: false }) // Newest first
            .limit(20); // Limit the number of past notifications

        if (error) throw error; // Handle Supabase errors

        if (pastNotifications && pastNotifications.length > 0) {
            const payload = { type: 'historic_notifications', data: pastNotifications };
            // Check if client is still connected before writing
            if (clients.some(c => c.id === clientId)) {
                try {
                    newClient.res.write(`data: ${JSON.stringify(payload)}\n\n`);
                } catch (e) {
                    // Handle write error if client disconnected between check and write
                    console.error(`Error writing historic notifications for ${clientId}:`, e);
                    clients = clients.filter(client => client.id !== clientId); // Remove client
                }
            }
        }
    } catch (err) {
        // Log error fetching past notifications but don't disconnect the client
        console.error(`[SSE ERROR] Could not fetch past notifications for user ${req.user.userId}:`, err);
    }

    // Handle client disconnection
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId); // Remove client from list
        console.log(`Client ${clientId} disconnected. Remaining clients: ${clients.length}`);
    });

    // Note: Do not call res.end() here, as SSE requires the connection to stay open.
});


// --- API Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '21.3', database: 'supabase_storage' }));

// --- USER PROFILE ---
// GET user profile details
app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, display_name, profile_image_url, role') // Select specific fields
            .eq('id', userId)
            .single(); // Expect one or zero results

        // Handle database errors (excluding 'not found')
        if (error && error.code !== 'PGRST116') throw error;
        // Handle user not found specifically
        if (!user) return res.status(404).json({ error: 'User not found.' });

        // Format and send user data
        res.json(formatRowForFrontend(user));
    } catch (err) {
        console.error(`Error fetching user profile ${userId}:`, err);
        // Return 404 if error was 'not found', otherwise 500
        if (err.code === 'PGRST116') return res.status(404).json({ error: 'User not found.' });
        res.status(500).json({ error: 'Could not fetch user profile.' });
    }
});

// PUT update user profile (requires authentication)
app.put('/api/users/:userIdToUpdate', authenticateToken, upload.single('profileImage'), async (req, res) => {
    const { userIdToUpdate } = req.params; // ID of the user to update
    const { userId: authenticatedUserId, role } = req.user; // ID and role of the logged-in user

    // Authorization: Allow update only if user is updating their own profile OR is an admin
    if (userIdToUpdate !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขโปรไฟล์นี้' });
    }

    const { displayName, currentPassword, newPassword, username } = req.body;
    let newImageUrl = null; // To track if a new image was uploaded for potential cleanup on error

    try {
        // Fetch the current user data for validation and comparison
        const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('id', userIdToUpdate).single();
        if (fetchError || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

        const updateData = {}; // Object to store fields to be updated

        // Password/Username Change Validation: Require current password if changing username or password
        if (newPassword || (username && username.trim() !== user.username)) {
            if (!currentPassword) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง' });
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        }

        // Handle Display Name Update: Propagate change to related tables (reviews, comments)
        if (displayName && displayName.trim() !== user.display_name) {
            updateData.display_name = displayName.trim();
            // Update author name in reviews and comments concurrently
            await Promise.allSettled([
                supabase.from('reviews').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate),
                supabase.from('review_comments').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate)
            ]).then(results => results.forEach((result, i) => result.status === 'rejected' && console.error(`Failed to update author name in ${i === 0 ? 'reviews' : 'comments'}:`, result.reason)));
        }

        // Handle Username Update: Check for uniqueness and basic validation
        if (username && username.trim() !== user.username) {
            const trimmedUsername = username.trim();
            // Check if the new username is already taken by another user
            const { data: existingUser } = await supabase.from('users').select('id').eq('username', trimmedUsername).maybeSingle();
            if (existingUser && existingUser.id !== userIdToUpdate) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
            // Basic username format validation (example: 3-20 alphanumeric chars + underscore)
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, A-Z, 0-9, _)' });
            updateData.username = trimmedUsername;
        }

        // Handle Password Update: Hash the new password
        if (newPassword) {
            if (newPassword.length < 6) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        // Handle Profile Image Update: Delete old, upload new
        if (req.file) {
            await deleteFromSupabase(user.profile_image_url); // Delete old image(s)
            newImageUrl = await uploadToSupabase(req.file); // Upload new one
            updateData.profile_image_url = [newImageUrl]; // Store as array (assuming DB schema expects array)
        }

        // If no data was actually changed, return current info with a message
        if (Object.keys(updateData).length === 0) {
            const currentFormattedUser = formatRowForFrontend(user);
            // Reissue token in case some info changed implicitly (though unlikely here)
            const token = jwt.sign({ userId: currentFormattedUser.id, username: currentFormattedUser.username, displayName: currentFormattedUser.displayName, role: currentFormattedUser.role, profileImageUrl: currentFormattedUser.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต', user: currentFormattedUser, token });
        }

        // Perform the database update
        const { data: updatedUserResult, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userIdToUpdate)
            .select('id, username, display_name, profile_image_url, role') // Select updated fields
            .single();

        if (updateError) throw updateError; // Handle DB update errors

        // Generate a new JWT token containing the updated user information
        const formattedUpdatedUser = formatRowForFrontend(updatedUserResult);
        const token = jwt.sign({
            userId: formattedUpdatedUser.id,
            username: formattedUpdatedUser.username,
            displayName: formattedUpdatedUser.displayName,
            role: formattedUpdatedUser.role,
            profileImageUrl: formattedUpdatedUser.profileImageUrl // Include potentially updated image URL
        }, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Send success response with updated user data and new token
        res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ!', user: formattedUpdatedUser, token });

    } catch (err) {
        console.error(`[ERROR] Updating profile for ${userIdToUpdate}:`, err);
        // If update failed after uploading a new image, try to delete the newly uploaded image
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});

// DELETE user account (requires authentication and current password)
app.delete('/api/users/:userIdToDelete', authenticateToken, async (req, res) => {
    const { userIdToDelete } = req.params; // ID of user to delete
    const { userId: authenticatedUserId, role } = req.user; // ID/role of logged-in user
    const { currentPassword } = req.body; // Password confirmation required

    // Authorization: User can delete own account, or admin can delete any account
    if (userIdToDelete !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบบัญชีนี้' });
    }
    // Password is required for confirmation
    if (!currentPassword) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ' });
    }

    try {
        // Fetch user to verify password and get profile image URL for deletion
        const { data: user, error: fetchError } = await supabase.from('users').select('password, profile_image_url').eq('id', userIdToDelete).single();
        if (fetchError || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

        // Verify the provided current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

        // Delete profile image from storage
        await deleteFromSupabase(user.profile_image_url);

        // --- Delete related user data ---
        // Consider using CASCADE DELETE in your database schema for simplicity if possible.
        // Otherwise, delete related records manually in the correct order.
        console.log(`Starting deletion process for user ${userIdToDelete}...`);
        // Delete likes given by the user
        await supabase.from('review_likes').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted review likes for user ${userIdToDelete}.`);
        await supabase.from('comment_likes').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted comment likes for user ${userIdToDelete}.`);
        // Delete comments made by the user
        await supabase.from('review_comments').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted review comments for user ${userIdToDelete}.`);
        // Delete reviews made by the user
        await supabase.from('reviews').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted reviews for user ${userIdToDelete}.`);
        // Delete favorites of the user
        await supabase.from('favorites').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted favorites for user ${userIdToDelete}.`);
        // Delete items created by the user (if applicable and desired)
        // Ensure user_id column exists and cascading isn't handled elsewhere
        await supabase.from('famous_products').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted famous products created by user ${userIdToDelete}.`);
        await supabase.from('attractions').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted attractions created by user ${userIdToDelete}.`);
        await supabase.from('foodShops').delete().eq('user_id', userIdToDelete);
        console.log(`Deleted foodShops created by user ${userIdToDelete}.`);

        // Finally, delete the user record itself
        const { error: userDeleteError } = await supabase.from('users').delete().eq('id', userIdToDelete);
        if (userDeleteError) throw userDeleteError; // Handle potential error deleting the user
        console.log(`Successfully deleted user record for ${userIdToDelete}.`);

        // Send success response
        res.json({ message: 'ลบบัญชีผู้ใช้สำเร็จ' });

    } catch(err) {
        console.error(`[ERROR] Deleting account for ${userIdToDelete}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดระหว่างการลบบัญชี' });
    }
});


// --- NOTIFICATIONS ---
// GET notifications for the logged-in user
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false }) // Newest first
            .limit(20); // Limit results
        if (error) throw error;
        res.json(data); // Send raw notification data (formatting done on frontend)
    } catch (err) {
        console.error(`Error fetching notifications for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch notifications.' });
    }
});

// GET count of unread notifications for the logged-in user
app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
    try {
        // Use count aggregation for efficiency
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true }) // head: true prevents fetching data
            .eq('user_id', req.user.userId)
            .eq('is_read', false); // Filter for unread
        if (error) throw error;
        res.json({ count: count || 0 }); // Return count (or 0 if null)
    } catch (err) {
        console.error(`Error fetching unread count for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch unread count.' });
    }
});

// POST mark all unread notifications as read for the logged-in user
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true }) // Set is_read to true
            .eq('user_id', req.user.userId) // For the current user
            .eq('is_read', false); // Only update currently unread ones
        if (error) throw error;
        res.status(200).json({ message: 'Notifications marked as read.' });
    } catch (err) {
        console.error(`Error marking notifications read for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not mark notifications as read.' });
    }
});


// --- FAMOUS PRODUCTS ---
// GET all famous products (Admin only, includes location name)
app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    const locationMap = new Map(); // To map location IDs to names
    let products = [];
    try {
        // Fetch location names efficiently
        const [attractionsRes, foodShopsRes] = await Promise.all([
            supabase.from('attractions').select('id, name'),
            supabase.from('foodShops').select('id, name')
        ]);
        // Populate the map, ignoring potential errors for individual fetches
        if (attractionsRes.error) console.error("Error fetching attractions for product map:", attractionsRes.error);
        else (attractionsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
        if (foodShopsRes.error) console.error("Error fetching foodShops for product map:", foodShopsRes.error);
        else (foodShopsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
    } catch (err) {
        console.error("CRITICAL Error fetching locations for product mapping:", err);
    }
    // Fetch all famous products
    try {
        const { data: fetchedProducts, error: productsError } = await supabase.from('famous_products').select('*');
        if (productsError) throw productsError;
        products = fetchedProducts || [];
    } catch (err) {
        console.error("Error fetching famous products:", err);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
    // Add locationName to each product and format
    const productsWithLocation = products.map(product => {
        const formatted = formatRowForFrontend(product);
        return {
            ...formatted,
            locationName: product.location_id ? locationMap.get(product.location_id) || 'ไม่พบสถานที่' : 'ส่วนกลาง'
        };
    });
    res.json(productsWithLocation);
});

// GET random famous products (not associated with a location)
app.get('/api/famous-products/random', async (req, res) => {
    try {
        const { data, error } = await supabase.from('famous_products').select('*').is('location_id', null);
        if (error) throw error;
        // Shuffle the results and take the first 2
        const shuffled = (data || []).sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 2).map(formatRowForFrontend));
    } catch (err) {
        console.error("Error fetching random famous products:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

// GET a specific famous product by ID
app.get('/api/famous-products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: product, error } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!product) return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' });
        res.json(formatRowForFrontend(product));
    } catch (err) {
        console.error(`Error fetching famous product ${id}:`, err);
        if (err.code === 'PGRST116') return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' });
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

// POST create a new famous product (requires authentication)
app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    const { userId, displayName, username } = req.user; // Get creator info
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    let imageUrl = null;
    try {
        imageUrl = await uploadToSupabase(req.file); // Upload image
        const newProduct = {
            id: crypto.randomUUID(),
            name: name.trim(),
            description: description ? description.trim() : '',
            imageurl: imageUrl, // Column name in DB
            location_id: locationId || null, // Allow associating with location or not
            user_id: userId // Associate with the creator
        };
        const { data, error } = await supabase.from('famous_products').insert(newProduct).select().single();
        if (error) throw error;
        // Optionally send notification
        // createAndSendNotification({ type: 'new_product', ... });
        res.status(201).json(formatRowForFrontend(data));
    } catch (err) {
        console.error("Error creating product:", err);
        if(imageUrl) await deleteFromSupabase(imageUrl); // Cleanup uploaded image on error
        res.status(500).json({ error: `Failed to create product: ${err.message}` });
    }
});

// PUT update a famous product (requires authentication, owner or admin)
app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body; // Only allow updating these fields via this route
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
        if (req.file) { // Handle image update
            await deleteFromSupabase(product.imageurl);
            newImageUrl = await uploadToSupabase(req.file);
            updateData.imageurl = newImageUrl;
        }
        if (Object.keys(updateData).length > 0) {
            const { data: updatedProduct, error: updateError } = await supabase.from('famous_products').update(updateData).eq('id', id).select().single();
            if (updateError) throw updateError;
            res.json(formatRowForFrontend(updatedProduct));
        } else {
            // If nothing to update, return current data (fetch again to be sure)
            const { data: currentProduct, error: currentError } = await supabase.from('famous_products').select('*').eq('id', id).single();
            if(currentError) throw currentError;
            res.json(formatRowForFrontend(currentProduct));
        }
    } catch (err) {
        console.error(`Error updating product ${id}:`, err);
        if (newImageUrl) await deleteFromSupabase(newImageUrl); // Cleanup
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

// DELETE a famous product (requires authentication, owner or admin)
app.delete('/api/famous-products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: product, error: fetchError } = await supabase.from('famous_products').select('user_id, imageurl').eq('id', id).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        await deleteFromSupabase(product.imageurl); // Delete image from storage
        const { error: deleteError } = await supabase.from('famous_products').delete().eq('id', id); // Delete DB record
        if (deleteError) throw deleteError;
        res.status(204).send(); // Success - No Content
    } catch (err) {
        console.error(`Error deleting product ${id}:`, err);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});


// --- LOCATIONS (Attractions & FoodShops) ---
// GET list of locations pending deletion (Admin only)
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [attractionsRes, foodShopsRes] = await Promise.all([
            supabase.from('attractions').select('*').eq('status', 'pending_deletion'),
            supabase.from('foodShops').select('*').eq('status', 'pending_deletion')
        ]);
        let allRequests = [];
        if (attractionsRes.error) console.error("Error fetching attraction deletion requests:", attractionsRes.error);
        else allRequests = allRequests.concat(attractionsRes.data || []);
        if (foodShopsRes.error) console.error("Error fetching foodShop deletion requests:", foodShopsRes.error);
        else allRequests = allRequests.concat(foodShopsRes.data || []);
        res.json(allRequests.map(formatRowForFrontend));
    } catch (err) {
        console.error("CRITICAL Error fetching deletion requests:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดร้ายแรงในการดึงคำขอลบ' });
    }
});

// POST deny a deletion request (Admin only) - set status back to 'approved'
app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    let updated = false;
    try {
        // Try updating in attractions
        const { data: attrData, error: attrError } = await supabase.from('attractions').update({ status: 'approved' }).match({ id: id, status: 'pending_deletion' }).select('id').maybeSingle();
        if (attrError && attrError.code !== 'PGRST116') throw attrError;
        if (attrData) updated = true;

        // If not updated in attractions, try foodShops
        if (!updated) {
            const { data: foodData, error: foodError } = await supabase.from('foodShops').update({ status: 'approved' }).match({ id: id, status: 'pending_deletion' }).select('id').maybeSingle();
            if (foodError && foodError.code !== 'PGRST116') throw foodError;
            if (foodData) updated = true;
        }

        if (!updated) return res.status(404).json({ message: 'ไม่พบคำขอลบสำหรับสถานที่นี้ หรือสถานะไม่ใช่ pending_deletion' });

        res.json({ message: 'ปฏิเสธการลบและคืนสถานะสถานที่เรียบร้อยแล้ว' });
    } catch (err) {
        console.error(`Error denying deletion for ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอลบ' });
    }
});

// GET all approved attractions
app.get('/api/attractions', async (req, res) => {
    try {
        let query = supabase.from('attractions').select('*').eq('status', 'approved');
        // Optional sorting by rating
        if (req.query.sortBy === 'rating') {
            query = query.order('rating', { ascending: false, nullsFirst: false });
        } else {
            query = query.order('name', { ascending: true }); // Default sort by name
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) {
        console.error("Error fetching attractions:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่ท่องเที่ยว' });
    }
});

// GET all approved foodShops
app.get('/api/foodShops', async (req, res) => {
    try {
        let query = supabase.from('foodShops').select('*').eq('status', 'approved');
        // Optional sorting by rating
        if (req.query.sortBy === 'rating') {
            query = query.order('rating', { ascending: false, nullsFirst: false });
        } else {
            query = query.order('name', { ascending: true }); // Default sort by name
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) {
        console.error("Error fetching foodShops:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร' });
    }
});

// GET similar locations (same category, excluding self)
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
        const combined = [...(attractionsResult.data || []), ...(foodShopsResult.data || [])];
        // Shuffle and limit to 5
        const shuffled = combined.sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 5).map(formatRowForFrontend));
    } catch (err) {
        console.error(`Error fetching locations in category ${category}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสถานที่ในหมวดหมู่เดียวกัน' });
    }
});

// GET famous products associated with a specific location
app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { locationId } = req.params;
    try {
        const { data, error } = await supabase.from('famous_products').select('*').eq('location_id', locationId);
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) {
        console.error(`Error fetching famous products for location ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

// GET details for a specific location (checks both attractions and foodShops)
app.get('/api/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let location = null, error = null;
        // Try attractions first
        ({ data: location, error } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle());
        if (error && error.code !== 'PGRST116') throw error;
        // If not found in attractions, try foodShops
        if (!location) {
            ({ data: location, error } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle());
            if (error && error.code !== 'PGRST116') throw error;
        }
        if (location) res.json(formatRowForFrontend(location));
        else res.status(404).json({ error: 'ไม่พบสถานที่' });
    } catch (err) {
        console.error(`Error fetching location ${id}:`, err);
        if (err.code !== 'PGRST116') res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' });
        else res.status(404).json({ error: 'ไม่พบสถานที่' });
    }
});

// POST create a new location (requires authentication, uploads images)
app.post('/api/locations', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { name, category, description, googleMapUrl, hours, contact } = req.body;
    const { userId, displayName, username } = req.user; // Get creator info
    if (!name || !name.trim() || !category) return res.status(400).json({ error: 'กรุณากรอกชื่อและหมวดหมู่' });
    let uploadedImageUrls = [];
    try {
        // Upload images concurrently
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        uploadedImageUrls = await Promise.all(uploadPromises);
        const coords = extractCoordsFromUrl(googleMapUrl);
        const newLocationData = {
            id: crypto.randomUUID(), name: name.trim(), category,
            description: description ? description.trim() : '',
            google_map_url: googleMapUrl || null, hours: hours || '', contact: contact || '',
            user_id: userId, status: 'approved', // Default status
            image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, // First as main
            detail_images: uploadedImageUrls.length > 1 ? uploadedImageUrls.slice(1) : [], // Rest as details
            lat: coords.lat, lng: coords.lng // Add coordinates
        };
        
        // *** UPDATED TO USE HELPER FUNCTION ***
        // Determine table based on category using the helper
        const tableName = getLocationTableByCategory(category);
        // *** END OF UPDATE ***

        // Insert into the correct table
        const { data: insertedLocation, error } = await supabase.from(tableName).insert(newLocationData).select().single();
        if (error) throw error;
        // Send notification about the new location
        createAndSendNotification({
            type: 'new_location',
            actorId: userId,
            actorName: displayName || username,
            actorProfileImageUrl: req.user.profileImageUrl, // Assuming profileImageUrl is in token payload
            recipientId: null, // Broadcast
            payload: { location: formatRowForFrontend(insertedLocation) }
        });
        res.status(201).json(formatRowForFrontend(insertedLocation));
    } catch (err) {
        console.error("Error creating location:", err);
        if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls); // Cleanup
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});

// *** THIS ENTIRE ENDPOINT IS REPLACED WITH NEW LOGIC ***
// PUT update an existing location (requires authentication, owner or admin)
app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    // ดึง category มาในชื่อ newCategory เพื่อความชัดเจน
    const { name, category: newCategory, description, googleMapUrl, hours, contact, existingImages } = req.body;
    
    let newlyUploadedUrls = [];
    let finalUpdatedLocation; // ตัวแปรสำหรับเก็บผลลัพธ์สุดท้าย (ไม่ว่าจะ update หรือ move)

    try {
        // 1. ค้นหาสถานที่ปัจจุบัน และตารางปัจจุบัน
        let currentLocation = null, currentTableName = null, error = null;
        
        // ลองหาใน 'attractions' ก่อน
        ({ data: currentLocation, error } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle());
        if (error && error.code !== 'PGRST116') throw error; // ถ้า Error จริง ให้โยน
        
        if (currentLocation) {
            currentTableName = 'attractions';
        } else {
            // ถ้าไม่เจอ ลองหาใน 'foodShops'
            ({ data: currentLocation, error } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle());
            if (error && error.code !== 'PGRST116') throw error;

            if (currentLocation) {
                currentTableName = 'foodShops';
            } else {
                // ถ้าไม่เจอทั้งสองตาราง = 404
                return res.status(404).json({ error: 'ไม่พบสถานที่ที่ต้องการแก้ไข' });
            }
        }

        // 2. ตรวจสอบสิทธิ์ (Authorization)
        if (role !== 'admin' && currentLocation.user_id !== userId) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
        }

        // 3. จัดการรูปภาพ (ลบรูปเก่า, อัปโหลดรูปใหม่)
        const keptImageUrls = existingImages ? JSON.parse(existingImages) : [];
        const oldImageUrls = [currentLocation.image_url, ...(currentLocation.detail_images || [])].filter(Boolean);
        const imagesToDelete = oldImageUrls.filter(oldUrl => !keptImageUrls.includes(oldUrl));
        
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        newlyUploadedUrls = await Promise.all(uploadPromises);
        
        await deleteFromSupabase(imagesToDelete); // ลบรูปที่ถูกเอาออกจาก storage
        const allFinalImageUrls = [...keptImageUrls, ...newlyUploadedUrls];

        // 4. เตรียมข้อมูลที่จะอัปเดต (updateData)
        const updateData = {};
        const coords = extractCoordsFromUrl(googleMapUrl);
        
        // เพิ่มเฉพาะ field ที่มีการส่งค่ามา (undefined จะถูกข้ามไป)
        if (name !== undefined) updateData.name = name.trim();
        if (newCategory !== undefined) updateData.category = newCategory;
        if (description !== undefined) updateData.description = description.trim();
        if (googleMapUrl !== undefined) {
            updateData.google_map_url = googleMapUrl;
            updateData.lat = coords.lat; // อัปเดต coords ถ้า URL เปลี่ยน
            updateData.lng = coords.lng;
        }
        if (hours !== undefined) updateData.hours = hours.trim();
        if (contact !== undefined) updateData.contact = contact.trim();
        
        // อัปเดต field รูปภาพเสมอ (แม้จะเป็น array ว่าง)
        updateData.image_url = allFinalImageUrls.length > 0 ? allFinalImageUrls[0] : null;
        updateData.detail_images = allFinalImageUrls.length > 1 ? allFinalImageUrls.slice(1) : [];

        // 5. --- โลจิกการย้ายตาราง (Migration Logic) ---
        
        // หาว่าตาราง "ใหม่" ที่ควรจะอยู่คือตารางไหน
        // ถ้ามีการส่ง category ใหม่มา ก็ใช้ค่านั้น, ถ้าไม่ ก็ใช้ค่าเดิมจาก currentLocation
        const effectiveCategory = updateData.category || currentLocation.category;
        const newTableName = getLocationTableByCategory(effectiveCategory);

        if (currentTableName === newTableName) {
            // --- กรณีที่ 1: ตารางไม่เปลี่ยน ---
            // อัปเดตข้อมูลในตารางเดิม (in-place update)
            console.log(`Updating location ${id} in same table: ${currentTableName}`);
            const { data, error: updateError } = await supabase
                .from(currentTableName)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (updateError) throw updateError;
            finalUpdatedLocation = data; // เก็บผลลัพธ์

        } else {
            // --- กรณีที่ 2: ตารางเปลี่ยน! (ย้ายตาราง) ---
            // ต้อง INSERT (ในตารางใหม่) แล้ว DELETE (จากตารางเก่า)
            console.log(`Moving location ${id} from ${currentTableName} to ${newTableName}`);
            
            // 1. สร้างข้อมูล record ใหม่ทั้งหมด โดยเอาข้อมูลเก่า (currentLocation) มารวมกับข้อมูลที่อัปเดต (updateData)
            const migratedRecord = { ...currentLocation, ...updateData };

            // 2. INSERT ข้อมูลใหม่ลงในตารางใหม่
            const { data: insertedLocation, error: insertError } = await supabase
                .from(newTableName)
                .insert(migratedRecord)
                .select()
                .single();
            
            if (insertError) {
                console.error(`Failed to INSERT location ${id} into ${newTableName}:`, insertError);
                // ถ้า Insert ล้มเหลว ให้โยน Error เลย (จะได้ไม่ไปลบของเก่า)
                throw new Error('Failed to move location (insert step).');
            }

            // 3. (ถ้า Insert สำเร็จ) DELETE ข้อมูลเก่าออกจากตารางเดิม
            const { error: deleteError } = await supabase
                .from(currentTableName)
                .delete()
                .eq('id', id);
            
            if (deleteError) {
                // นี่คือเคสที่อันตราย: เราสร้างของใหม่สำเร็จ แต่ลบของเก่าไม่สำเร็จ (ข้อมูลซ้ำซ้อน)
                // ต้องแจ้งเตือนใน log แต่ไม่ควรโยน Error ให้ user เพราะการย้ายสำเร็จไปแล้ว
                console.error(`CRITICAL: Failed to DELETE location ${id} from ${currentTableName} after moving. Manual cleanup required!`, deleteError);
            }

            finalUpdatedLocation = insertedLocation; // เก็บผลลัพธ์
        }
        
        // 6. ส่งข้อมูลที่อัปเดต/ย้าย สำเร็จ กลับไป
        res.json(formatRowForFrontend(finalUpdatedLocation));

    } catch (err) {
        console.error('Error updating location:', err);
        // ถ้าเกิด Error ระหว่างทาง และมีการอัปโหลดรูปใหม่ไปแล้ว ให้พยายามลบออก
        if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls); // Cleanup
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสถานที่' });
    }
});
// *** END OF REPLACED ENDPOINT ***


// POST request deletion for a location (owner or admin)
app.post('/api/locations/:id/request-deletion', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        // Find location and table
        let location = null, tableName = null, error = null;
        ({ data: location, error } = await supabase.from('attractions').select('user_id, status').eq('id', id).maybeSingle());
        if (error && error.code !== 'PGRST116') throw error;
        if (location) tableName = 'attractions';
        else {
            ({ data: location, error } = await supabase.from('foodShops').select('user_id, status').eq('id', id).maybeSingle());
            if (error && error.code !== 'PGRST116') throw error;
            if (location) tableName = 'foodShops';
            else return res.status(404).json({ error: 'Location not found.' });
        }
        // Authorization check
        if (location.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        // Prevent duplicate requests
        if (location.status === 'pending_deletion') return res.status(400).json({ error: 'คำขอลบได้ถูกส่งไปแล้ว' });
        // Update status
        const { error: updateError } = await supabase.from(tableName).update({ status: 'pending_deletion' }).eq('id', id);
        if (updateError) throw updateError;
        res.json({ message: 'ส่งคำขอลบเรียบร้อยแล้ว' });
    } catch (err) {
        console.error(`Error requesting deletion for ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอลบ' });
    }
});

// DELETE permanently delete a location (Admin only)
app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Find location and table to get image URLs
        let location = null, tableName = null, error = null;
        ({ data: location, error } = await supabase.from('attractions').select('image_url, detail_images').eq('id', id).maybeSingle());
        if (error && error.code !== 'PGRST116') throw error;
        if (location) tableName = 'attractions';
        else {
            ({ data: location, error } = await supabase.from('foodShops').select('image_url, detail_images').eq('id', id).maybeSingle());
            if (error && error.code !== 'PGRST116') throw error;
            if (location) tableName = 'foodShops';
            // If not found in either, still proceed to delete related data just in case
        }
        // Delete images from storage if found
        if (location) {
            const imagesToDelete = [location.image_url, ...(location.detail_images || [])].filter(Boolean);
            await deleteFromSupabase(imagesToDelete);
        }
        // Delete related data (relying on CASCADE DELETE is preferable if set up)
        // Manual deletion order: likes -> comments -> reviews -> famous_products -> favorites -> location
        console.log(`Starting full deletion for location ${id}...`);
        // Get review IDs for this location
        const { data: reviewIdsData } = await supabase.from('reviews').select('id').eq('location_id', id);
        const reviewIds = (reviewIdsData || []).map(r => r.id);
        if (reviewIds.length > 0) {
            // Get comment IDs for these reviews
            const { data: commentIdsData } = await supabase.from('review_comments').select('id').in('review_id', reviewIds);
            const commentIds = (commentIdsData || []).map(c => c.id);
            if (commentIds.length > 0) {
                await supabase.from('comment_likes').delete().in('comment_id', commentIds); // Delete comment likes
                console.log(`Deleted comment likes for location ${id}.`);
            }
            await supabase.from('review_comments').delete().in('review_id', reviewIds); // Delete comments
            console.log(`Deleted comments for location ${id}.`);
            await supabase.from('review_likes').delete().in('review_id', reviewIds); // Delete review likes
            console.log(`Deleted review likes for location ${id}.`);
        }
        await supabase.from('reviews').delete().eq('location_id', id); // Delete reviews
        console.log(`Deleted reviews for location ${id}.`);
        await supabase.from('famous_products').delete().eq('location_id', id); // Delete famous products
        console.log(`Deleted famous products for location ${id}.`);
        await supabase.from('favorites').delete().eq('location_id', id); // Delete favorites
        console.log(`Deleted favorites for location ${id}.`);
        // Delete the location itself from both tables (one will succeed, one will do nothing)
        const { error: deleteAttrError } = await supabase.from('attractions').delete().eq('id', id);
        const { error: deleteFoodError } = await supabase.from('foodShops').delete().eq('id', id);
        if (deleteAttrError && deleteAttrError.code !== 'PGRST116') console.error(`Error deleting from attractions: ${id}`, deleteAttrError);
        if (deleteFoodError && deleteFoodError.code !== 'PGRST116') console.error(`Error deleting from foodShops: ${id}`, deleteFoodError);
        console.log(`Completed deletion attempts for location ${id}.`);
        res.status(204).send(); // Success - No Content
    } catch (err) {
        console.error(`Error during full deletion of location ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสถานที่' });
    }
});


// --- REVIEWS ---
// GET reviews for a location (includes author profile image, like status if userId provided)
app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params;
    const { userId } = req.query; // Optional user ID for like status
    try {
        // Fetch reviews and join with users table to get profile image URL
        const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select(`*, user_profile:user_id ( profile_image_url )`) // Join and alias
            .eq('location_id', locationId)
            .order('created_at', { ascending: false }); // Show newest reviews first

        if (reviewsError) throw reviewsError;
        if (!reviewsData || reviewsData.length === 0) return res.json([]); // Return empty if no reviews

        const reviewIds = reviewsData.map(review => review.id);
        // Fetch comment counts for these reviews
        let commentCounts = {};
        try {
            const { data: comments, error: countError } = await supabase.from('review_comments').select('review_id').in('review_id', reviewIds);
            if (countError) throw countError;
            commentCounts = (comments || []).reduce((acc, comment) => {
                acc[comment.review_id] = (acc[comment.review_id] || 0) + 1;
                return acc;
            }, {});
        } catch (commentsError) {
            console.error(`Error fetching comment counts for reviews of ${locationId}:`, commentsError);
        }
        // Fetch likes by the requesting user (if userId provided)
        let likedReviewIds = new Set();
        if (userId) {
            try {
                const { data: likesData, error: likesError } = await supabase.from('review_likes').select('review_id').eq('user_id', userId).in('review_id', reviewIds);
                if (likesError) throw likesError;
                if (likesData) likedReviewIds = new Set(likesData.map(like => like.review_id));
            } catch (likesFetchError) {
                console.error(`Error fetching likes for user ${userId} on reviews of ${locationId}:`, likesFetchError);
            }
        }
        // Format reviews, add comment count and like status
        const formattedReviews = reviewsData.map(review => {
            const formatted = formatRowForFrontend(review);
            return { ...formatted, comments_count: commentCounts[review.id] || 0, user_has_liked: likedReviewIds.has(review.id) };
        });
        res.json(formattedReviews);
    } catch (err) {
        console.error(`Error processing reviews request for ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว' });
    }
});

// POST create a new review (requires authentication, uploads images)
app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params;
    const { rating, comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user; // Get user info from token
    // Validation
    const numericRating = parseInt(rating, 10);
    if (!rating || !comment || !comment.trim() || isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'กรุณากรอกคะแนน (1-5) และเนื้อหารีวิว' });
    }
    let uploadedImageUrls = [];
    try {
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        uploadedImageUrls = await Promise.all(uploadPromises);
        const newReview = {
            id: crypto.randomUUID(), location_id: locationId, user_id: userId,
            author: displayName || username, // Use display name if available
            rating: numericRating, comment: comment.trim(),
            image_urls: uploadedImageUrls, likes_count: 0
        };
        const { data: insertedReview, error: insertError } = await supabase.from('reviews').insert(newReview).select().single();
        if (insertError) throw insertError;
        // Recalculate average rating for the location
        const { data: allReviews, error: ratingError } = await supabase.from('reviews').select('rating').eq('location_id', locationId);
        if (!ratingError && allReviews) {
            const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
            const averageRating = allReviews.length > 0 ? (totalRating / allReviews.length).toFixed(1) : 0;
            // Update rating in both potential tables (ignore errors if one fails)
            await Promise.allSettled([
                supabase.from('attractions').update({ rating: averageRating }).eq('id', locationId),
                supabase.from('foodShops').update({ rating: averageRating }).eq('id', locationId)
            ]);
        } else if (ratingError) {
            console.error(`Error fetching ratings for recalculation on ${locationId}:`, ratingError);
        }
        // Send notification to location owner (implementation depends on how you link locations to owners)
        // const { data: locationOwner } = await supabase.from('locations').select('user_id').eq('id', locationId).single();
        // if (locationOwner && locationOwner.user_id !== userId) { createAndSendNotification({...}); }
        // Format response, adding profile image from token data for immediate display
        const formattedReview = formatRowForFrontend({ ...insertedReview, user_profile: { profile_image_url: profileImageUrl } });
        res.status(201).json(formattedReview);
    } catch (err) {
        console.error("Error creating review:", err);
        if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls); // Cleanup
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' });
    }
});

// PUT update an existing review (requires authentication, owner or admin)
app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comment, existingImages, locationId } = req.body; // locationId needed if rating changes
    const { userId, role, profileImageUrl } = req.user;
    let newlyUploadedUrls = [];
    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('user_id, location_id, image_urls, rating').eq('id', reviewId).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการแก้ไข' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });
        // Image Handling
        const keptImages = existingImages ? JSON.parse(existingImages) : [];
        const imagesToDelete = (review.image_urls || []).filter(url => !keptImages.includes(url));
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        newlyUploadedUrls = await Promise.all(uploadPromises);
        await deleteFromSupabase(imagesToDelete);
        const allFinalImageUrls = [...keptImages, ...newlyUploadedUrls];
        // Prepare update data
        const updateData = {};
        let ratingChanged = false;
        if (rating !== undefined) {
            const numericRating = parseInt(rating, 10);
            if (!isNaN(numericRating) && numericRating >= 1 && numericRating <= 5) {
                if (numericRating !== review.rating) ratingChanged = true;
                updateData.rating = numericRating;
            } else console.warn(`Invalid rating value received during update: ${rating}`);
        }
        if (comment !== undefined) updateData.comment = comment.trim();
        updateData.image_urls = allFinalImageUrls; // Always update image array
        // Perform update
        let updatedReviewData = null;
        if (Object.keys(updateData).length > 0) {
            const { data, error: updateError } = await supabase.from('reviews').update(updateData).eq('id', reviewId).select(`*`).single();
            if (updateError) throw updateError;
            updatedReviewData = data;
        } else { updatedReviewData = review; } // Use original data if nothing changed
        // Recalculate average rating if rating changed
        if (ratingChanged) {
            const effectiveLocationId = review.location_id || locationId;
            if (effectiveLocationId) {
                const { data: allReviews, error: ratingError } = await supabase.from('reviews').select('rating').eq('location_id', effectiveLocationId);
                if (!ratingError && allReviews) {
                    const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
                    const averageRating = allReviews.length > 0 ? (totalRating / allReviews.length).toFixed(1) : 0;
                    await Promise.allSettled([
                        supabase.from('attractions').update({ rating: averageRating }).eq('id', effectiveLocationId),
                        supabase.from('foodShops').update({ rating: averageRating }).eq('id', effectiveLocationId)
                    ]);
                } else if(ratingError) console.error(`Error fetching ratings for recalculation on ${effectiveLocationId}:`, ratingError);
            } else console.warn(`Could not recalculate rating for updated review ${reviewId} - locationId unknown.`);
        }
        // Format response, including profile image from token
        const formattedReview = formatRowForFrontend({ ...updatedReviewData, user_profile: { profile_image_url: profileImageUrl } });
        res.json(formattedReview);
    } catch (err) {
        console.error('Error updating review:', err);
        if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls); // Cleanup
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรีวิว' });
    }
});

// DELETE a review (requires authentication, owner or admin)
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, role } = req.user;
    const { locationId } = req.body; // Needed for rating recalc
    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('user_id, location_id, image_urls').eq('id', reviewId).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการลบ' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรีวิวนี้' });
        const effectiveLocationId = review.location_id || locationId;
        await deleteFromSupabase(review.image_urls); // Delete images
        // Delete related comments and likes (assuming CASCADE DELETE isn't set up)
        await supabase.from('review_comments').delete().eq('review_id', reviewId);
        await supabase.from('review_likes').delete().eq('review_id', reviewId);
        // Delete the review
        const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId);
        if (deleteError) throw deleteError;
        // Recalculate average rating
        if (effectiveLocationId) {
            const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('rating').eq('location_id', effectiveLocationId);
            if (!reviewsError && allReviews) {
                const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
                const averageRating = allReviews.length > 0 ? (totalRating / allReviews.length).toFixed(1) : 0;
                await Promise.allSettled([
                    supabase.from('attractions').update({ rating: averageRating }).eq('id', effectiveLocationId),
                    supabase.from('foodShops').update({ rating: averageRating }).eq('id', effectiveLocationId)
                ]);
            } else if(reviewsError) console.error(`Error fetching ratings for recalc after delete on ${effectiveLocationId}:`, reviewsError);
        } else console.warn(`Could not recalculate rating for deleted review ${reviewId} - locationId unknown.`);
        res.status(204).send(); // Success
    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบรีวิว' });
    }
});

// POST toggle like on a review (requires authentication)
app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;
    try {
        const { data: existingLike, error: findError } = await supabase.from('review_likes').select('id').match({ user_id: userId, review_id: reviewId }).maybeSingle();
        if (findError && findError.code !== 'PGRST116') throw findError;
        const { data: review, error: reviewError } = await supabase.from('reviews').select('likes_count, user_id, location_id, comment').eq('id', reviewId).single();
        if (reviewError || !review) return res.status(404).json({ error: 'Review not found' });
        let currentLikes = Number(review.likes_count || 0);
        let status;
        if (existingLike) { // Unlike
            await supabase.from('review_likes').delete().match({ id: existingLike.id });
            currentLikes = Math.max(0, currentLikes - 1);
            status = 'unliked';
        } else { // Like
            await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId });
            currentLikes += 1;
            status = 'liked';
            // Send notification if liking someone else's review
            if (review.user_id !== userId) {
                let location = null, locError = null;
                ({ data: location, error: locError } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle());
                if (!location && (!locError || locError.code === 'PGRST116')) {
                    ({ data: location, error: locError } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
                }
                if (location) {
                    createAndSendNotification({
                        type: 'new_like', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl,
                        recipientId: review.user_id,
                        payload: { location: formatRowForFrontend(location), commentSnippet: review.comment?.substring(0, 50) || '', reviewId: reviewId }
                    });
                } else console.warn(`Could not find location ${review.location_id} for like notification.`);
            }
        }
        // Update likes_count on the review
        const { data: updatedReview, error: updateError } = await supabase.from('reviews').update({ likes_count: currentLikes }).eq('id', reviewId).select('likes_count').single();
        if (updateError) throw updateError;
        res.json({ status: status, likesCount: updatedReview.likes_count });
    } catch (err) {
        console.error(`Error toggling like for review ${reviewId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการกดไลค์รีวิว' });
    }
});


// --- REVIEW COMMENTS ---
// GET comments for a specific review (includes author profile image)
app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { reviewId } = req.params;
    try {
        const { data, error } = await supabase
            .from('review_comments')
            .select(`*, user_profile:user_id ( profile_image_url )`) // Join for profile image
            .eq('review_id', reviewId)
            .order('created_at', { ascending: true }); // Show oldest comments first
        if (error) throw error;
        const formattedComments = (data || []).map(comment => formatRowForFrontend(comment));
        res.json(formattedComments);
    } catch (err) {
        console.error(`Error processing comments request for review ${reviewId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคิดเห็น' });
    }
});

// POST create a new comment on a review (requires authentication)
app.post('/api/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user;
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'เนื้อหาคอมเมนต์ห้ามว่างเปล่า' });
    try {
        const newComment = {
            id: crypto.randomUUID(), review_id: reviewId, user_id: userId,
            author: displayName || username, comment: comment.trim(), likes_count: 0
        };
        const { data: insertedComment, error } = await supabase.from('review_comments').insert(newComment).select().single();
        if (error) throw error;
        // Send notification to review author (if different user)
        const { data: review } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
        if (review && review.user_id !== userId) {
            let location = null, locError = null;
            ({ data: location, error: locError } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle());
            if (!location && (!locError || locError.code === 'PGRST116')) {
                ({ data: location, error: locError } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
            }
            if (location) {
                createAndSendNotification({
                    type: 'new_reply', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl,
                    recipientId: review.user_id,
                    payload: { location: formatRowForFrontend(location), commentSnippet: comment.trim().substring(0, 50), reviewId: reviewId, commentId: insertedComment.id }
                });
            } else console.warn(`Could not find location ${review.location_id} for reply notification.`);
        }
        // Format response, including profile image from token
        const formattedComment = formatRowForFrontend({ ...insertedComment, user_profile: { profile_image_url: profileImageUrl } });
        res.status(201).json(formattedComment);
    } catch (err) {
        console.error("Error creating comment:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกคอมเมนต์' });
    }
});

// DELETE a comment (requires authentication, owner or admin)
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: comment, error: fetchError } = await supabase.from('review_comments').select('user_id').eq('id', commentId).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!comment) return res.status(404).json({ error: 'ไม่พบความคิดเห็นที่ต้องการลบ' });
        if (comment.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบความคิดเห็นนี้' });
        // Delete associated likes first
        await supabase.from('comment_likes').delete().eq('comment_id', commentId);
        // Delete the comment
        const { error: deleteError } = await supabase.from('review_comments').delete().eq('id', commentId);
        if (deleteError) throw deleteError;
        res.status(204).send(); // Success
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบความคิดเห็น' });
    }
});

// POST toggle like on a comment (requires authentication)
app.post('/api/comments/:commentId/toggle-like', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;
    try {
        const { data: comment, error: commentError } = await supabase.from('review_comments').select('user_id, review_id, comment, likes_count').eq('id', commentId).single();
        if (commentError || !comment) return res.status(404).json({ error: 'Comment not found.' });
        const { data: existingLike, error: findError } = await supabase.from('comment_likes').select('id').match({ user_id: userId, comment_id: commentId }).maybeSingle();
        if (findError && findError.code !== 'PGRST116') throw findError;
        let currentLikes = Number(comment.likes_count || 0);
        let status;
        if (existingLike) { // Unlike
            await supabase.from('comment_likes').delete().match({ id: existingLike.id });
            currentLikes = Math.max(0, currentLikes - 1);
            status = 'unliked';
        } else { // Like
            await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
            currentLikes += 1;
            status = 'liked';
            // Send notification if liking someone else's comment
            if (comment.user_id !== userId) {
                const { data: review } = await supabase.from('reviews').select('location_id').eq('id', comment.review_id).single();
                if (review) {
                    let location = null, locError = null;
                    ({ data: location, error: locError } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle());
                    if (!location && (!locError || locError.code === 'PGRST116')) {
                        ({ data: location, error: locError } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
                    }
                    if (location) {
                        createAndSendNotification({
                            type: 'new_comment_like', actorId: userId, actorName: displayName || username, actorProfileImageUrl: profileImageUrl,
                            recipientId: comment.user_id, // Notify comment author
                            payload: { location: formatRowForFrontend(location), commentSnippet: comment.comment?.substring(0, 50) || '', reviewId: comment.review_id, commentId: commentId }
                        });
                    } else console.warn(`Could not find location ${review.location_id} for comment like notification.`);
                }
            }
        }
        // Update likes_count on comment
        const { data: updatedComment, error: updateError } = await supabase.from('review_comments').update({ likes_count: currentLikes }).eq('id', commentId).select('likes_count').single();
        if (updateError) throw updateError;
        res.json({ status, likesCount: updatedComment.likes_count });
    } catch (err) {
        console.error(`Error toggling like for comment ${commentId}:`, err);
        res.status(500).json({ error: 'Failed to toggle like on comment.' });
    }
});


// --- AUTHENTICATION ---
// POST register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    // Basic validation
    if (!username || !username.trim() || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    if (password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    const trimmedUsername = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, A-Z, 0-9, _)' });

    try {
        // Check if username already exists
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', trimmedUsername).maybeSingle();
        if (existingUser) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create new user object
        const newUser = {
            id: crypto.randomUUID(),
            username: trimmedUsername,
            display_name: trimmedUsername, // Default display name to username
            password: hashedPassword,
            role: 'user' // Default role
        };
        // Insert new user into database
        const { error } = await supabase.from('users').insert(newUser);
        if (error) throw error; // Handle DB errors
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

// POST login user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    try {
        // Find user by username
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        // Handle user not found or DB error
        if (error || !user) {
            console.log(`Login attempt failed for user: ${username}. Reason: User not found or DB error.`);
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        // Compare provided password with hashed password from DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            // Passwords match - Generate JWT
            const formattedUser = formatRowForFrontend(user);
            const token = jwt.sign({
                userId: formattedUser.id,
                username: formattedUser.username,
                displayName: formattedUser.displayName,
                role: formattedUser.role,
                profileImageUrl: formattedUser.profileImageUrl
            }, process.env.JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day
            // Send success response with user data and token
            res.json({ message: 'เข้าสู่ระบบสำเร็จ!', user: formattedUser, token });
        } else {
            // Passwords don't match
            console.log(`Login attempt failed for user: ${username}. Reason: Incorrect password.`);
            res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});


// --- FAVORITES ---
// GET list of favorite location IDs for the logged-in user
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('location_id')
            .eq('user_id', userId);
        if (error) throw error;
        const favoriteIds = (data || []).map(fav => fav.location_id);
        res.json(favoriteIds);
    } catch (err) {
        console.error(`Error fetching favorites for user ${userId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการโปรด' });
    }
});

// POST endpoint to add or remove a location from favorites
app.post('/api/favorites/toggle', authenticateToken, async (req, res) => {
    const { locationId } = req.body;
    const { userId } = req.user;
    if (!locationId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (locationId is missing)' });
    try {
        // Check if the favorite exists using user_id and location_id
        const { count, error: findError } = await supabase
            .from('favorites')
            .select('*', { count: 'exact', head: true }) // Use count for efficiency
            .match({ user_id: userId, location_id: locationId });

        if (findError) throw findError;

        const exists = count > 0;

        if (exists) {
            // Favorite exists, remove it using user_id and location_id
            const { error: deleteError } = await supabase
                .from('favorites')
                .delete()
                .match({ user_id: userId, location_id: locationId });
            if (deleteError) throw deleteError;
            console.log(`Favorite removed for user ${userId}, location ${locationId}`);
            res.json({ status: 'removed' });
        } else {
            // Favorite does not exist, add it
            const { error: insertError } = await supabase
                .from('favorites')
                .insert({ user_id: userId, location_id: locationId });
            if (insertError) throw insertError;
            console.log(`Favorite added for user ${userId}, location ${locationId}`);
            res.json({ status: 'added' });
        }
    } catch (err) {
        console.error(`Error toggling favorite for user ${userId}, location ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรายการโปรด', details: err.message });
    }
});


// --- START SERVER ---
app.listen(port, () => {
    // Log the actual port the server is listening on (important for Render)
    console.log(`✅✅✅ SERVER (SUPABASE STORAGE + Migration Fix) IS RUNNING at http://localhost:${port}`);
});

