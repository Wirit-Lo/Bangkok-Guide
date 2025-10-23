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

console.log('--- SERVER WITH SUPABASE STORAGE (v21.3 - FORMATTER FIX 2) LOADING ---'); // Updated version note

// --- Supabase Client Setup ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.JWT_SECRET) {
    console.error('CRITICAL ERROR: SUPABASE_URL, SUPABASE_SERVICE_KEY, and JWT_SECRET must be defined in your .env file');
    process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET_NAME = 'image-uploads'; // Your bucket name

const app = express();
const port = process.env.PORT || 5000;
let clients = [];

// --- Middleware ---
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
    }
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url}`);
    next();
});

// --- Multer Setup for In-Memory Storage ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (token == null) return res.status(401).json({ error: 'Unauthorized: Token is required.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
             console.error("JWT Verification Error:", err.message); // Log specific error
             return res.status(403).json({ error: 'Forbidden: Token is not valid.' });
        }
        req.user = userPayload;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access is required for this action.' });
    }
};

// --- HELPER FUNCTIONS ---

async function uploadToSupabase(file) {
    if (!file) return null;
    const fileExt = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${randomName}${fileExt}`;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file.buffer, { contentType: file.mimetype, cacheControl: '3600', upsert: false });
    if (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error('Failed to upload file to Supabase.');
    }
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!data || !data.publicUrl) {
        // Attempt to remove the file if getting URL fails
        await supabase.storage.from(BUCKET_NAME).remove([fileName]);
        throw new Error('Could not get public URL for the uploaded file.');
    }
    return data.publicUrl;
}

async function deleteFromSupabase(fileUrls) {
    if (!fileUrls || (Array.isArray(fileUrls) && fileUrls.length === 0)) return;
    const urlsToDelete = Array.isArray(fileUrls) ? fileUrls : [fileUrls];
    // Filter out invalid URLs more carefully
    const fileNames = urlsToDelete
        .map(url => {
            try {
                if (typeof url !== 'string' || !url.includes(BUCKET_NAME)) return null;
                const parsedUrl = new URL(url);
                // Extract path part after the bucket name
                const pathParts = parsedUrl.pathname.split(`/${BUCKET_NAME}/`);
                return pathParts.length > 1 ? pathParts[1] : null;
            } catch (e) {
                console.error(`Invalid URL format for deletion: ${url}`, e);
                return null;
            }
        })
        .filter(Boolean); // Remove nulls

    if (fileNames.length === 0) {
        console.log("No valid filenames found to delete from Supabase storage.");
        return;
    }
    console.log("Attempting to delete from Supabase:", fileNames);
    const { data, error } = await supabase.storage.from(BUCKET_NAME).remove(fileNames);
    if (error) {
        console.error('Supabase Storage Deletion Error:', error);
        // Don't throw, just log the error
    } else {
        console.log("Supabase Storage Deletion Success:", data);
    }
}


// --- ⭐ FIX: Improved formatRowForFrontend (Simpler Logic) ---
const formatRowForFrontend = (row) => {
    if (!row || typeof row !== 'object') return null;

    // Helper to safely extract profile image URL from various possible structures
    const getProfileImageUrl = (data) => {
        let potentialUrl = null;
        if (data?.profile_image_url) { // Direct access or nested like row.users.profile_image_url
            potentialUrl = data.profile_image_url;
        } else if (data?.user_profile?.profile_image_url) { // Access via alias
            potentialUrl = data.user_profile.profile_image_url;
        } else if (data?.authorProfileImageUrl) { // Access direct prop if already formatted (e.g., comments)
             potentialUrl = data.authorProfileImageUrl;
        }


        let url = null;
        if (potentialUrl) {
            if (Array.isArray(potentialUrl) && potentialUrl.length > 0) {
                url = potentialUrl[0];
            } else if (typeof potentialUrl === 'string') {
                url = potentialUrl;
            }
        }
        return (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) ? url : null;
    };

    // Create a base object with safe defaults
    const formattedRow = {
        id: row.id,
        name: row.name || 'ไม่มีชื่อ', // For locations/products
        author: row.author || 'ไม่ระบุชื่อ', // For reviews/comments
        username: row.username || undefined, // Keep undefined if not present
        displayName: row.display_name || row.author || undefined, // Use author as fallback
        description: row.description || '',
        comment: row.comment || '',
        category: row.category || 'อื่นๆ',
        rating: isNaN(parseFloat(row.rating)) ? 0 : parseFloat(row.rating || 0),
        likes_count: Number(row.likes_count || 0),
        comments_count: Number(row.comments_count || 0),
        coords: (row.lat !== undefined && row.lng !== undefined && row.lat !== null && row.lng !== null) ? { lat: parseFloat(row.lat), lng: parseFloat(row.lng) } : null,
        googleMapUrl: row.google_map_url || null,
        imageUrl: row.image_url || row.imageurl || null, // Main image for locations/products
        image_urls: Array.isArray(row.image_urls) ? row.image_urls.filter(img => typeof img === 'string') : [], // Images for reviews
        detailImages: Array.isArray(row.detail_images) ? row.detail_images.filter(img => typeof img === 'string') : [], // Detail images for locations
        hours: row.hours || '',
        contact: row.contact || '',
        role: row.role || undefined, // For users
        created_at: row.created_at || null, // Keep original format
        // Specific IDs
        location_id: row.location_id || undefined,
        user_id: row.user_id || undefined,
        review_id: row.review_id || undefined,
        // Profile image (using helper) - check both nested and direct possibilities
        author_profile_image_url: getProfileImageUrl(row.users || row.user_profile || row), // Check nested objects first, then direct row
        authorProfileImageUrl: getProfileImageUrl(row.users || row.user_profile || row) // Add alias used in comment formatting
    };

     // Ensure profileImageUrl is set correctly for user objects
     if (typeof row.display_name === 'string' && typeof row.username === 'string') {
         formattedRow.profileImageUrl = getProfileImageUrl(row);
     }


    return formattedRow;
};
// --- END FIX ---


const extractCoordsFromUrl = (url) => {
    if (!url) return { lat: null, lng: null };
    // Improved regex to handle different Google Maps URL formats
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z|ll=(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        if (match[1] && match[2]) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }; // Format @lat,lng,zoom
        if (match[4] && match[5]) return { lat: parseFloat(match[4]), lng: parseFloat(match[5]) }; // Format ll=lat,lng
        if (match[6] && match[7]) return { lat: parseFloat(match[6]), lng: parseFloat(match[7]) }; // Format q=lat,lng
    }
    return { lat: null, lng: null };
};


// ... (createAndSendNotification, SSE Heartbeat, /api/status, /api/events remain the same) ...
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

        // Simplified DB payload - store only essential IDs/names
        const dbNotificationPayload = {};
        if (payload.location) {
            dbNotificationPayload.locationId = payload.location.id;
            dbNotificationPayload.locationName = payload.location.name;
        }
        if (payload.product) {
             dbNotificationPayload.productId = payload.product.id; // Store ID if available
             dbNotificationPayload.productName = payload.product.name;
        }
         if (payload.reviewId) dbNotificationPayload.reviewId = payload.reviewId;
         if (payload.commentId) dbNotificationPayload.commentId = payload.commentId;
         if (payload.commentSnippet) dbNotificationPayload.commentSnippet = payload.commentSnippet;


        const dbNotification = {
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl, // Store actor image
            type: type,
            payload: dbNotificationPayload, // Store simplified payload in DB
            is_read: false,
        };

        if (recipientId && recipientId !== actorId) {
            await supabase.from('notifications').insert({ ...dbNotification, user_id: recipientId });
        } else if (!recipientId) { // Broadcast (if needed, e.g., new location) - be careful with this
            // Example: Broadcast only for 'new_location' type
            if (type === 'new_location') {
                 const { data: users } = await supabase.from('users').select('id').neq('id', actorId);
                 if (users && users.length > 0) {
                     const notificationsToInsert = users.map(user => ({ ...dbNotification, user_id: user.id }));
                     await supabase.from('notifications').insert(notificationsToInsert);
                 }
            } else {
                 console.log(`Notification type ${type} not broadcasted.`);
            }
        }

        // Send live event
        const liveEventPayload = { type: 'notification', data: liveNotification };
        clients.forEach(client => {
            try {
                 // Send to specific recipient OR broadcast (excluding sender)
                 if (recipientId) {
                     if (client.userId === recipientId && client.userId !== actorId) {
                         client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                     }
                 } else if (type === 'new_location') { // Only broadcast new locations live
                     if (client.userId !== actorId) {
                         client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                     }
                 }
            } catch (e) {
                 console.error(`Error writing SSE for client ${client.id}:`, e);
                 // Remove client immediately on write error
                 clients = clients.filter(c => c.id !== client.id);
                 console.log(`Client ${client.id} removed due to write error. Remaining: ${clients.length}`);

            }
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// --- SSE Heartbeat Logic ---
const sendHeartbeat = () => {
    clients.forEach(client => {
        try {
            client.res.write(':keep-alive\n\n');
        } catch (e) {
             console.error(`Heartbeat failed for client ${client.id}:`, e);
            clients = clients.filter(c => c.id !== client.id);
            console.log(`Client ${client.id} disconnected (Heartbeat failed). Remaining clients: ${clients.length}`);
        }
    });
};
setInterval(sendHeartbeat, 15000); // Send keep-alive every 15 seconds


// --- API Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '21.3', database: 'supabase_storage' }));

app.get('/api/events', authenticateToken, async (req, res) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no' // Important for proxies like Nginx
    };
    res.writeHead(200, headers);

    const clientId = Date.now() + Math.random(); // Make ID more unique
    const newClient = { id: clientId, res: res, userId: req.user.userId };
    clients.push(newClient);
    console.log(`Client ${clientId} connected (User ${newClient.userId}). Total clients: ${clients.length}`);


    res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);

    // Send initial heartbeat immediately?
    try {
        newClient.res.write(':initial-connection\n\n');
    } catch (e) {
         console.error(`Initial write failed for client ${clientId}:`, e);
         clients = clients.filter(client => client.id !== clientId); // Remove if initial write fails
         return; // Don't proceed further for this client
    }


    try {
        const { data: pastNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (pastNotifications && pastNotifications.length > 0) {
            const payload = { type: 'historic_notifications', data: pastNotifications };
            // Ensure client is still connected before writing
            if (clients.some(c => c.id === clientId)) {
                 try {
                     newClient.res.write(`data: ${JSON.stringify(payload)}\n\n`);
                 } catch (e) {
                      console.error(`Error writing historic notifications for ${clientId}:`, e);
                      clients = clients.filter(client => client.id !== clientId); // Remove on error
                 }
            }
        }
    } catch (err) {
        console.error(`[SSE ERROR] Could not fetch past notifications for user ${req.user.userId}:`, err);
        // Don't disconnect client here, maybe fetch failed but connection is ok
    }

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`Client ${clientId} disconnected. Remaining clients: ${clients.length}`);
    });

     // Keep connection open until client closes it
     // res.end() should not be called here for SSE
});


// ... (User Profile, Notifications, Famous Products endpoints remain the same) ...
// --- User Profile Endpoints ---
app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, display_name, profile_image_url, role')
            .eq('id', userId)
            .single(); // Use single() to expect one row or null

        if (error && error.code !== 'PGRST116') { // Ignore 'PGRST116' (Row not found) error here
            throw error;
        }
        if (!user) { // Handle the case where the user wasn't found
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(formatRowForFrontend(user)); // Format the user data before sending
    } catch (err) {
        console.error(`Error fetching user profile ${userId}:`, err); // Log the error
        // Handle specific Supabase errors if needed, otherwise send a generic 500
        if (err.code === 'PGRST116') { // Should be caught above, but good as a fallback
             return res.status(404).json({ error: 'User not found.' });
        }
        res.status(500).json({ error: 'Could not fetch user profile.' });
    }
});


app.put('/api/users/:userIdToUpdate', authenticateToken, upload.single('profileImage'), async (req, res) => {
    const { userIdToUpdate } = req.params;
    const { userId: authenticatedUserId, role } = req.user;

    if (userIdToUpdate !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขโปรไฟล์นี้' });
    }

    const { displayName, currentPassword, newPassword, username } = req.body;
    let newImageUrl = null; // Track new image URL for potential cleanup

    try {
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userIdToUpdate)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }

        const updateData = {};
        // Check if password change or username change requires current password validation
        if (newPassword || (username && username.trim() !== user.username)) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
            }
        }

        // Handle display name update and propagate to related tables
        if (displayName && displayName.trim() !== user.display_name) {
            updateData.display_name = displayName.trim();
            // Use Promise.all for concurrent updates
            await Promise.all([
                supabase.from('reviews').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate),
                supabase.from('review_comments').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate)
            ]);
        }

        // Handle username update with uniqueness check
        if (username && username.trim() !== user.username) {
            const trimmedUsername = username.trim();
            const { data: existingUser } = await supabase.from('users').select('id').eq('username', trimmedUsername).single();
            if (existingUser && existingUser.id !== userIdToUpdate) {
                return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
            }
            updateData.username = trimmedUsername;
        }

        // Handle password update
        if (newPassword) {
             if(newPassword.length < 6) { // Add basic validation
                 return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
             }
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        // Handle profile image update
        if (req.file) {
            // Delete old image if it exists
            await deleteFromSupabase(user.profile_image_url);
            // Upload new image
            newImageUrl = await uploadToSupabase(req.file);
            updateData.profile_image_url = [newImageUrl];
        }

        // If no data changed, return current user info
        if (Object.keys(updateData).length === 0) {
            const currentFormattedUser = formatRowForFrontend(user);
            const token = jwt.sign({
                userId: currentFormattedUser.id,
                username: currentFormattedUser.username,
                displayName: currentFormattedUser.displayName,
                role: currentFormattedUser.role,
                profileImageUrl: currentFormattedUser.profileImageUrl
            }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต', user: currentFormattedUser, token });
        }

        // Perform the update
        const { data: updatedUserResult, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userIdToUpdate)
            .select('id, username, display_name, profile_image_url, role') // Select necessary fields
            .single();

        if (updateError) throw updateError;

        // Generate a new token with updated information
        const formattedUpdatedUser = formatRowForFrontend(updatedUserResult);
        const token = jwt.sign({
            userId: formattedUpdatedUser.id,
            username: formattedUpdatedUser.username,
            displayName: formattedUpdatedUser.displayName,
            role: formattedUpdatedUser.role,
            profileImageUrl: formattedUpdatedUser.profileImageUrl // Use formatted URL
        }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ!', user: formattedUpdatedUser, token });

    } catch (err) {
        console.error(`[ERROR] Updating profile for ${userIdToUpdate}:`, err);
         // If update failed after image upload, attempt cleanup
         if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});


app.delete('/api/users/:userIdToDelete', authenticateToken, async (req, res) => {
    const { userIdToDelete } = req.params;
    const { userId: authenticatedUserId, role } = req.user;
    const { currentPassword } = req.body;

    // Authorization checks
    if (userIdToDelete !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบบัญชีนี้' });
    }
    if (!currentPassword) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ' });
    }

    try {
        // Fetch user to verify password and get profile image URL
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('password, profile_image_url')
            .eq('id', userIdToDelete)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // Delete profile image from storage
        await deleteFromSupabase(user.profile_image_url);

        // Delete user's related data in order (consider transactions if needed)
        // Adjust table names and foreign key relations as necessary
        await supabase.from('review_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('comment_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('review_comments').delete().eq('user_id', userIdToDelete);
        await supabase.from('reviews').delete().eq('user_id', userIdToDelete);
        await supabase.from('favorites').delete().eq('user_id', userIdToDelete);
        // Assuming user_id exists in these tables
        await supabase.from('famous_products').delete().eq('user_id', userIdToDelete);
        await supabase.from('attractions').delete().eq('user_id', userIdToDelete);
        await supabase.from('foodShops').delete().eq('user_id', userIdToDelete);
        // Finally, delete the user
        await supabase.from('users').delete().eq('id', userIdToDelete);

        res.json({ message: 'ลบบัญชีผู้ใช้สำเร็จ' });

    } catch(err) {
        console.error(`[ERROR] Deleting account for ${userIdToDelete}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดระหว่างการลบบัญชี' });
    }
});


// --- Notifications ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json(data); // Assuming format is okay, or add formatting if needed
    } catch (err) {
        console.error(`Error fetching notifications for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch notifications.' });
    }
});

app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
    try {
        // Use count() method for potentially better performance
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.userId)
            .eq('is_read', false);

        if (error) throw error;
        res.json({ count: count || 0 });
    } catch (err) {
        console.error(`Error fetching unread count for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not fetch unread count.' });
    }
});

app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', req.user.userId)
            .eq('is_read', false); // Only update unread ones

        if (error) throw error;
        res.status(200).json({ message: 'Notifications marked as read.' });
    } catch (err) {
        console.error(`Error marking notifications read for ${req.user.userId}:`, err);
        res.status(500).json({ error: 'Could not mark notifications as read.' });
    }
});

// --- Famous Products ---
// Get all products (Admin only) - includes location name
app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    const locationMap = new Map();
    let products = [];

    // Fetch locations to map names (optimized slightly)
    try {
        // Fetching separately might be more reliable than UNION depending on Supabase version/config
        const [attractionsRes, foodShopsRes] = await Promise.all([
             supabase.from('attractions').select('id, name'),
             supabase.from('foodShops').select('id, name')
        ]);

        if (attractionsRes.error) console.error("Error fetching attractions for product map:", attractionsRes.error);
        if (foodShopsRes.error) console.error("Error fetching foodShops for product map:", foodShopsRes.error);

        (attractionsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
        (foodShopsRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));

    } catch (err) {
        console.error("CRITICAL Error fetching locations for product mapping:", err);
        // Continue without location names
    }

    // Fetch Famous Products
    try {
        const { data: fetchedProducts, error: productsError } = await supabase
            .from('famous_products')
            .select('*'); // Select all columns

        if (productsError) {
            console.error("Error fetching famous products:", productsError);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
        } else {
            products = fetchedProducts || []; // Ensure products is an array
        }
    } catch (err) {
        console.error("CRITICAL Error fetching famous products:", err);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดร้ายแรงในการดึงข้อมูลของขึ้นชื่อ' });
    }

    // Map location names and format
    const productsWithLocation = products.map(product => {
        const formatted = formatRowForFrontend(product);
        return {
            ...formatted,
            locationName: product.location_id ? locationMap.get(product.location_id) || 'ไม่พบสถานที่' : 'ส่วนกลาง'
        };
    });

    res.json(productsWithLocation);
});

// Get random products (not associated with a location)
app.get('/api/famous-products/random', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('famous_products')
            .select('*')
            .is('location_id', null); // Filter for products with no location_id

        if (error) throw error;

        // Shuffle and take the first 2
        const shuffled = (data || []).sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 2).map(formatRowForFrontend));
    } catch (err) {
        console.error("Error fetching random famous products:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});


// Get a specific product by ID
app.get('/api/famous-products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: product, error } = await supabase
            .from('famous_products')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Handle errors other than "not found"
        if (!product) return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' });

        res.json(formatRowForFrontend(product));
    } catch (err) {
        console.error(`Error fetching famous product ${id}:`, err);
        if (err.code === 'PGRST116') {
             return res.status(404).json({ error: 'ไม่พบของขึ้นชื่อ' });
        }
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

// Create a new product
app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    const { userId } = req.user; // Get userId from authenticated user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

     let imageUrl = null; // Track upload for potential cleanup

    try {
        imageUrl = await uploadToSupabase(req.file); // Upload image first

        const newProduct = {
            id: crypto.randomUUID(),
            name: name.trim(),
            description: description ? description.trim() : '',
            imageurl: imageUrl, // Use the correct column name 'imageurl'
            location_id: locationId || null, // Allow null locationId
            user_id: userId // Associate with the user who created it
        };

        const { data, error } = await supabase
            .from('famous_products')
            .insert(newProduct)
            .select() // Select the inserted row
            .single(); // Expect a single row back

        if (error) throw error;

        res.status(201).json(formatRowForFrontend(data)); // Format and send response
    } catch (err) {
        console.error("Error creating product:", err);
        // Clean up uploaded image if DB insert fails? Consider this logic.
         if(imageUrl) await deleteFromSupabase(imageUrl); // Attempt cleanup
        res.status(500).json({ error: `Failed to create product: ${err.message}` });
    }
});

// Update a product
app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body; // Only name and description can be updated this way
    const { userId, role } = req.user;

    let newImageUrl = null; // Variable to track new image URL for potential cleanup

    try {
        // Fetch the product to check ownership/admin rights and get old image URL
        const { data: product, error: fetchError } = await supabase
            .from('famous_products')
            .select('user_id, imageurl')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        // Authorization check: User must be admin or the owner of the product
        if (product.user_id !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const updateData = {};
        // Use provided value if exists and trim, otherwise keep existing
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();

        // Handle image update: delete old, upload new
        if (req.file) {
            await deleteFromSupabase(product.imageurl);
            newImageUrl = await uploadToSupabase(req.file); // Store new URL
            updateData.imageurl = newImageUrl;
        }

        // Perform the update only if there's data to update
        if (Object.keys(updateData).length > 0) {
            const { data: updatedProduct, error: updateError } = await supabase
                .from('famous_products')
                .update(updateData)
                .eq('id', id)
                .select() // Select the updated row
                .single(); // Expect a single row back

            if (updateError) throw updateError;
            return res.json(formatRowForFrontend(updatedProduct)); // Format and send
        } else {
             // If no data to update, fetch current data and return it
             const { data: currentProduct, error: currentError } = await supabase
                .from('famous_products')
                .select('*')
                .eq('id', id)
                .single();
             if(currentError) throw currentError;
             // Ensure the image URL is correct if no file was uploaded
             currentProduct.imageurl = product.imageurl;
             return res.json(formatRowForFrontend(currentProduct));
        }

    } catch (err) {
        console.error(`Error updating product ${id}:`, err);
        // If update failed after uploading a new image, try to delete the new image
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

// Delete a product
app.delete('/api/famous-products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;

    try {
        // Fetch the product to check ownership/admin rights and get image URL
        const { data: product, error: fetchError } = await supabase
            .from('famous_products')
            .select('user_id, imageurl')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        // Authorization check: User must be admin or the owner
        if (product.user_id !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        // Delete image from storage first
        await deleteFromSupabase(product.imageurl);

        // Delete product from database
        const { error: deleteError } = await supabase
            .from('famous_products')
            .delete()
            .eq('id', id);

        // If DB deletion fails, the image is already gone, which might be acceptable
        // or you could add more complex rollback logic if needed.
        if (deleteError) throw deleteError;

        // Send success response
        res.status(204).send();

    } catch (err) {
        console.error(`Error deleting product ${id}:`, err);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});


// --- Locations (Attractions & FoodShops combined logic where possible) ---

// Get deletion requests (Admin only)
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Fetching separately is generally more reliable
        const [attractionsRes, foodShopsRes] = await Promise.all([
             supabase.from('attractions').select('*').eq('status', 'pending_deletion'),
             supabase.from('foodShops').select('*').eq('status', 'pending_deletion')
        ]);

        let allRequests = [];
        if (attractionsRes.error) console.error("Error fetching attraction deletion requests:", attractionsRes.error);
        else allRequests = allRequests.concat(attractionsRes.data || []);

        if (foodShopsRes.error) console.error("Error fetching foodShop deletion requests:", foodShopsRes.error);
        else allRequests = allRequests.concat(foodShopsRes.data || []);

        // Format results before sending
        res.json(allRequests.map(formatRowForFrontend));

    } catch (err) { // Catch errors not caught by individual promises (e.g., network issues)
        console.error("CRITICAL Error fetching deletion requests:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดร้ายแรงในการดึงคำขอลบ' });
    }
});


// Deny a deletion request (Admin only)
app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Try updating attractions first
        let { data, error } = await supabase
            .from('attractions')
            .update({ status: 'approved' })
            .eq('id', id)
            .eq('status', 'pending_deletion') // Ensure it's actually pending
            .select('id') // Select only 'id' to confirm update
            .maybeSingle(); // Use maybeSingle to handle 0 or 1 row updated

        // If not found or error in attractions, try foodShops
        if (!data && (!error || error?.code === 'PGRST116')) { // More robust error check
            ({ data, error } = await supabase
                .from('foodShops')
                .update({ status: 'approved' })
                .eq('id', id)
                .eq('status', 'pending_deletion')
                .select('id')
                .maybeSingle());
        }

        // Handle potential errors after trying both tables
        if (error && error.code !== 'PGRST116') { // Ignore "not found" error if it occurred on the second try
            throw error;
        }

        if (!data) { // If not found in either table (or wasn't pending)
            return res.status(404).json({ message: 'ไม่พบคำขอลบสำหรับสถานที่นี้ หรือสถานะไม่ใช่ pending_deletion' });
        }

        res.json({ message: 'ปฏิเสธการลบและคืนสถานะสถานที่เรียบร้อยแล้ว' });
    } catch (err) {
        console.error(`Error denying deletion for ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอลบ' });
    }
});


// Get all approved attractions
app.get('/api/attractions', async (req, res) => {
    try {
        let query = supabase.from('attractions').select('*').eq('status', 'approved');
        // Add sorting if requested
        if (req.query.sortBy === 'rating') {
            query = query.order('rating', { ascending: false, nullsFirst: false }); // Handle null ratings
        } else {
             // --- ⭐ FIX: Sort by 'name' instead of 'created_at' ---
            query = query.order('name', { ascending: true }); // Default sort by name A-Z
            // --- END FIX ---
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend)); // Use safe map
    } catch (err) {
        console.error("Error fetching attractions:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่ท่องเที่ยว' });
    }
});

// Get all approved foodShops
app.get('/api/foodShops', async (req, res) => {
    try {
        let query = supabase.from('foodShops').select('*').eq('status', 'approved');
        if (req.query.sortBy === 'rating') {
            query = query.order('rating', { ascending: false, nullsFirst: false });
        } else {
             // --- ⭐ FIX: Sort by 'name' instead of 'created_at' ---
             query = query.order('name', { ascending: true }); // Default sort by name A-Z
             // --- END FIX ---
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend)); // Use safe map
    } catch (err) {
        console.error("Error fetching foodShops:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร' });
    }
});

// ... (Rest of the code remains the same) ...
// Get locations in the same category (excluding one ID)
app.get('/api/locations/same-category', async (req, res) => {
    const { category, excludeId } = req.query;
    if (!category) return res.status(400).json({ error: 'Category is required' });

    try {
        // Fetch from both tables concurrently
        const [attractionsResult, foodShopsResult] = await Promise.all([
            supabase.from('attractions')
                .select('*')
                .eq('category', category)
                .neq('id', excludeId || '') // Handle case where excludeId is not provided
                .eq('status', 'approved')
                .limit(5),
            supabase.from('foodShops')
                .select('*')
                .eq('category', category)
                .neq('id', excludeId || '')
                .eq('status', 'approved')
                .limit(5)
        ]);

        if (attractionsResult.error) console.error("Error fetching similar attractions:", attractionsResult.error);
        if (foodShopsResult.error) console.error("Error fetching similar foodShops:", foodShopsResult.error);

        const attractions = attractionsResult.data || [];
        const foodShops = foodShopsResult.data || [];

        const combined = [...attractions, ...foodShops];
        // Shuffle the combined results and take the top 5
        const shuffled = combined.sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 5).map(formatRowForFrontend));

    } catch (err) {
        // This catch might not be reached if errors are handled within Promise.all results
        console.error(`Error fetching locations in category ${category}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสถานที่ในหมวดหมู่เดียวกัน' });
    }
});


// Get famous products for a specific location
app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { locationId } = req.params;
    try {
        const { data, error } = await supabase
            .from('famous_products')
            .select('*')
            .eq('location_id', locationId); // Filter by location_id

        if (error) throw error;
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) {
        console.error(`Error fetching famous products for location ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

// Get a specific location by ID (checks both tables)
app.get('/api/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Try fetching from attractions first
        let { data: location, error } = await supabase
            .from('attractions')
            .select('*')
            .eq('id', id)
            .maybeSingle(); // Allows null result without error

        // If not found in attractions, try foodShops
        if (!location && (!error || error?.code === 'PGRST116')) { // More robust check
            ({ data: location, error } = await supabase
                .from('foodShops')
                .select('*')
                .eq('id', id)
                .maybeSingle());
        }

        // Handle errors after trying both
        if (error && error.code !== 'PGRST116') {
             throw error;
        }

        if (location) {
            res.json(formatRowForFrontend(location));
        } else {
            res.status(404).json({ error: 'ไม่พบสถานที่' });
        }
    } catch (err) {
         console.error(`Error fetching location ${id}:`, err);
         // Don't send 500 for 'PGRST116' (not found)
         if (err.code !== 'PGRST116') {
             res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' });
         } else {
             res.status(404).json({ error: 'ไม่พบสถานที่' });
         }
    }
});


// Create a new location (attraction or foodShop)
app.post('/api/locations', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { name, category, description, googleMapUrl, hours, contact } = req.body;
    const { userId } = req.user; // Get creator's ID

    if (!name || !name.trim() || !category) return res.status(400).json({ error: 'กรุณากรอกชื่อและหมวดหมู่' });

    let uploadedImageUrls = []; // Keep track for potential cleanup

    try {
        // Upload all images concurrently
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        uploadedImageUrls = await Promise.all(uploadPromises); // Store successful URLs

        const coords = extractCoordsFromUrl(googleMapUrl); // Extract coordinates

        const newLocationData = {
            id: crypto.randomUUID(),
            name: name.trim(),
            category,
            description: description ? description.trim() : '',
            google_map_url: googleMapUrl || null, // Allow null URL
            hours: hours || '',
            contact: contact || '',
            user_id: userId, // Set the creator
            status: 'approved', // Default status
            image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, // First image as main
            detail_images: uploadedImageUrls.length > 1 ? uploadedImageUrls.slice(1) : [], // Rest as detail images
            lat: coords.lat, // Add coordinates
            lng: coords.lng,
        };

        // Determine table based on category
        const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(category);
        const tableName = isFoodShop ? 'foodShops' : 'attractions';

        // Insert into the determined table
        const { data: insertedLocation, error } = await supabase
            .from(tableName)
            .insert(newLocationData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(formatRowForFrontend(insertedLocation)); // Return formatted data

    } catch (err) {
        console.error("Error creating location:", err);
        // If DB insert fails, try to delete already uploaded images
        if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});


// Update a location (attraction or foodShop)
app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { name, category, description, googleMapUrl, hours, contact, existingImages } = req.body;

    let newlyUploadedUrls = []; // Track URLs uploaded in this request

    try {
        // --- Find the location and its table ---
        let location = null;
        let tableName = null;
        const { data: attractionData, error: attrError } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle();
        if (attrError && attrError.code !== 'PGRST116') throw attrError;
        if (attractionData) {
            location = attractionData;
            tableName = 'attractions';
        } else {
             const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle();
             if (foodError && foodError.code !== 'PGRST116') throw foodError;
             if(foodShopData) {
                 location = foodShopData;
                 tableName = 'foodShops';
             }
        }
        // --- End Finding ---

        if (!location) {
            return res.status(404).json({ error: 'ไม่พบสถานที่ที่ต้องการแก้ไข' });
        }

        // Authorization Check
        if (role !== 'admin' && location.user_id !== userId) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
        }

        // --- Image Handling ---
        const keptImageUrls = existingImages ? JSON.parse(existingImages) : [];
        const oldImageUrls = [location.image_url, ...(location.detail_images || [])].filter(Boolean); // Get all old URLs
        const imagesToDelete = oldImageUrls.filter(oldUrl => !keptImageUrls.includes(oldUrl)); // Find URLs to delete

        // Upload new images concurrently
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        newlyUploadedUrls = await Promise.all(uploadPromises); // Store newly uploaded URLs

        // Combine kept and new images
        const allFinalImageUrls = [...keptImageUrls, ...newlyUploadedUrls];
        // --- End Image Handling ---

        // Delete images marked for deletion from storage
        await deleteFromSupabase(imagesToDelete);

        const coords = extractCoordsFromUrl(googleMapUrl); // Extract coordinates from potentially new URL

        // Prepare update data - only include fields that are actually provided and trim strings
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (category !== undefined) updateData.category = category;
        if (description !== undefined) updateData.description = description.trim();
        if (googleMapUrl !== undefined) updateData.google_map_url = googleMapUrl;
        if (hours !== undefined) updateData.hours = hours.trim();
        if (contact !== undefined) updateData.contact = contact.trim();
        // Update coordinates if URL changed
        if (googleMapUrl !== undefined) {
             updateData.lat = coords.lat;
             updateData.lng = coords.lng;
        }
        // Update image fields
        updateData.image_url = allFinalImageUrls.length > 0 ? allFinalImageUrls[0] : null;
        updateData.detail_images = allFinalImageUrls.length > 1 ? allFinalImageUrls.slice(1) : [];


        // Perform the update
        const { data: updatedLocation, error: updateError } = await supabase
            .from(tableName) // Use the determined table name
            .update(updateData)
            .eq('id', id)
            .select() // Select the updated row
            .single(); // Expect one row

        if (updateError) throw updateError;

        res.json(formatRowForFrontend(updatedLocation)); // Return formatted updated data

    } catch (err) {
        console.error('Error updating location:', err);
        // If DB update fails, try cleaning up newly uploaded images for this request
        if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสถานที่' });
    }
});


// Request location deletion (by owner or admin)
app.post('/api/locations/:id/request-deletion', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        // --- Find location and table ---
         let location = null;
         let tableName = null;
         const { data: attractionData, error: attrError } = await supabase.from('attractions').select('user_id, status').eq('id', id).maybeSingle();
         if (attrError && attrError.code !== 'PGRST116') throw attrError;
         if (attractionData) {
             location = attractionData;
             tableName = 'attractions';
         } else {
              const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('user_id, status').eq('id', id).maybeSingle();
              if (foodError && foodError.code !== 'PGRST116') throw foodError;
              if(foodShopData) {
                  location = foodShopData;
                  tableName = 'foodShops';
              }
         }
        // --- End Finding ---

        if (!location) return res.status(404).json({ error: 'Location not found.' });

        // Authorization check
        if (location.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });

        // Prevent requesting deletion again if already pending
        if (location.status === 'pending_deletion') {
            return res.status(400).json({ error: 'คำขอลบได้ถูกส่งไปแล้ว' });
        }

        // Update status to 'pending_deletion'
        const { error: updateError } = await supabase
            .from(tableName)
            .update({ status: 'pending_deletion' })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ message: 'ส่งคำขอลบเรียบร้อยแล้ว' });
    } catch (err) {
        console.error(`Error requesting deletion for ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอลบ' });
    }
});

// Delete a location permanently (Admin only)
app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // --- Find location and table to get image URLs ---
        let location = null;
        let tableName = null;
        const { data: attractionData, error: attrError } = await supabase.from('attractions').select('image_url, detail_images').eq('id', id).maybeSingle();
         if (attrError && attrError.code !== 'PGRST116') throw attrError;
         if (attractionData) {
             location = attractionData;
             tableName = 'attractions';
         } else {
              const { data: foodShopData, error: foodError } = await supabase.from('foodShops').select('image_url, detail_images').eq('id', id).maybeSingle();
              if (foodError && foodError.code !== 'PGRST116') throw foodError;
              if(foodShopData) {
                  location = foodShopData;
                  tableName = 'foodShops';
              }
         }
        // --- End Finding ---

        // Delete associated images from storage if location was found
        if (location) {
            const imagesToDelete = [location.image_url, ...(location.detail_images || [])].filter(Boolean);
            await deleteFromSupabase(imagesToDelete);
        }

        // Delete related data first (consider foreign key constraints and CASCADE)
        // Order matters if there are dependencies
        // Simpler approach: Rely on CASCADE DELETE if set up in DB, otherwise delete individually
        // Note: The complex .in() subqueries might be inefficient or hit limits.
        // Direct deletion based on location_id is usually better.

        // Delete comments and likes related to reviews of this location
        // 1. Get review IDs for the location
        const { data: reviewIdsData, error: reviewIdsError } = await supabase.from('reviews').select('id').eq('location_id', id);
        if (reviewIdsError) console.error("Error fetching review IDs for deletion:", reviewIdsError);
        const reviewIds = (reviewIdsData || []).map(r => r.id);

        if (reviewIds.length > 0) {
            // Delete comment likes for comments belonging to these reviews
            const { data: commentIdsData, error: commentIdsError } = await supabase.from('review_comments').select('id').in('review_id', reviewIds);
            if(commentIdsError) console.error("Error fetching comment IDs for deletion:", commentIdsError);
            const commentIds = (commentIdsData || []).map(c => c.id);
            if (commentIds.length > 0) {
                 await supabase.from('comment_likes').delete().in('comment_id', commentIds);
            }
             // Delete comments belonging to these reviews
             await supabase.from('review_comments').delete().in('review_id', reviewIds);
             // Delete review likes for these reviews
             await supabase.from('review_likes').delete().in('review_id', reviewIds);
        }

        // Delete reviews for this location
        await supabase.from('reviews').delete().eq('location_id', id);
        // Delete famous products for this location
        await supabase.from('famous_products').delete().eq('location_id', id);
        // Delete favorites for this location
        await supabase.from('favorites').delete().eq('location_id', id);

        // Delete the location itself from both potential tables
        const { error: deleteAttrError } = await supabase.from('attractions').delete().eq('id', id);
        const { error: deleteFoodError } = await supabase.from('foodShops').delete().eq('id', id);

        // Handle potential deletion errors (optional: maybe log them)
        if (deleteAttrError && deleteAttrError.code !== 'PGRST116') console.error(`Error deleting from attractions: ${id}`, deleteAttrError);
        if (deleteFoodError && deleteFoodError.code !== 'PGRST116') console.error(`Error deleting from foodShops: ${id}`, deleteFoodError);

        // Send success response (204 No Content is standard for DELETE)
        res.status(204).send();

    } catch (err) {
        console.error(`Error deleting location ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสถานที่' });
    }
});


// --- Reviews ---

// Get reviews for a location (includes user like status and author profile image)
app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params;
    const { userId } = req.query; // Optional: user ID to check like status

    try {
        // --- ⭐ FIX: Explicit JOIN syntax with alias ---
        const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            // Select all from reviews, and specific columns from users via FK, aliasing users as user_profile
            .select(`
                *,
                user_profile:user_id ( profile_image_url )
            `)
            .eq('location_id', locationId)
             // Example: Order by review ID descending if created_at is not available
             .order('id', { ascending: false });
        // --- END FIX ---

        if (reviewsError) {
             // Log the specific Supabase error
            console.error(`Supabase error fetching reviews for ${locationId}:`, reviewsError);
            throw reviewsError; // Throw it to be caught by the outer catch block
        }
         if (!reviewsData || reviewsData.length === 0) {
             return res.json([]); // Return empty array if no reviews
        }

         // Log the raw data fetched from Supabase AFTER the query
         console.log('--- Raw reviewsData ---:', JSON.stringify(reviewsData, null, 2));


        // --- Process data after fetching ---
        const reviewIds = reviewsData.map(review => review.id);

        // --- Fetch comment counts (more robust approach) ---
        let commentCounts = {};
        try {
            // Fetch all comments for the reviews and count in JS
            const { data: comments, error: countError } = await supabase
                .from('review_comments')
                .select('review_id') // Select only the grouping key
                .in('review_id', reviewIds);

            if (countError) throw countError;

            // Count manually
            commentCounts = (comments || []).reduce((acc, comment) => {
                acc[comment.review_id] = (acc[comment.review_id] || 0) + 1;
                return acc;
            }, {});

        } catch (commentsError) {
             console.error(`Error fetching comment counts for reviews of ${locationId}:`, commentsError);
             // Continue without comment counts if this fails
        }
        // --- End Fetch comment counts ---


        // Fetch user likes if userId is provided
        let likedReviewIds = new Set();
        if (userId) {
            try {
                const { data: likesData, error: likesError } = await supabase
                    .from('review_likes')
                    .select('review_id') // Only need review_id
                    .eq('user_id', userId)
                    .in('review_id', reviewIds);

                if (likesError) throw likesError;
                if (likesData) {
                     likedReviewIds = new Set(likesData.map(like => like.review_id));
                }
            } catch (likesFetchError) {
                 console.error(`Error fetching likes for user ${userId} on reviews of ${locationId}:`, likesFetchError);
                 // Continue without like status if this fails
            }
        }

        // --- ⭐ FIX: Combine data and Format (using updated formatRowForFrontend) ---
        const formattedReviews = reviewsData.map(review => {
             // Pass the review object (which now contains user_profile) to the formatter
            const formatted = formatRowForFrontend(review);

            // Add comment count and like status
            return {
                ...formatted,
                comments_count: commentCounts[review.id] || 0, // Use calculated count
                user_has_liked: likedReviewIds.has(review.id),
            };
        });
        // --- END FIX ---

        res.json(formattedReviews);

    } catch (err) {
        // Log the error that reached here (could be from initial query or processing)
        console.error(`Error processing reviews request for ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว' });
    }
});


// ... (Rest of the code remains the same) ...
// Create a new review
app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params;
    const { rating, comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user; // Get profileImageUrl from token payload

    // Validation
    if (!rating || !comment || !comment.trim()) return res.status(400).json({ error: 'กรุณากรอกคะแนนและเนื้อหารีวิว' });
    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
         return res.status(400).json({ error: 'คะแนนต้องอยู่ระหว่าง 1 ถึง 5' });
    }

    let uploadedImageUrls = []; // Track uploads for potential cleanup

    try {
        // Upload images concurrently
        const uploadPromises = (req.files || []).map(uploadToSupabase);
        uploadedImageUrls = await Promise.all(uploadPromises);

        // Prepare review data
        const newReview = {
            id: crypto.randomUUID(),
            location_id: locationId,
            user_id: userId,
            author: displayName || username, // Use displayName if available
            rating: numericRating,
            comment: comment.trim(), // Use trimmed comment
            image_urls: uploadedImageUrls,
            likes_count: 0 // Initial likes count
        };

        // Insert the new review
        const { data: insertedReview, error: insertError } = await supabase
            .from('reviews')
            .insert(newReview)
            .select()
            .single();

        if (insertError) throw insertError;

        // --- Recalculate Average Rating ---
        const { data: allReviews, error: ratingError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('location_id', locationId);

        if (ratingError) {
             console.error(`Error fetching ratings for recalculation on ${locationId}:`, ratingError);
        } else {
            const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0);
            const averageRating = (allReviews && allReviews.length > 0)
                ? (totalRating / allReviews.length).toFixed(1)
                : 0;

            await Promise.allSettled([
                 supabase.from('attractions').update({ rating: averageRating }).eq('id', locationId),
                 supabase.from('foodShops').update({ rating: averageRating }).eq('id', locationId)
            ]);
        }
        // --- End Recalculation ---

        // TODO: Send notification to location owner

        // ⭐ FIX: Add author profile image to response immediately using token data
        const formattedReview = formatRowForFrontend({
             ...insertedReview,
             // Add structure expected by formatter, using the alias
             user_profile: { profile_image_url: profileImageUrl }
        });
        // --- END FIX ---

        res.status(201).json(formattedReview);

    } catch (err) {
        console.error("Error creating review:", err);
        // If DB insert fails, try to delete already uploaded images
        if (uploadedImageUrls.length > 0) await deleteFromSupabase(uploadedImageUrls);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' });
    }
});


// Update a review
app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comment, existingImages, locationId } = req.body; // locationId needed for rating recalc
    const { userId, role, profileImageUrl } = req.user; // Get profile image from token

    let newlyUploadedUrls = []; // Track uploads for potential cleanup

    try {
        // Fetch the review to check ownership/admin rights and get old image URLs
        const { data: review, error: fetchError } = await supabase
            .from('reviews')
            .select('user_id, location_id, image_urls, rating') // Select old rating
            .eq('id', reviewId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการแก้ไข' });

        // Authorization check
        if (review.user_id !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });
        }

        // --- Image Handling ---
        const keptImages = existingImages ? JSON.parse(existingImages) : [];
        const imagesToDelete = (review.image_urls || []).filter(url => !keptImages.includes(url));

        const uploadPromises = (req.files || []).map(uploadToSupabase);
        newlyUploadedUrls = await Promise.all(uploadPromises);

        const allFinalImageUrls = [...keptImages, ...newlyUploadedUrls];
        // --- End Image Handling ---

        await deleteFromSupabase(imagesToDelete); // Delete removed images

        // Prepare update data
        const updateData = {};
        let ratingChanged = false;
        if (rating !== undefined) {
             const numericRating = parseInt(rating, 10);
              if (!isNaN(numericRating) && numericRating >= 1 && numericRating <= 5) {
                 if (numericRating !== review.rating) ratingChanged = true;
                 updateData.rating = numericRating;
              } else {
                   console.warn(`Invalid rating value received during update: ${rating}`);
              }
        }
        if (comment !== undefined) updateData.comment = comment.trim(); // Trim comment
        // Always update image_urls based on current state
        updateData.image_urls = allFinalImageUrls;

        // Perform update if there's data
        let updatedReviewData = null;
        if (Object.keys(updateData).length > 0) {
             const { data, error: updateError } = await supabase
                 .from('reviews')
                 .update(updateData)
                 .eq('id', reviewId)
                 // Select updated review data
                 .select(`*`)
                 .single();

             if (updateError) throw updateError;
             updatedReviewData = data;
        } else {
            // If nothing changed text/rating/image-wise, use the original review data
             updatedReviewData = review;
        }


        // --- Recalculate Average Rating if rating changed ---
        if (ratingChanged) {
             const effectiveLocationId = review.location_id || locationId; // Use review's ID first
             if (effectiveLocationId) {
                const { data: allReviews, error: ratingError } = await supabase
                    .from('reviews')
                    .select('rating')
                    .eq('location_id', effectiveLocationId);

                if (ratingError) {
                     console.error(`Error fetching ratings for recalculation on ${effectiveLocationId}:`, ratingError);
                } else {
                    const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0);
                    const averageRating = (allReviews && allReviews.length > 0)
                        ? (totalRating / allReviews.length).toFixed(1)
                        : 0;

                    await Promise.allSettled([
                         supabase.from('attractions').update({ rating: averageRating }).eq('id', effectiveLocationId),
                         supabase.from('foodShops').update({ rating: averageRating }).eq('id', effectiveLocationId)
                    ]);
                }
             } else {
                  console.warn(`Could not recalculate rating for updated review ${reviewId} - locationId unknown.`);
             }
        }
        // --- End Recalculation ---

         // ⭐ FIX: Format response using token profile image
         const formattedReview = formatRowForFrontend({
             ...updatedReviewData,
             // Add structure expected by formatter using the alias
             user_profile: { profile_image_url: profileImageUrl }
         });
         // --- END FIX ---
        res.json(formattedReview);

    } catch (err) {
        console.error('Error updating review:', err);
        // If DB update fails, try cleaning up newly uploaded images
        if(newlyUploadedUrls.length > 0) await deleteFromSupabase(newlyUploadedUrls);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรีวิว' });
    }
});


// Delete a review
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, role } = req.user;
    // Get locationId from request body for rating recalculation
    const { locationId } = req.body;

    try {
        // Fetch review to check ownership/admin rights and get image URLs + location ID
        const { data: review, error: fetchError } = await supabase
            .from('reviews')
            .select('user_id, location_id, image_urls')
            .eq('id', reviewId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการลบ' });

        // Authorization check
        if (review.user_id !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรีวิวนี้' });
        }

        const effectiveLocationId = review.location_id || locationId; // Use ID from review if available

        // Delete associated images
        await deleteFromSupabase(review.image_urls);

        // Delete related data (comments, likes) first
        await supabase.from('review_comments').delete().eq('review_id', reviewId);
        await supabase.from('review_likes').delete().eq('review_id', reviewId);
        // Delete the review itself
        const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId);
        if (deleteError) throw deleteError;

        // --- Recalculate Average Rating ---
        if (effectiveLocationId) { // Only recalculate if we know the location ID
            const { data: allReviews, error: reviewsError } = await supabase
                .from('reviews')
                .select('rating')
                .eq('location_id', effectiveLocationId);

            if (reviewsError) {
                 console.error(`Error fetching ratings for recalc after delete on ${effectiveLocationId}:`, reviewsError);
            } else {
                const totalRating = (allReviews || []).reduce((sum, r) => sum + (r.rating || 0), 0);
                const averageRating = (allReviews && allReviews.length > 0)
                    ? (totalRating / allReviews.length).toFixed(1)
                    : 0;

                await Promise.allSettled([
                     supabase.from('attractions').update({ rating: averageRating }).eq('id', effectiveLocationId),
                     supabase.from('foodShops').update({ rating: averageRating }).eq('id', effectiveLocationId)
                ]);
            }
        } else {
             console.warn(`Could not recalculate rating for deleted review ${reviewId} - locationId unknown.`);
        }
        // --- End Recalculation ---

        res.status(204).send(); // Success, no content

    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบรีวิว' });
    }
});


// Toggle like on a review
app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;

    try {
        // Check if the like already exists
        const { data: existingLike, error: findError } = await supabase
            .from('review_likes')
            .select('id')
            .match({ user_id: userId, review_id: reviewId })
            .maybeSingle(); // Use maybeSingle to handle null result

        if (findError && findError.code !== 'PGRST116') throw findError;

        // Fetch the review to get current likes count and owner ID for notification
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .select('likes_count, user_id, location_id, comment')
            .eq('id', reviewId)
            .single();

        if (reviewError || !review) return res.status(404).json({ error: 'Review not found' });

        let currentLikes = Number(review.likes_count || 0);
        let status;

        if (existingLike) {
            // Unlike: Delete the like record and decrement count
            await supabase.from('review_likes').delete().match({ id: existingLike.id });
            currentLikes = Math.max(0, currentLikes - 1); // Prevent negative counts
            status = 'unliked';
        } else {
            // Like: Insert the like record and increment count
            await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId });
            currentLikes += 1;
            status = 'liked';

            // Send notification if someone else's review is liked
            if (review.user_id !== userId) {
                // Fetch location details for the notification payload
                let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle();
                if (!location) {
                    ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
                }

                if (location) {
                    createAndSendNotification({
                        type: 'new_like',
                        actorId: userId,
                        actorName: displayName || username,
                        actorProfileImageUrl: profileImageUrl,
                        recipientId: review.user_id, // Notify the review author
                        payload: {
                            location: formatRowForFrontend(location), // Send formatted location data
                            commentSnippet: review.comment ? review.comment.substring(0, 50) : '', // Add comment snippet
                            reviewId: reviewId // Include review ID for potential linking
                        }
                    });
                } else {
                     console.warn(`Could not find location ${review.location_id} for like notification.`);
                }
            }
        }

        // Update the likes_count on the review table
        const { data: updatedReview, error: updateError } = await supabase
            .from('reviews')
            .update({ likes_count: currentLikes })
            .eq('id', reviewId)
            .select('likes_count') // Select only the updated count
            .single();

        if (updateError) throw updateError;

        res.json({ status: status, likesCount: updatedReview.likes_count });

    } catch (err) {
        console.error(`Error toggling like for review ${reviewId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการกดไลค์รีวิว' });
    }
});


// --- Review Comments ---

// Get comments for a review
app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { reviewId } = req.params;
    try {
        // --- ⭐ FIX: Explicit JOIN syntax with alias ---
        const { data, error } = await supabase
            .from('review_comments')
             // Select all from review_comments, and profile_image_url from users aliased as user_profile
            .select(`
                *,
                user_profile:user_id ( profile_image_url )
            `)
            .eq('review_id', reviewId)
             // Order comments, e.g., by creation time
             .order('created_at', { ascending: true }); // Show oldest first
        // --- END FIX ---

        if (error) {
             console.error(`Supabase error fetching comments for review ${reviewId}:`, error);
             throw error;
        }

        // --- ⭐ FIX: Format comments using updated formatRowForFrontend ---
        const formattedComments = (data || []).map(comment => formatRowForFrontend(comment));
        // --- END FIX ---

        res.json(formattedComments);

    } catch (err) {
        console.error(`Error processing comments request for review ${reviewId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคิดเห็น' });
    }
});


// Post a comment on a review
app.post('/api/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user;

    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'เนื้อหาคอมเมนต์ห้ามว่างเปล่า' });
    }

    try {
        // Prepare new comment data
        const newComment = {
            id: crypto.randomUUID(),
            review_id: reviewId,
            user_id: userId,
            author: displayName || username, // Use display name if available
            comment: comment.trim(), // Trim whitespace
            likes_count: 0 // Initial likes
            // created_at will be set by default value in Supabase
        };

        // Insert the comment
        const { data: insertedComment, error } = await supabase
            .from('review_comments')
            .insert(newComment)
            .select() // Select the inserted comment
            .single();

        if (error) throw error;

        // Fetch review owner and location for notification
        const { data: review } = await supabase
             .from('reviews')
             .select('user_id, location_id')
             .eq('id', reviewId)
             .single();

        // Send notification if commenting on someone else's review
        if (review && review.user_id !== userId) {
            // Fetch location details
            let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle();
            if (!location) {
                ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
            }

            if (location) {
                createAndSendNotification({
                    type: 'new_reply',
                    actorId: userId,
                    actorName: displayName || username,
                    actorProfileImageUrl: profileImageUrl,
                    recipientId: review.user_id, // Notify review author
                    payload: {
                        location: formatRowForFrontend(location),
                        commentSnippet: comment.trim().substring(0, 50), // Use trimmed comment
                        reviewId: reviewId, // Include review ID
                        commentId: insertedComment.id // Include new comment ID
                    }
                });
            } else {
                 console.warn(`Could not find location ${review.location_id} for reply notification.`);
            }
        }

        // ⭐ FIX: Add profile image URL to the response object immediately using token data
         const formattedComment = formatRowForFrontend({
             ...insertedComment,
             // Add structure expected by formatter using the alias
             user_profile: { profile_image_url: profileImageUrl }
         });
        // --- END FIX ---
        res.status(201).json(formattedComment); // Return the newly created, formatted comment

    } catch (err) {
        console.error("Error creating comment:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกคอมเมนต์' });
    }
});


// Delete a comment
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, role } = req.user;

    try {
        // Fetch the comment to check ownership/admin rights
        const { data: comment, error: fetchError } = await supabase
            .from('review_comments')
            .select('user_id') // Only need user_id for check
            .eq('id', commentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!comment) {
            return res.status(404).json({ error: 'ไม่พบความคิดเห็นที่ต้องการลบ' });
        }

        // Authorization check
        if (comment.user_id !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบความคิดเห็นนี้' });
        }

        // Delete associated likes first
        await supabase.from('comment_likes').delete().eq('comment_id', commentId);
        // Delete the comment itself
        const { error: deleteError } = await supabase
            .from('review_comments')
            .delete()
            .eq('id', commentId);

        if (deleteError) throw deleteError;

        res.status(204).send(); // Success, no content

    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบความคิดเห็น' });
    }
});

// Toggle like on a comment
app.post('/api/comments/:commentId/toggle-like', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;

    try {
        // Fetch the comment to get owner ID and current likes count
        const { data: comment, error: commentError } = await supabase
            .from('review_comments')
            .select('user_id, review_id, comment, likes_count')
            .eq('id', commentId)
            .single();

        if (commentError || !comment) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        // Check if the user already liked this comment
        const { data: existingLike, error: findError } = await supabase
            .from('comment_likes')
            .select('id')
            .match({ user_id: userId, comment_id: commentId })
            .maybeSingle();

        if (findError && findError.code !== 'PGRST116') throw findError;

        let currentLikes = Number(comment.likes_count || 0);
        let status;

        if (existingLike) {
            // Unlike
            await supabase.from('comment_likes').delete().match({ id: existingLike.id });
            currentLikes = Math.max(0, currentLikes - 1);
            status = 'unliked';
        } else {
            // Like
            await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
            currentLikes += 1;
            status = 'liked';

            // Send notification if liking someone else's comment
            if (comment.user_id !== userId) {
                // Fetch review and location details for notification
                const { data: review } = await supabase.from('reviews').select('location_id').eq('id', comment.review_id).single();
                if (review) {
                    let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).maybeSingle();
                    if (!location) {
                        ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).maybeSingle());
                    }

                    if (location) {
                        createAndSendNotification({
                            type: 'new_comment_like',
                            actorId: userId,
                            actorName: displayName || username,
                            actorProfileImageUrl: profileImageUrl,
                            recipientId: comment.user_id, // Notify comment author
                            payload: {
                                location: formatRowForFrontend(location),
                                commentSnippet: comment.comment ? comment.comment.substring(0, 50) : '',
                                reviewId: comment.review_id, // Include review ID
                                commentId: commentId // Include liked comment ID
                            }
                        });
                    } else {
                        console.warn(`Could not find location ${review.location_id} for comment like notification.`);
                    }
                }
            }
        }

        // Update likes_count on the comment table
        const { data: updatedComment, error: updateError } = await supabase
            .from('review_comments')
            .update({ likes_count: currentLikes })
            .eq('id', commentId)
            .select('likes_count')
            .single();

        if (updateError) throw updateError;

        res.json({ status, likesCount: updatedComment.likes_count });

    } catch (err) {
        console.error(`Error toggling like for comment ${commentId}:`, err);
        res.status(500).json({ error: 'Failed to toggle like on comment.' });
    }
});


// --- Authentication ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !username.trim() || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    // Add password length validation if desired
    // if(password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    try {
        // Check if username already exists
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', username.trim()).maybeSingle();
        if (existingUser) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user data
        const newUser = {
            id: crypto.randomUUID(),
            username: username.trim(),
            display_name: username.trim(), // Default display name to username
            password: hashedPassword,
            role: 'user' // Default role
        };

        // Insert new user
        const { error } = await supabase.from('users').insert(newUser);
        if (error) throw error;

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });

    try {
        // Find user by username
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();

        // Handle user not found or other fetch errors
        if (error || !user) {
             console.log(`Login attempt failed for user: ${username}. Reason: User not found or DB error.`);
             return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            // Passwords match - Generate JWT
            const formattedUser = formatRowForFrontend(user); // Format user data first
            const token = jwt.sign({
                userId: formattedUser.id,
                username: formattedUser.username,
                displayName: formattedUser.displayName,
                role: formattedUser.role,
                profileImageUrl: formattedUser.profileImageUrl // Include formatted image URL
            }, process.env.JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day

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


// --- Favorites ---
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    try {
      // Select only the location_id column
      const { data, error } = await supabase
        .from('favorites')
        .select('location_id')
        .eq('user_id', userId);

      if (error) throw error;

      // Map the results to an array of IDs
      const favoriteIds = (data || []).map(fav => fav.location_id);
      res.json(favoriteIds);

    } catch (err) {
      console.error(`Error fetching favorites for user ${userId}:`, err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการโปรด' });
    }
});


app.post('/api/favorites/toggle', authenticateToken, async (req, res) => {
    const { locationId } = req.body;
    const { userId } = req.user;

    if (!locationId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (locationId is missing)' });

    try {
        // Check if the favorite already exists
        const { data: existing, error: findError } = await supabase
            .from('favorites')
            .select('id')
            .match({ user_id: userId, location_id: locationId })
            .maybeSingle(); // Use maybeSingle to handle null

         if (findError && findError.code !== 'PGRST116') throw findError;

        if (existing) {
            // Favorite exists, remove it
            const { error: deleteError } = await supabase
                .from('favorites')
                .delete()
                .match({ id: existing.id });

            if (deleteError) throw deleteError;
            res.json({ status: 'removed' });

        } else {
            // Favorite does not exist, add it
            const { error: insertError } = await supabase
                .from('favorites')
                .insert({ user_id: userId, location_id: locationId });

            if (insertError) throw insertError;
            res.json({ status: 'added' });
        }
    } catch (err) {
        console.error(`Error toggling favorite for user ${userId}, location ${locationId}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรายการโปรด' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`✅✅✅ SERVER (SUPABASE STORAGE + JOIN FIX 3) IS RUNNING at http://localhost:${port}`); // Updated version note
});

