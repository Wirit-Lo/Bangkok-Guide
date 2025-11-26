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

console.log('--- SERVER (MERGED VERSION + User Search API) LOADING ---');

// --- Supabase Client Setup ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.JWT_SECRET) {
    console.error('CRITICAL ERROR: .env variables missing');
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET_NAME = 'image-uploads';

const app = express();
const port = process.env.PORT || 5000;
let clients = []; // For SSE connections

// --- 🗑️ AUTOMATIC CLEANUP SYSTEM (ระบบลบแจ้งเตือนเก่าอัตโนมัติ) ---
const cleanupOldNotifications = async () => {
    console.log('🧹 [Cleanup] Starting scheduled cleanup for old notifications...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const { error, count } = await supabase
            .from('notifications')
            .delete({ count: 'exact' })
            .lt('created_at', thirtyDaysAgo.toISOString());

        if (error) {
            console.error('❌ [Cleanup Error]:', error.message);
        } else {
            console.log(`✅ [Cleanup Success]: Deleted ${count || 0} old notifications.`);
        }
    } catch (err) {
        console.error('❌ [Cleanup Exception]:', err);
    }
};

setInterval(cleanupOldNotifications, 86400000);
cleanupOldNotifications();


// --- Middleware Setup ---
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
    }
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];
    if (!token && req.query.token) token = req.query.token;

    if (token == null) return res.status(401).json({ error: 'Unauthorized: Token is required.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Token is not valid.' });
        req.user = userPayload;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access is required.' });
    }
};

// --- HELPER FUNCTIONS ---

async function uploadToSupabase(file) {
    if (!file) return null;
    const fileExt = path.extname(file.originalname).toLowerCase();
    const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw new Error('Failed to upload file to Supabase.');

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!data || !data.publicUrl) {
        await supabase.storage.from(BUCKET_NAME).remove([fileName]).catch(() => {});
        throw new Error('Could not get public URL.');
    }
    return data.publicUrl;
}

async function deleteFromSupabase(fileUrls) {
    if (!fileUrls || (Array.isArray(fileUrls) && fileUrls.length === 0)) return;
    const urlsToDelete = Array.isArray(fileUrls) ? fileUrls : [fileUrls];
    
    const fileNames = urlsToDelete.map(url => {
        try {
            if (typeof url !== 'string' || !url.includes(`/${BUCKET_NAME}/`)) return null;
            return url.split(`/${BUCKET_NAME}/`)[1];
        } catch (e) { return null; }
    }).filter(Boolean);

    if (fileNames.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(fileNames);
    }
}

const formatRowForFrontend = (row) => {
    if (!row || typeof row !== 'object') return null;

    const getProfileImageUrl = (data) => {
        let potentialUrl = data?.profile_image_url || data?.user_profile?.profile_image_url || data?.authorProfileImageUrl;
        let url = null;
        if (potentialUrl) {
            if (Array.isArray(potentialUrl) && potentialUrl.length > 0) url = potentialUrl[0];
            else if (typeof potentialUrl === 'string') url = potentialUrl;
        }
        return (typeof url === 'string' && url.startsWith('http')) ? url : null;
    };

    const formattedRow = {
        id: row.id,
        name: row.name || 'ไม่มีชื่อ',
        author: row.author || 'ไม่ระบุชื่อ',
        username: row.username || undefined,
        displayName: row.display_name || row.author || undefined,
        description: row.description || '',
        comment: row.comment || '',
        category: row.category || 'อื่นๆ',
        rating: isNaN(parseFloat(row.rating)) ? 0 : parseFloat(row.rating || 0),
        likes_count: Number(row.likes_count || 0),
        comments_count: Number(row.comments_count || 0),
        coords: (row.lat && row.lng) ? { lat: parseFloat(row.lat), lng: parseFloat(row.lng) } : null,
        googleMapUrl: row.google_map_url || null,
        imageUrl: row.image_url || row.imageurl || null,
        image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
        detailImages: Array.isArray(row.detail_images) ? row.detail_images : [],
        hours: row.hours || '',
        contact: row.contact || '',
        role: row.role || undefined,
        created_at: row.created_at || null,
        location_id: row.location_id || undefined,
        user_id: row.user_id || undefined,
        review_id: row.review_id || undefined,
        author_profile_image_url: getProfileImageUrl(row.users || row.user_profile || row),
        authorProfileImageUrl: getProfileImageUrl(row.users || row.user_profile || row)
    };

    if (row.display_name && row.username) {
        formattedRow.profileImageUrl = getProfileImageUrl(row);
    }

    return formattedRow;
};

const extractCoordsFromUrl = (url) => {
    if (!url || typeof url !== 'string') return { lat: null, lng: null };
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)|ll=(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        if (match[1]) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        if (match[3]) return { lat: parseFloat(match[3]), lng: parseFloat(match[4]) };
        if (match[5]) return { lat: parseFloat(match[5]), lng: parseFloat(match[6]) };
    }
    return { lat: null, lng: null };
};

const foodShopCategories = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'];
const getLocationTableByCategory = (category) => {
    return foodShopCategories.includes(category) ? 'foodShops' : 'attractions';
};

// --- 🔔 NOTIFICATION SYSTEM ---
async function createAndSendNotification({ type, actorId, actorName, actorProfileImageUrl, recipientId, payload }) {
    try {
        const safeActorId = String(actorId);
        const safeRecipientId = recipientId ? String(recipientId) : null;

        console.log(`🔔 Processing Notification [${type}]: Actor=${safeActorId} -> Recipient=${safeRecipientId || 'Broadcast'}`);

        if (safeRecipientId && safeRecipientId === safeActorId) {
            console.log('🚫 Aborted: Recipient is same as Actor.');
            return; 
        }

        // Standardized Payload for Clicking/Navigation
        const standardizedPayload = {
             locationId: payload.location?.id,
             locationName: payload.location?.name,
             locationImageUrl: payload.location?.imageUrl,
             productId: payload.product?.id,
             productName: payload.product?.name,
             reviewId: payload.reviewId,
             commentId: payload.commentId,
             commentSnippet: payload.commentSnippet
        };

        const notificationData = {
            actor_id: safeActorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl,
            type: type,
            payload: standardizedPayload,
            is_read: false,
            created_at: new Date().toISOString(),
        };

        const liveNotification = {
            id: crypto.randomUUID(),
            ...notificationData
        };

        if (safeRecipientId) {
            await supabase.from('notifications').insert({ ...notificationData, user_id: safeRecipientId });
        } else if (type === 'new_location') {
            const { data: users } = await supabase.from('users').select('id').neq('id', safeActorId);
            if (users && users.length > 0) {
                const notificationsToInsert = users.map(user => ({ ...notificationData, user_id: user.id }));
                await supabase.from('notifications').insert(notificationsToInsert);
            }
        }

        const liveEventPayload = { type: 'notification', data: liveNotification };
        
        clients.forEach(client => {
            const clientUserId = String(client.userId);
            let shouldSend = false;

            if (safeRecipientId) { 
                if (clientUserId === safeRecipientId && clientUserId !== safeActorId) shouldSend = true;
            } else if (type === 'new_location') { 
                if (clientUserId !== safeActorId) shouldSend = true;
            }

            if (shouldSend) {
                try {
                    client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                } catch (e) {}
            }
        });

    } catch (error) {
        console.error('❌ Notification System Error:', error);
    }
}

// --- SSE SETUP ---
const sendHeartbeat = () => {
    clients.forEach(client => {
        try { client.res.write(':keep-alive\n\n'); } 
        catch (e) { clients = clients.filter(c => c.id !== client.id); }
    });
};
setInterval(sendHeartbeat, 15000);

app.get('/api/events', authenticateToken, async (req, res) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    };
    res.writeHead(200, headers);

    const clientId = Date.now() + Math.random();
    const newClient = { id: clientId, res: res, userId: req.user.userId };
    clients.push(newClient);

    try {
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);
        
        const { data: pastNotifications } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (pastNotifications && pastNotifications.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'historic_notifications', data: pastNotifications })}\n\n`);
        }
    } catch (e) {
        clients = clients.filter(client => client.id !== clientId);
        return;
    }

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

// --- API Endpoints ---

// --- [NEW] USER SEARCH FOR AUTOCOMPLETE ---
app.get('/api/users/search', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);

    try {
        // Search in username OR display_name (using ilike for case-insensitive partial match)
        const { data } = await supabase
            .from('users')
            .select('id, username, display_name, profile_image_url')
            .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
            .limit(5); // Limit results for dropdown
        
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- USER PROFILE ---
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { data: user, error } = await supabase.from('users').select('id, username, display_name, profile_image_url, role').eq('id', req.params.userId).single();
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(formatRowForFrontend(user));
    } catch (err) {
        res.status(500).json({ error: 'Error fetching profile.' });
    }
});

// (Update/Delete User endpoints omitted for brevity but presumed present unchanged)
app.put('/api/users/:userIdToUpdate', authenticateToken, upload.single('profileImage'), async (req, res) => {
    // ... (same as previous version) ...
    const { userIdToUpdate } = req.params;
    const { userId, role } = req.user;
    if (userIdToUpdate !== userId && role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { displayName, currentPassword, newPassword, username } = req.body;
    let newImageUrl = null;
    try {
        const { data: user } = await supabase.from('users').select('*').eq('id', userIdToUpdate).single();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const updateData = {};
        if (newPassword || (username && username.trim() !== user.username)) {
            if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ error: 'Invalid current password' });
        }
        if (displayName && displayName.trim() !== user.display_name) {
            updateData.display_name = displayName.trim();
            Promise.allSettled([supabase.from('reviews').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate), supabase.from('review_comments').update({ author: updateData.display_name }).eq('user_id', userIdToUpdate)]);
        }
        if (username && username.trim() !== user.username) {
            const { data: existing } = await supabase.from('users').select('id').eq('username', username.trim()).maybeSingle();
            if (existing) return res.status(409).json({ error: 'Username taken' });
            updateData.username = username.trim();
        }
        if (newPassword) {
            if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
            updateData.password = await bcrypt.hash(newPassword, 10);
        }
        if (req.file) {
            await deleteFromSupabase(user.profile_image_url);
            newImageUrl = await uploadToSupabase(req.file);
            updateData.profile_image_url = [newImageUrl];
        }
        if (Object.keys(updateData).length === 0) {
            const formatted = formatRowForFrontend(user);
            const token = jwt.sign({ userId: formatted.id, username: formatted.username, displayName: formatted.displayName, role: formatted.role, profileImageUrl: formatted.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'No changes', user: formatted, token });
        }
        const { data: updated } = await supabase.from('users').update(updateData).eq('id', userIdToUpdate).select().single();
        const formatted = formatRowForFrontend(updated);
        const token = jwt.sign({ userId: formatted.id, username: formatted.username, displayName: formatted.displayName, role: formatted.role, profileImageUrl: formatted.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: 'Updated', user: formatted, token });
    } catch (err) {
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'Update failed' });
    }
});

app.delete('/api/users/:userIdToDelete', authenticateToken, async (req, res) => {
    // ... (same as previous version) ...
    const { userIdToDelete } = req.params;
    const { userId, role } = req.user;
    const { currentPassword } = req.body;
    if (userIdToDelete !== userId && role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    if (!currentPassword) return res.status(400).json({ error: 'Password required' });
    try {
        const { data: user } = await supabase.from('users').select('password, profile_image_url').eq('id', userIdToDelete).single();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });
        await deleteFromSupabase(user.profile_image_url);
        await supabase.from('review_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('comment_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('review_comments').delete().eq('user_id', userIdToDelete);
        await supabase.from('reviews').delete().eq('user_id', userIdToDelete);
        await supabase.from('favorites').delete().eq('user_id', userIdToDelete);
        await supabase.from('famous_products').delete().eq('user_id', userIdToDelete);
        await supabase.from('attractions').delete().eq('user_id', userIdToDelete);
        await supabase.from('foodShops').delete().eq('user_id', userIdToDelete);
        await supabase.from('users').delete().eq('id', userIdToDelete);
        res.json({ message: 'Account deleted' });
    } catch(err) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

// --- NOTIFICATIONS API ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', req.user.userId).order('created_at', { ascending: false }).limit(20);
    res.json(data);
});

app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user.userId).eq('is_read', false);
    res.json({ count: count || 0 });
});

app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.userId).eq('is_read', false);
    res.json({ message: 'Marked read' });
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    await supabase.from('notifications').delete().match({ id: req.params.id, user_id: req.user.userId });
    res.json({ message: 'Deleted' });
});

app.delete('/api/notifications', authenticateToken, async (req, res) => {
    await supabase.from('notifications').delete().eq('user_id', req.user.userId);
    res.json({ message: 'Cleared all' });
});

// --- FAMOUS PRODUCTS & LOCATIONS (Same as before) ---
// ... (Omitting standard CRUD for brevity, keeping structure valid) ...
app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    const locationMap = new Map();
    try {
        const [aRes, fRes] = await Promise.all([supabase.from('attractions').select('id, name'), supabase.from('foodShops').select('id, name')]);
        (aRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
        (fRes.data || []).forEach(loc => locationMap.set(loc.id, loc.name));
    } catch (err) {}
    const { data } = await supabase.from('famous_products').select('*');
    res.json((data || []).map(product => ({ ...formatRowForFrontend(product), locationName: product.location_id ? locationMap.get(product.location_id) || 'ไม่พบสถานที่' : 'ส่วนกลาง' })));
});
app.get('/api/famous-products/random', async (req, res) => {
    const { data } = await supabase.from('famous_products').select('*').is('location_id', null);
    const shuffled = (data || []).sort(() => 0.5 - Math.random()).slice(0, 2);
    res.json(shuffled.map(formatRowForFrontend));
});
app.get('/api/famous-products/:id', async (req, res) => {
    const { data: product } = await supabase.from('famous_products').select('*').eq('id', req.params.id).single();
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(formatRowForFrontend(product));
});
app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    let imageUrl = null;
    try {
        imageUrl = await uploadToSupabase(req.file);
        const { data, error } = await supabase.from('famous_products').insert({ id: crypto.randomUUID(), name: name.trim(), description: description?.trim() || '', imageurl: imageUrl, location_id: locationId || null, user_id: req.user.userId }).select().single();
        if (error) throw error;
        res.status(201).json(formatRowForFrontend(data));
    } catch (err) { if(imageUrl) await deleteFromSupabase(imageUrl); res.status(500).json({ error: 'Failed' }); }
});
app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const { userId, role } = req.user;
    let newImageUrl = null;
    try {
        const { data: product } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (!product) return res.status(404).json({ error: 'Not found' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (req.file) { await deleteFromSupabase(product.imageurl); newImageUrl = await uploadToSupabase(req.file); updateData.imageurl = newImageUrl; }
        const { data: updated } = await supabase.from('famous_products').update(updateData).eq('id', id).select().single();
        res.json(formatRowForFrontend(updated));
    } catch (err) { if(newImageUrl) await deleteFromSupabase(newImageUrl); res.status(500).json({ error: 'Failed' }); }
});
app.delete('/api/famous-products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: product } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (!product) return res.status(404).json({ error: 'Not found' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
        await deleteFromSupabase(product.imageurl);
        await supabase.from('famous_products').delete().eq('id', id);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Locations
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [aRes, fRes] = await Promise.all([supabase.from('attractions').select('*').eq('status', 'pending_deletion'), supabase.from('foodShops').select('*').eq('status', 'pending_deletion')]);
        res.json([...(aRes.data || []), ...(fRes.data || [])].map(formatRowForFrontend));
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});
app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let updated = false;
        let { data } = await supabase.from('attractions').update({ status: 'approved' }).match({ id, status: 'pending_deletion' }).select('id').maybeSingle();
        if (data) updated = true;
        else { ({ data } = await supabase.from('foodShops').update({ status: 'approved' }).match({ id, status: 'pending_deletion' }).select('id').maybeSingle()); if(data) updated = true; }
        if (!updated) return res.status(404).json({ error: 'Not found or not pending' });
        res.json({ message: 'Denied deletion' });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});
app.get('/api/attractions', async (req, res) => {
    const query = supabase.from('attractions').select('*').eq('status', 'approved');
    if (req.query.sortBy === 'rating') query.order('rating', { ascending: false, nullsFirst: false }); else query.order('name', { ascending: true });
    const { data } = await query;
    res.json((data || []).map(formatRowForFrontend));
});
app.get('/api/foodShops', async (req, res) => {
    const query = supabase.from('foodShops').select('*').eq('status', 'approved');
    if (req.query.sortBy === 'rating') query.order('rating', { ascending: false, nullsFirst: false }); else query.order('name', { ascending: true });
    const { data } = await query;
    res.json((data || []).map(formatRowForFrontend));
});
app.get('/api/locations/same-category', async (req, res) => {
    const { category, excludeId } = req.query;
    try {
        const [aRes, fRes] = await Promise.all([
            supabase.from('attractions').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5),
            supabase.from('foodShops').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5)
        ]);
        res.json([...(aRes.data || []), ...(fRes.data || [])].sort(() => 0.5 - Math.random()).slice(0, 5).map(formatRowForFrontend));
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});
app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { data } = await supabase.from('famous_products').select('*').eq('location_id', req.params.locationId);
    res.json((data || []).map(formatRowForFrontend));
});
app.get('/api/locations/:id', async (req, res) => {
    let { data: loc } = await supabase.from('attractions').select('*').eq('id', req.params.id).maybeSingle();
    if (!loc) { let { data: loc2 } = await supabase.from('foodShops').select('*').eq('id', req.params.id).maybeSingle(); loc = loc2; }
    loc ? res.json(formatRowForFrontend(loc)) : res.status(404).json({ error: 'Not found' });
});
app.post('/api/locations', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { name, category, description, googleMapUrl, hours, contact } = req.body;
    let uploadedImageUrls = [];
    try {
        uploadedImageUrls = await Promise.all((req.files || []).map(uploadToSupabase));
        const coords = extractCoordsFromUrl(googleMapUrl);
        const tableName = getLocationTableByCategory(category);
        const { data, error } = await supabase.from(tableName).insert({
            id: crypto.randomUUID(), name, category, description, google_map_url: googleMapUrl, hours, contact,
            user_id: req.user.userId, status: 'approved', image_url: uploadedImageUrls[0] || null, detail_images: uploadedImageUrls.slice(1), lat: coords.lat, lng: coords.lng
        }).select().single();
        if (error) throw error;
        createAndSendNotification({ type: 'new_location', actorId: req.user.userId, actorName: req.user.displayName, actorProfileImageUrl: req.user.profileImageUrl, recipientId: null, payload: { location: formatRowForFrontend(data) } });
        res.status(201).json(formatRowForFrontend(data));
    } catch (err) { if (uploadedImageUrls.length) await deleteFromSupabase(uploadedImageUrls); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
    // ... Same as previous (Complex logic preserved) ...
    const { id } = req.params;
    const { userId, role } = req.user;
    const { name, category: newCategory, description, googleMapUrl, hours, contact, existingImages } = req.body;
    let newlyUploadedUrls = [];
    try {
        let currentLocation = null, currentTableName = null;
        ({ data: currentLocation } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle());
        if (currentLocation) currentTableName = 'attractions';
        else { ({ data: currentLocation } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle()); if (currentLocation) currentTableName = 'foodShops'; else return res.status(404).json({ error: 'Not found' }); }
        if (role !== 'admin' && currentLocation.user_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const keptImageUrls = existingImages ? JSON.parse(existingImages) : [];
        const oldImageUrls = [currentLocation.image_url, ...(currentLocation.detail_images || [])].filter(Boolean);
        const imagesToDelete = oldImageUrls.filter(oldUrl => !keptImageUrls.includes(oldUrl));
        newlyUploadedUrls = await Promise.all((req.files || []).map(uploadToSupabase));
        await deleteFromSupabase(imagesToDelete);
        const allFinalImageUrls = [...keptImageUrls, ...newlyUploadedUrls];

        const updateData = {};
        const coords = extractCoordsFromUrl(googleMapUrl);
        if (name) updateData.name = name.trim();
        if (newCategory) updateData.category = newCategory;
        if (description !== undefined) updateData.description = description.trim();
        if (googleMapUrl) { updateData.google_map_url = googleMapUrl; updateData.lat = coords.lat; updateData.lng = coords.lng; }
        if (hours !== undefined) updateData.hours = hours.trim();
        if (contact !== undefined) updateData.contact = contact.trim();
        updateData.image_url = allFinalImageUrls[0] || null;
        updateData.detail_images = allFinalImageUrls.slice(1);

        const effectiveCategory = updateData.category || currentLocation.category;
        const newTableName = getLocationTableByCategory(effectiveCategory);
        let finalLocation;

        if (currentTableName === newTableName) {
            const { data, error } = await supabase.from(currentTableName).update(updateData).eq('id', id).select().single();
            if (error) throw error; finalLocation = data;
        } else {
            const migratedRecord = { ...currentLocation, ...updateData };
            const { data, error } = await supabase.from(newTableName).insert(migratedRecord).select().single();
            if (error) throw error;
            await supabase.from(currentTableName).delete().eq('id', id);
            finalLocation = data;
        }
        res.json(formatRowForFrontend(finalLocation));
    } catch (err) { if (newlyUploadedUrls.length) await deleteFromSupabase(newlyUploadedUrls); res.status(500).json({ error: 'Update failed' }); }
});
app.post('/api/locations/:id/request-deletion', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        let table = null, loc = null;
        ({ data: loc } = await supabase.from('attractions').select('user_id, status').eq('id', id).maybeSingle());
        if (loc) table = 'attractions'; else { ({ data: loc } = await supabase.from('foodShops').select('user_id, status').eq('id', id).maybeSingle()); if (loc) table = 'foodShops'; }
        if (!loc) return res.status(404).json({ error: 'Not found' });
        if (loc.user_id !== req.user.userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
        if (loc.status === 'pending_deletion') return res.status(400).json({ error: 'Already pending' });
        await supabase.from(table).update({ status: 'pending_deletion' }).eq('id', id);
        res.json({ message: 'Request sent' });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});
app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let loc = null;
        ({ data: loc } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle());
        if (!loc) ({ data: loc } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle());
        if (loc) await deleteFromSupabase([loc.image_url, ...(loc.detail_images || [])].filter(Boolean));
        
        // Cleanup related
        const reviews = (await supabase.from('reviews').select('id').eq('location_id', id)).data || [];
        const rIds = reviews.map(r => r.id);
        if (rIds.length) {
            const cIds = (await supabase.from('review_comments').select('id').in('review_id', rIds)).data.map(c => c.id);
            await supabase.from('comment_likes').delete().in('comment_id', cIds);
            await supabase.from('review_comments').delete().in('review_id', rIds);
            await supabase.from('review_likes').delete().in('review_id', rIds);
        }
        await supabase.from('reviews').delete().eq('location_id', id);
        await supabase.from('famous_products').delete().eq('location_id', id);
        await supabase.from('favorites').delete().eq('location_id', id);
        await supabase.from('attractions').delete().eq('id', id);
        await supabase.from('foodShops').delete().eq('id', id);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// --- REVIEWS ---
app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params;
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader) {
        try { userId = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET).userId; } catch (e) {}
    }

    try {
        const { data: reviewsData } = await supabase.from('reviews').select(`*, user_profile:user_id ( profile_image_url )`).eq('location_id', locationId).order('created_at', { ascending: false });
        if (!reviewsData) return res.json([]);

        const reviewIds = reviewsData.map(r => r.id);
        let commentCounts = {};
        if (reviewIds.length) {
            const { data: comments } = await supabase.from('review_comments').select('review_id').in('review_id', reviewIds);
            commentCounts = (comments || []).reduce((acc, c) => { acc[c.review_id] = (acc[c.review_id] || 0) + 1; return acc; }, {});
        }

        let likedIds = new Set();
        if (userId && reviewIds.length) {
            const { data: likes } = await supabase.from('review_likes').select('review_id').eq('user_id', userId).in('review_id', reviewIds);
            (likes || []).forEach(l => likedIds.add(l.review_id));
        }

        res.json(reviewsData.map(r => ({
            ...formatRowForFrontend(r),
            comments_count: commentCounts[r.id] || 0,
            user_has_liked: likedIds.has(r.id)
        })));
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params;
    const { rating, comment } = req.body;
    try {
        const urls = await Promise.all((req.files || []).map(uploadToSupabase));
        const { data: inserted, error } = await supabase.from('reviews').insert({
            id: crypto.randomUUID(), location_id: locationId, user_id: req.user.userId, author: req.user.displayName, rating, comment, image_urls: urls, likes_count: 0, created_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;

        const { data: allReviews } = await supabase.from('reviews').select('rating').eq('location_id', locationId);
        if (allReviews?.length) {
            const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);
            await Promise.allSettled([supabase.from('attractions').update({ rating: avg }).eq('id', locationId), supabase.from('foodShops').update({ rating: avg }).eq('id', locationId)]);
        }

        // Notify Owner
        let loc = null;
        ({ data: loc } = await supabase.from('attractions').select('*').eq('id', locationId).maybeSingle());
        if (!loc) ({ data: loc } = await supabase.from('foodShops').select('*').eq('id', locationId).maybeSingle());
        if (loc && String(loc.user_id) !== String(req.user.userId)) {
            createAndSendNotification({ type: 'new_review', actorId: req.user.userId, actorName: req.user.displayName, actorProfileImageUrl: req.user.profileImageUrl, recipientId: loc.user_id, payload: { location: formatRowForFrontend(loc), reviewId: inserted.id } });
        }
        res.status(201).json(formatRowForFrontend(inserted));
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ... (PUT/DELETE Reviews omitted, same logic) ...
app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    // Standard update logic
    const { reviewId } = req.params;
    const { rating, comment, existingImages, locationId } = req.body;
    const { userId, role } = req.user;
    let newUrls = [];
    try {
        const { data: review } = await supabase.from('reviews').select('*').eq('id', reviewId).single();
        if (!review || (review.user_id !== userId && role !== 'admin')) return res.status(403).json({ error: 'Unauthorized' });
        
        const kept = existingImages ? JSON.parse(existingImages) : [];
        await deleteFromSupabase((review.image_urls || []).filter(u => !kept.includes(u)));
        newUrls = await Promise.all((req.files || []).map(uploadToSupabase));
        
        const update = { image_urls: [...kept, ...newUrls] };
        if (rating) update.rating = rating;
        if (comment) update.comment = comment.trim();
        
        const { data: updated } = await supabase.from('reviews').update(update).eq('id', reviewId).select().single();
        
        if (rating) {
            const lid = review.location_id || locationId;
            const { data: all } = await supabase.from('reviews').select('rating').eq('location_id', lid);
            if(all) {
                const avg = (all.reduce((s,r)=>s+r.rating,0)/all.length).toFixed(1);
                await Promise.allSettled([supabase.from('attractions').update({rating:avg}).eq('id',lid), supabase.from('foodShops').update({rating:avg}).eq('id',lid)]);
            }
        }
        res.json(formatRowForFrontend(updated));
    } catch(e) { if(newUrls.length) await deleteFromSupabase(newUrls); res.status(500).json({error:'Failed'}); }
});
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: r } = await supabase.from('reviews').select('*').eq('id', reviewId).single();
        if (!r || (r.user_id !== userId && role !== 'admin')) return res.status(403).json({ error: 'Unauthorized' });
        await deleteFromSupabase(r.image_urls);
        await supabase.from('review_comments').delete().eq('review_id', reviewId);
        await supabase.from('review_likes').delete().eq('review_id', reviewId);
        await supabase.from('reviews').delete().eq('id', reviewId);
        
        const lid = r.location_id;
        const { data: all } = await supabase.from('reviews').select('rating').eq('location_id', lid);
        if(all) {
            const avg = all.length ? (all.reduce((s,x)=>s+x.rating,0)/all.length).toFixed(1) : 0;
            await Promise.allSettled([supabase.from('attractions').update({rating:avg}).eq('id',lid), supabase.from('foodShops').update({rating:avg}).eq('id',lid)]);
        }
        res.status(204).send();
    } catch(e) { res.status(500).json({error:'Failed'}); }
});

app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, displayName, profileImageUrl } = req.user;
    try {
        const { count } = await supabase.from('review_likes').select('*', { count: 'exact', head: true }).match({ user_id: userId, review_id: reviewId });
        let status;
        if (count > 0) {
            await supabase.from('review_likes').delete().match({ user_id: userId, review_id: reviewId });
            status = 'unliked';
        } else {
            await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId });
            status = 'liked';
            const { data: r } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
            if (r && String(r.user_id) !== String(userId)) {
                let loc = null;
                ({ data: loc } = await supabase.from('attractions').select('*').eq('id', r.location_id).maybeSingle());
                if (!loc) ({ data: loc } = await supabase.from('foodShops').select('*').eq('id', r.location_id).maybeSingle());
                if (loc) createAndSendNotification({ type: 'new_like', actorId: userId, actorName: displayName, actorProfileImageUrl: profileImageUrl, recipientId: r.user_id, payload: { location: formatRowForFrontend(loc), reviewId: reviewId } });
            }
        }
        const { count: likesCount } = await supabase.from('review_likes').select('*', { count: 'exact', head: true }).eq('review_id', reviewId);
        await supabase.from('reviews').update({ likes_count: likesCount }).eq('id', reviewId);
        res.json({ status, likesCount });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// --- COMMENTS ---
app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { data } = await supabase.from('review_comments').select(`*, user_profile:user_id ( profile_image_url )`).eq('review_id', req.params.reviewId).order('created_at');
    res.json((data || []).map(formatRowForFrontend));
});

// POST Comment (Improved Mentions)
app.post('/api/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const { userId, displayName, profileImageUrl } = req.user;

    if (!comment) return res.status(400).json({ error: 'Empty comment' });

    try {
        const { data: inserted, error } = await supabase.from('review_comments').insert({
            id: crypto.randomUUID(), review_id: reviewId, user_id: userId, author: displayName, comment: comment.trim(), likes_count: 0, created_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;

        const { data: review } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
        let location = null;
        if (review) {
            ({ data: location } = await supabase.from('attractions').select('name, image_url').eq('id', review.location_id).maybeSingle());
            if (!location) ({ data: location } = await supabase.from('foodShops').select('name, image_url').eq('id', review.location_id).maybeSingle());
        }

        if (location) {
            // Notify Reply
            if (String(review.user_id) !== String(userId)) {
                createAndSendNotification({
                    type: 'new_reply', actorId: userId, actorName: displayName, actorProfileImageUrl: profileImageUrl, recipientId: review.user_id,
                    payload: { location: formatRowForFrontend(location), commentSnippet: comment.substring(0, 50), reviewId: reviewId, commentId: inserted.id }
                });
            }

            // Notify Mentions
            // Matches @Username (Allows Thai chars, alphanumeric, spaces if needed for loose match logic)
            const mentionRegex = /@([\w\u0E00-\u0E7F\s]+)/g; 
            const potentialNames = [...comment.matchAll(mentionRegex)].map(m => m[1].trim());
            
            if (potentialNames.length > 0) {
                // Search by Username OR Display Name
                const { data: mentionedUsers } = await supabase
                    .from('users')
                    .select('id, username, display_name')
                    .or(`username.in.(${potentialNames.join(',')}),display_name.in.(${potentialNames.join(',')})`);
                
                if (mentionedUsers?.length) {
                    const notified = new Set();
                    mentionedUsers.forEach(mUser => {
                        if (String(mUser.id) !== String(userId) && !notified.has(mUser.id)) {
                            notified.add(mUser.id);
                            createAndSendNotification({
                                type: 'mention', actorId: userId, actorName: displayName, actorProfileImageUrl: profileImageUrl, recipientId: mUser.id,
                                payload: { location: formatRowForFrontend(location), commentSnippet: comment.substring(0, 50), reviewId: reviewId, commentId: inserted.id }
                            });
                        }
                    });
                }
            }
        }
        res.status(201).json(formatRowForFrontend({ ...inserted, user_profile: { profile_image_url: profileImageUrl } }));
    } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// ... (PUT/DELETE Comment, Toggle Like Comment - Same as before) ...
app.put('/api/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { data: c } = await supabase.from('review_comments').select('user_id').eq('id', req.params.commentId).single();
        if (!c || (c.user_id !== req.user.userId && req.user.role !== 'admin')) return res.status(403).json({ error: 'Unauthorized' });
        await supabase.from('review_comments').update({ comment: req.body.comment.trim() }).eq('id', req.params.commentId);
        res.json({ message: 'Updated' });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { data: c } = await supabase.from('review_comments').select('user_id').eq('id', req.params.commentId).single();
        if (!c || (c.user_id !== req.user.userId && req.user.role !== 'admin')) return res.status(403).json({ error: 'Unauthorized' });
        await supabase.from('comment_likes').delete().eq('comment_id', req.params.commentId);
        await supabase.from('review_comments').delete().eq('id', req.params.commentId);
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
app.post('/api/comments/:commentId/toggle-like', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, displayName, profileImageUrl } = req.user;
    try {
        const { count } = await supabase.from('comment_likes').select('*', { count: 'exact', head: true }).match({ user_id: userId, comment_id: commentId });
        let status;
        if (count > 0) { await supabase.from('comment_likes').delete().match({ user_id: userId, comment_id: commentId }); status = 'unliked'; }
        else { await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId }); status = 'liked';
            const { data: c } = await supabase.from('review_comments').select('user_id, review_id, comment').eq('id', commentId).single();
            if (c && String(c.user_id) !== String(userId)) {
                const { data: r } = await supabase.from('reviews').select('location_id').eq('id', c.review_id).single();
                if (r) {
                    let loc = null;
                    ({ data: loc } = await supabase.from('attractions').select('name, image_url').eq('id', r.location_id).maybeSingle());
                    if (!loc) ({ data: loc } = await supabase.from('foodShops').select('name, image_url').eq('id', r.location_id).maybeSingle());
                    if (loc) createAndSendNotification({ type: 'new_comment_like', actorId: userId, actorName: displayName, actorProfileImageUrl: profileImageUrl, recipientId: c.user_id, payload: { location: formatRowForFrontend(loc), commentSnippet: c.comment.substring(0, 30), reviewId: c.review_id, commentId: commentId } });
                }
            }
        }
        const { count: likesCount } = await supabase.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId);
        await supabase.from('review_comments').update({ likes_count: likesCount }).eq('id', commentId);
        res.json({ status, likesCount });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Auth & Favorites (Same as before)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid' });
    const formatted = formatRowForFrontend(user);
    const token = jwt.sign({ userId: formatted.id, username: formatted.username, displayName: formatted.displayName, role: formatted.role, profileImageUrl: formatted.profileImageUrl }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Success', user: formatted, token });
});
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || password.length < 6) return res.status(400).json({ error: 'Invalid' });
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Taken' });
    const hashed = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert({ id: crypto.randomUUID(), username, password: hashed, display_name: username, role: 'user' });
    if (error) return res.status(400).json({ error: 'Failed' });
    res.status(201).json({ message: 'Success' });
});
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const { data } = await supabase.from('favorites').select('location_id').eq('user_id', req.user.userId);
    res.json((data || []).map(f => f.location_id));
});
app.post('/api/favorites/toggle', authenticateToken, async (req, res) => {
    const { locationId } = req.body;
    const { userId } = req.user;
    const { count } = await supabase.from('favorites').select('*', { count: 'exact', head: true }).match({ user_id: userId, location_id: locationId });
    if (count > 0) { await supabase.from('favorites').delete().match({ user_id: userId, location_id: locationId }); res.json({ status: 'removed' }); }
    else { await supabase.from('favorites').insert({ user_id: userId, location_id: locationId }); res.json({ status: 'added' }); }
});

app.listen(port, () => {
    console.log(`✅✅✅ MERGED SERVER RUNNING at http://localhost:${port}`);
});