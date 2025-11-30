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

console.log('--- SERVER (FULL PRODUCTION VERSION - FAMOUS PRODUCTS FIXED) LOADING ---');

// --- 🔴 CONFIG: SUPABASE & JWT ---
// 1. SUPABASE URL
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fsbfiefjtyejfzgisjco.supabase.co';

// 2. SUPABASE SERVICE ROLE KEY (สำคัญมาก: ต้องใช้ Key ที่มีสิทธิ์ Admin)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_uhFN-2AUL8e8F1B_wboLfw_2qgOscEx'; 

// ตรวจสอบความถูกต้องของ Key เบื้องต้น
if (SUPABASE_SERVICE_KEY.startsWith('sb_publishable')) {
    console.error('🚨 CRITICAL ERROR: You are using a PUBLISHABLE KEY for the Backend.');
    console.error('   Please update SUPABASE_SERVICE_KEY env var to use the SERVICE_ROLE KEY (starts with sb_secret).');
    console.error('   Otherwise, database writes (Sync/Register/Admin actions) WILL FAIL.');
}

// 3. JWT SECRET (สำหรับถอดรหัส Token)
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'TmVDE+mlHk4VsWVIYUqY8mNSCMCQzkGTunEZfX6KIcOSjveLAEXhCW9X37ehDunj+MbZgbgACYbBZaEuJRH9GA==';

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
const BUCKET_NAME = 'image-uploads';

const app = express();
const port = process.env.PORT || 5000;
let clients = []; // For SSE connections

// --- 🌐 CORS CONFIGURATION ---
const allowedOrigins = [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://bangkok-guide.vercel.app', 
    process.env.FRONTEND_URL 
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o) || o === origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            // Allow temporarily for debugging connection issues
            callback(null, true); 
        }
    },
    credentials: true 
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 🔐 AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader; 

    // รองรับ SSE Token (Query Param)
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token is required.' });
    }

    jwt.verify(token, SUPABASE_JWT_SECRET, async (err, userPayload) => {
        if (err) {
            console.error("Token verification failed:", err.message);
            if (req.path === '/api/events') return res.end(); 
            return res.status(403).json({ error: 'Forbidden: Token is not valid.' });
        }
        
        let userId = userPayload.sub || userPayload.userId; 

        req.user = {
            ...userPayload,
            userId: userId,
            displayName: userPayload.user_metadata?.full_name || userPayload.user_metadata?.name || userPayload.displayName || 'User',
            profileImageUrl: userPayload.user_metadata?.avatar_url || userPayload.user_metadata?.picture || userPayload.profileImageUrl || null,
            role: userPayload.app_metadata?.role || userPayload.role || 'user'
        };
        
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

    if (error) {
        console.error("Upload Error:", error);
        throw new Error('Failed to upload file to Supabase.');
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
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
        
        reply_to_id: row.reply_to_id || row.parent_id || null, 

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

const getLocationTableByCategory = (category) => ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(category) ? 'foodShops' : 'attractions';

// --- 🔔 NOTIFICATION SYSTEM & SSE ---
async function createAndSendNotification({ type, actorId, actorName, actorProfileImageUrl, recipientId, payload }) {
    try {
        const safeActorId = String(actorId);
        const safeRecipientId = recipientId ? String(recipientId) : null;

        if (safeRecipientId && safeRecipientId === safeActorId) return; 

        const notificationData = {
            actor_id: safeActorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl || null,
            type: type,
            payload: payload,
            is_read: false,
            created_at: new Date().toISOString(),
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

        const liveEventPayload = { type: 'notification', data: { id: crypto.randomUUID(), ...notificationData } };
        
        clients.forEach(client => {
            const clientUserId = String(client.userId);
            let shouldSend = false;
            if (safeRecipientId) { 
                if (clientUserId === safeRecipientId && clientUserId !== safeActorId) shouldSend = true;
            } else if (type === 'new_location') { 
                if (clientUserId !== safeActorId) shouldSend = true;
            }
            if (shouldSend) {
                try { client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`); } catch (e) {}
            }
        });
    } catch (error) {
        console.error('❌ Notification System Error:', error);
    }
}

// SSE Heartbeat
setInterval(() => {
    clients.forEach(client => {
        try { client.res.write(':keep-alive\n\n'); } 
        catch (e) { clients = clients.filter(c => c.id !== client.id); }
    });
}, 15000);

// SSE Endpoint
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

// ✅ SOCIAL LOGIN
app.post('/api/auth/social-login', async (req, res) => {
    const { email, displayName, photoUrl, uid } = req.body; 

    if (!email || !uid) return res.status(400).json({ error: 'Email and UID are required' });

    console.log(`👤 Processing Social Login for: ${email} (${uid})`);

    try {
        let { data: user } = await supabase.from('users').select('*').eq('id', uid).maybeSingle(); 

        if (!user) {
            ({ data: user } = await supabase.from('users').select('*').eq('username', email).maybeSingle());
        }

        if (!user) {
            console.log('✨ Creating new user from Social Login...');
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    id: uid, 
                    username: email, 
                    password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
                    display_name: displayName || email.split('@')[0],
                    profile_image_url: photoUrl ? [photoUrl] : [],
                    role: 'user'
                })
                .select()
                .single();

            if (createError) {
                console.error('❌ Social Register Error:', createError);
                return res.status(500).json({ error: createError.message });
            }
            user = newUser;
        }

        const token = jwt.sign(
            { 
                sub: user.id, 
                userId: user.id, 
                email: user.username,
                role: user.role,
                user_metadata: { full_name: user.display_name, avatar_url: user.profile_image_url?.[0] } 
            }, 
            SUPABASE_JWT_SECRET, 
            { expiresIn: '1d' }
        );

        res.json({ message: 'Social Login Success', user: formatRowForFrontend(user), token });

    } catch (err) {
        console.error('Social Login Exception:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const token = jwt.sign(
            { sub: user.id, userId: user.id, role: user.role, user_metadata: { full_name: user.display_name, avatar_url: user.profile_image_url?.[0] } }, 
            SUPABASE_JWT_SECRET, 
            { expiresIn: '1d' }
        );
        res.json({ message: 'Success', user: formatRowForFrontend(user), token });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
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

// Users
app.get('/api/users', async (req, res) => {
    try {
        const { data } = await supabase.from('users').select('id, username, display_name, profile_image_url');
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/users/search', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);
    try {
        const { data } = await supabase.from('users').select('id, username, display_name, profile_image_url').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(5);
        res.json((data || []).map(formatRowForFrontend));
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Profile
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { data: user } = await supabase.from('users').select('id, username, display_name, profile_image_url, role').eq('id', req.params.userId).single();
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(formatRowForFrontend(user));
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/users/:userIdToUpdate', authenticateToken, upload.single('profileImage'), async (req, res) => {
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
            const token = jwt.sign({ sub: formatted.id, userId: formatted.id, username: formatted.username, displayName: formatted.displayName, role: formatted.role }, SUPABASE_JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'No changes', user: formatted, token });
        }
        const { data: updated } = await supabase.from('users').update(updateData).eq('id', userIdToUpdate).select().single();
        const formatted = formatRowForFrontend(updated);
        const token = jwt.sign({ sub: formatted.id, userId: formatted.id, username: formatted.username, displayName: formatted.displayName, role: formatted.role }, SUPABASE_JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: 'Updated', user: formatted, token });
    } catch (err) {
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Notifications
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

app.delete('/api/notifications', authenticateToken, async (req, res) => {
    await supabase.from('notifications').delete().eq('user_id', req.user.userId);
    res.json({ message: 'Cleared all' });
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    await supabase.from('notifications').delete().match({ id: req.params.id, user_id: req.user.userId });
    res.json({ message: 'Deleted' });
});

// --- ✅ ADMIN ROUTES (Fix: Famous Products & Deletion Requests) ---
// 1. GET ALL FAMOUS PRODUCTS (For Admin) - Includes User Info
app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Fetch products
        const { data } = await supabase.from('famous_products').select('*').order('created_at', { ascending: false });
        
        // Fetch auxiliary data for mapping
        const locationMap = new Map();
        const userMap = new Map();
        
        const [aRes, fRes, uRes] = await Promise.all([
             supabase.from('attractions').select('id, name'),
             supabase.from('foodShops').select('id, name'),
             supabase.from('users').select('id, display_name, profile_image_url')
        ]);

        (aRes.data || []).forEach(l => locationMap.set(l.id, l.name));
        (fRes.data || []).forEach(l => locationMap.set(l.id, l.name));
        (uRes.data || []).forEach(u => userMap.set(u.id, u)); // Store full user obj

        const result = (data || []).map(item => {
            const author = userMap.get(item.user_id);
            return {
                ...formatRowForFrontend(item),
                locationName: item.location_id ? (locationMap.get(item.location_id) || 'ไม่พบสถานที่') : 'ส่วนกลาง',
                // Explicitly overwrite author info if available
                author: author ? author.display_name : 'Unknown',
                profileImageUrl: author ? (author.profile_image_url?.[0] || null) : null
            };
        });
        res.json(result);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Failed' }); 
    }
});

// 2. GET DELETION REQUESTS (For Admin)
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [aRes, fRes] = await Promise.all([
            supabase.from('attractions').select('*').eq('status', 'pending_deletion'),
            supabase.from('foodShops').select('*').eq('status', 'pending_deletion')
        ]);
        const combined = [...(aRes.data || []), ...(fRes.data || [])];
        res.json(combined.map(formatRowForFrontend));
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Failed' }); 
    }
});

app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await supabase.from('attractions').update({ status: 'approved' }).eq('id', id).eq('status', 'pending_deletion');
        await supabase.from('foodShops').update({ status: 'approved' }).eq('id', id).eq('status', 'pending_deletion');
        res.json({ message: 'Denied' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Failed' }); 
    }
});

app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let loc = null;
        ({ data: loc } = await supabase.from('attractions').select('*').eq('id', id).maybeSingle());
        if (!loc) ({ data: loc } = await supabase.from('foodShops').select('*').eq('id', id).maybeSingle());
        if (loc) await deleteFromSupabase([loc.image_url, ...(loc.detail_images || [])].filter(Boolean));
        
        // Cleanup related data
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

// --- LOCATIONS & PRODUCTS ---
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
    } catch (e) { res.json([]); }
});

app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { data } = await supabase.from('famous_products').select('*').eq('location_id', req.params.locationId);
    res.json((data || []).map(formatRowForFrontend));
});

app.get('/api/famous-products/random', async (req, res) => {
    const { data } = await supabase.from('famous_products').select('*').is('location_id', null);
    const shuffled = (data || []).sort(() => 0.5 - Math.random()).slice(0, 2);
    res.json(shuffled.map(formatRowForFrontend));
});

app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    let imageUrl = null;
    try {
        imageUrl = await uploadToSupabase(req.file);
        const { data } = await supabase.from('famous_products').insert({ id: crypto.randomUUID(), name: name.trim(), description: description?.trim() || '', imageurl: imageUrl, location_id: locationId || null, user_id: req.user.userId }).select().single();
        res.status(201).json(formatRowForFrontend(data));
    } catch (err) { if(imageUrl) await deleteFromSupabase(imageUrl); res.status(500).json({ error: 'Failed' }); }
});

// ✅ ADDED: PUT Endpoint for Editing Famous Products
app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description, locationId } = req.body;
    const { userId, role } = req.user;
    let newImageUrl = null;
    try {
        const { data: product } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (!product) return res.status(404).json({ error: 'Not found' });
        // Admin or Owner
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (locationId) updateData.location_id = locationId;
        
        if (req.file) {
            await deleteFromSupabase(product.imageurl);
            newImageUrl = await uploadToSupabase(req.file);
            updateData.imageurl = newImageUrl;
        }

        const { data: updated } = await supabase.from('famous_products').update(updateData).eq('id', id).select().single();
        res.json(formatRowForFrontend(updated));
    } catch (err) {
        if (newImageUrl) await deleteFromSupabase(newImageUrl);
        res.status(500).json({ error: 'Failed' });
    }
});

// IMPORTANT: This route must be BELOW '/api/famous-products/all' or 'all' will be treated as an ID
app.get('/api/famous-products/:id', async (req, res) => {
    const { data: product } = await supabase.from('famous_products').select('*').eq('id', req.params.id).single();
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(formatRowForFrontend(product));
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

app.get('/api/locations/:id', async (req, res) => {
    let { data: loc } = await supabase.from('attractions').select('*').eq('id', req.params.id).maybeSingle();
    if (!loc) ({ data: loc } = await supabase.from('foodShops').select('*').eq('id', req.params.id).maybeSingle());
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

// --- REVIEWS & COMMENTS ---
app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params;
    const authHeader = req.headers['authorization'];
    let userId = null;
    
    if (authHeader) {
        try { 
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
            userId = decoded.sub || decoded.userId;
        } catch (e) {}
    }

    try {
        const { data: reviewsData } = await supabase
            .from('reviews')
            .select(`*, user_profile:user_id ( profile_image_url )`)
            .eq('location_id', locationId)
            .order('created_at', { ascending: false });
        
        if (!reviewsData) return res.json([]);

        const reviewIds = reviewsData.map(r => r.id);
        let allComments = [];
        if (reviewIds.length > 0) {
            const { data: commentsData } = await supabase
                .from('review_comments')
                .select(`*, user_profile:user_id ( profile_image_url )`)
                .in('review_id', reviewIds)
                .order('created_at', { ascending: true });
            allComments = commentsData || [];
        }

        let commentCounts = {};
        if (reviewIds.length) {
            commentCounts = allComments.reduce((acc, c) => { acc[c.review_id] = (acc[c.review_id] || 0) + 1; return acc; }, {});
        }

        let likedIds = new Set();
        if (userId && reviewIds.length) {
            const { data: likes } = await supabase.from('review_likes').select('review_id').eq('user_id', userId).in('review_id', reviewIds);
            (likes || []).forEach(l => likedIds.add(l.review_id));
        }

        const formattedReviews = reviewsData.map(r => ({
            ...formatRowForFrontend(r),
            comments_count: commentCounts[r.id] || 0,
            user_has_liked: likedIds.has(r.id),
            reply_to_id: null 
        }));

        const formattedComments = allComments.map(c => ({
            ...formatRowForFrontend(c),
            reply_to_id: c.reply_to_id || c.review_id 
        }));

        res.json([...formattedReviews, ...formattedComments]);

    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Failed' }); 
    }
});

app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params;
    const { rating, comment, mentionedUserIds, reply_to_id } = req.body; 

    // REPLY LOGIC
    if (reply_to_id) {
        let reviewId = reply_to_id; 
        const { data: parentReview } = await supabase.from('reviews').select('id').eq('id', reply_to_id).maybeSingle();
        
        if (!parentReview) {
            const { data: parentComment } = await supabase.from('review_comments').select('review_id').eq('id', reply_to_id).maybeSingle();
            if (parentComment) {
                reviewId = parentComment.review_id;
            } else {
                return res.status(404).json({ error: 'Parent not found' });
            }
        }

        try {
            const { userId, displayName, profileImageUrl } = req.user;
            const { data: inserted, error } = await supabase.from('review_comments').insert({
                id: crypto.randomUUID(), 
                review_id: reviewId, 
                user_id: userId, 
                author: displayName, 
                comment: comment.trim(), 
                likes_count: 0, 
                created_at: new Date().toISOString(),
                reply_to_id: reply_to_id
            }).select().single();

            if (error) throw error;
            
            // Notification logic
             let loc = null;
            const { data: r } = await supabase.from('reviews').select('location_id, user_id').eq('id', reviewId).single();
            if (r) {
                ({ data: loc } = await supabase.from('attractions').select('id, name, image_url').eq('id', r.location_id).maybeSingle());
                if (!loc) ({ data: loc } = await supabase.from('foodShops').select('id, name, image_url').eq('id', r.location_id).maybeSingle());
                
                if (loc) {
                    let recipientId = null;
                    const { data: parentComment } = await supabase.from('review_comments').select('user_id').eq('id', reply_to_id).maybeSingle();
                    if (parentComment) recipientId = parentComment.user_id;
                    else recipientId = r.user_id;

                    if (recipientId && String(recipientId) !== String(userId)) {
                         createAndSendNotification({
                            type: 'new_reply', 
                            actorId: userId, 
                            actorName: displayName, 
                            actorProfileImageUrl: profileImageUrl, 
                            recipientId: recipientId,
                            payload: { location: formatRowForFrontend(loc), commentSnippet: comment.substring(0, 50), reviewId: reviewId, commentId: inserted.id }
                        });
                    }
                }
            }

            return res.status(201).json(formatRowForFrontend({ ...inserted, user_profile: { profile_image_url: profileImageUrl } }));
        } catch(e) { return res.status(500).json({ error: 'Failed to create reply' }); }
    }

    // NEW REVIEW LOGIC
    try {
        const urls = await Promise.all((req.files || []).map(uploadToSupabase));
        const { data: inserted, error } = await supabase.from('reviews').insert({
            id: crypto.randomUUID(), location_id: locationId, user_id: req.user.userId, author: req.user.displayName, rating, comment, image_urls: urls, likes_count: 0, created_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;

        // Recalculate Rating
        const { data: allReviews } = await supabase.from('reviews').select('rating').eq('location_id', locationId);
        if (allReviews?.length) {
            const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);
            await Promise.allSettled([supabase.from('attractions').update({ rating: avg }).eq('id', locationId), supabase.from('foodShops').update({ rating: avg }).eq('id', locationId)]);
        }

        // Notify Owner
        let loc = null;
        ({ data: loc } = await supabase.from('attractions').select('id, name, image_url, user_id').eq('id', locationId).maybeSingle());
        if (!loc) ({ data: loc } = await supabase.from('foodShops').select('id, name, image_url, user_id').eq('id', locationId).maybeSingle());
        
        if (loc && String(loc.user_id) !== String(req.user.userId)) {
            createAndSendNotification({ type: 'new_review', actorId: req.user.userId, actorName: req.user.displayName, actorProfileImageUrl: req.user.profileImageUrl, recipientId: loc.user_id, payload: { location: formatRowForFrontend(loc), reviewId: inserted.id } });
        }

        res.status(201).json(formatRowForFrontend(inserted));
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
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
    const { userId } = req.user;
    const { count } = await supabase.from('review_likes').select('*', { count: 'exact', head: true }).match({ user_id: userId, review_id: reviewId });
    if (count > 0) await supabase.from('review_likes').delete().match({ user_id: userId, review_id: reviewId });
    else await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId });
    const { count: newCount } = await supabase.from('review_likes').select('*', { count: 'exact', head: true }).eq('review_id', reviewId);
    await supabase.from('reviews').update({ likes_count: newCount }).eq('id', reviewId);
    res.json({ likesCount: newCount });
});

app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { data } = await supabase.from('review_comments').select(`*, user_profile:user_id ( profile_image_url )`).eq('review_id', req.params.reviewId).order('created_at');
    res.json((data || []).map(formatRowForFrontend));
});

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
                    ({ data: loc } = await supabase.from('attractions').select('id, name, image_url').eq('id', r.location_id).maybeSingle());
                    if (!loc) ({ data: loc } = await supabase.from('foodShops').select('id, name, image_url').eq('id', r.location_id).maybeSingle());
                    if (loc) createAndSendNotification({ type: 'new_comment_like', actorId: userId, actorName: displayName, actorProfileImageUrl: profileImageUrl, recipientId: c.user_id, payload: { location: formatRowForFrontend(loc), commentSnippet: c.comment.substring(0, 30), reviewId: c.review_id, commentId: commentId } });
                }
            }
        }
        const { count: likesCount } = await supabase.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId);
        await supabase.from('review_comments').update({ likes_count: likesCount }).eq('id', commentId);
        res.json({ status, likesCount });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Favorites
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
    console.log(`✅✅✅ SERVER RUNNING at port ${port}`);
});