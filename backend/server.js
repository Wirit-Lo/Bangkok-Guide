// Import necessary modules
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import 'dotenv/config';

console.log('--- SERVER MIGRATED TO SUPABASE (v18.6 - FINAL JSONB FIX) LOADING ---');

// --- Supabase Client Setup ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.JWT_SECRET) {
    console.error('CRITICAL ERROR: SUPABASE_URL, SUPABASE_SERVICE_KEY, and JWT_SECRET must be defined in your .env file');
    process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
// ❗️ DEPLOYMENT EDIT: Use environment variable for port, default to 5000 for local development
const port = process.env.PORT || 5000;
let clients = []; // Array to store Server-Sent Events (SSE) clients

// --- Middleware ---

// ❗️ DEPLOYMENT EDIT: Dynamic CORS configuration for deployment
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));
app.use(express.json());

// Setup for serving uploaded files
const __dirname = path.resolve();
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
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
        if (err) return res.status(403).json({ error: 'Forbidden: Token is not valid.' });
        req.user = userPayload;
        next();
    });
};

// Middleware to check for admin role
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access is required for this action.' });
    }
};

// --- Helper Functions ---
const constructFullUrl = (relativePath) => {
    if (!relativePath || relativePath.startsWith('http')) return relativePath;
    // 💡 DEPLOYMENT NOTE: Set BASE_URL in your deployment environment (e.g., https://your-backend.onrender.com)
    const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
    return `${baseURL}${relativePath}`;
};

const formatRowForFrontend = (row) => {
    if (!row) return null;

    if ('display_name' in row) {
        return {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            profileImageUrl: constructFullUrl(
                Array.isArray(row.profile_image_url) && row.profile_image_url.length > 0
                ? row.profile_image_url[0]
                : row.profile_image_url
            ),
            role: row.role
        };
    }

    if ('imageurl' in row) {
        row.image_url = row.imageurl;
    }

    return {
        ...row,
        rating: row.rating === null || row.rating === undefined ? 0 : parseFloat(row.rating || 0),
        coords: { lat: row.lat, lng: row.lng },
        googleMapUrl: row.google_map_url,
        imageUrl: constructFullUrl(row.image_url),
        detailImages: Array.isArray(row.detail_images) ? row.detail_images.map(constructFullUrl) : [],
    };
};

const extractCoordsFromUrl = (url) => {
    if (!url) return { lat: null, lng: null };
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    return match ? { lat: parseFloat(match[1]), lng: parseFloat(match[2]) } : { lat: null, lng: null };
};

async function createAndSendNotification({ type, actorId, actorName, actorProfileImageUrl, recipientId, payload }) {
    try {
        const liveNotification = {
            id: crypto.randomUUID(),
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl,
            type: type,
            payload: payload,
            is_read: false,
            created_at: new Date().toISOString(),
        };

        const dbNotificationPayload = {};
        if (payload.location) {
            dbNotificationPayload.locationId = payload.location.id;
            dbNotificationPayload.locationName = payload.location.name;
            dbNotificationPayload.locationImageUrl = payload.location.imageUrl;
        }
        if (payload.product) {
            dbNotificationPayload.productName = payload.product.name;
            if (payload.product.image_url) {
                dbNotificationPayload.productImageUrl = constructFullUrl(payload.product.image_url);
            }
        }
        if (payload.commentSnippet) {
            dbNotificationPayload.commentSnippet = payload.commentSnippet;
        }

        const dbNotification = {
            actor_id: actorId,
            actor_name: actorName,
            actor_profile_image_url: actorProfileImageUrl,
            type: type,
            payload: dbNotificationPayload,
            is_read: false,
        };

        if (recipientId && recipientId !== actorId) {
            await supabase.from('notifications').insert({ ...dbNotification, user_id: recipientId });
        } else if (!recipientId) {
            const { data: users } = await supabase.from('users').select('id').neq('id', actorId);
            if (users && users.length > 0) {
                const notificationsToInsert = users.map(user => ({ ...dbNotification, user_id: user.id }));
                await supabase.from('notifications').insert(notificationsToInsert);
            }
        }

        const liveEventPayload = { type: 'notification', data: liveNotification };
        clients.forEach(client => {
            if (recipientId) {
                if (client.userId === recipientId && client.userId !== actorId) {
                    client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                }
            } else {
                if (client.userId !== actorId) {
                    client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
                }
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
            clients = clients.filter(c => c.id !== client.id);
            console.log(`Client ${client.id} disconnected (Heartbeat failed). Remaining clients: ${clients.length}`);
        }
    });
};
setInterval(sendHeartbeat, 15000);


// --- API Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '18.6', database: 'supabase' }));

app.get('/api/events', authenticateToken, async (req, res) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    };
    res.writeHead(200, headers);

    const clientId = Date.now();
    const newClient = { id: clientId, res: res, userId: req.user.userId };
    clients.push(newClient);

    res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);
    
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
            newClient.res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
    } catch (err) {
        console.error(`[SSE ERROR] Could not fetch past notifications for user ${req.user.userId}:`, err);
    }

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`Client ${clientId} disconnected. Remaining clients: ${clients.length}`);
    });
});

// ... (The rest of the endpoints are unchanged)
// --- User Profile Endpoints ---
app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, display_name, profile_image_url, role')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!user) return res.status(404).json({ error: 'User not found.' });
        
        res.json(formatRowForFrontend(user));
    } catch (err) {
        if (err.code === 'PGRST116') {
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
        let needsPasswordVerification = false;

        if (newPassword) needsPasswordVerification = true;
        if (username && username !== user.username) needsPasswordVerification = true;

        if (needsPasswordVerification) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
            }
        }
        
        if (displayName && displayName !== user.display_name) {
            updateData.display_name = displayName;
            await supabase.from('reviews').update({ author: displayName }).eq('user_id', userIdToUpdate);
            await supabase.from('review_comments').update({ author: displayName }).eq('user_id', userIdToUpdate);
        }

        if (username && username !== user.username) {
            const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
            if (existingUser && existingUser.id !== userIdToUpdate) {
                return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
            }
            updateData.username = username;
        }

        if (newPassword) {
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        if (req.file) {
            updateData.profile_image_url = [`/uploads/${req.file.filename}`];
        }

        if (Object.keys(updateData).length === 0) {
            const token = jwt.sign({ userId: user.id, username: user.username, displayName: user.display_name, role: user.role, profileImageUrl: user.profile_image_url?.[0] || null }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต', user: formatRowForFrontend(user), token });
        }
        
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userIdToUpdate)
            .select('id, username, display_name, profile_image_url, role')
            .single();

        if (updateError) throw updateError;
        
        const profileImageUrl = Array.isArray(updatedUser.profile_image_url) && updatedUser.profile_image_url.length > 0 ? updatedUser.profile_image_url[0] : updatedUser.profile_image_url;
        const token = jwt.sign({ 
            userId: updatedUser.id, 
            username: updatedUser.username, 
            displayName: updatedUser.display_name, 
            role: updatedUser.role,
            profileImageUrl: profileImageUrl
        }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ!', user: formatRowForFrontend(updatedUser), token });

    } catch (err) {
        console.error(`[ERROR] Updating profile for ${userIdToUpdate}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});

app.delete('/api/users/:userIdToDelete', authenticateToken, async (req, res) => {
    const { userIdToDelete } = req.params;
    const { userId: authenticatedUserId, role } = req.user;
    const { currentPassword } = req.body;

    if (userIdToDelete !== authenticatedUserId && role !== 'admin') {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบบัญชีนี้' });
    }
    if (!currentPassword) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ' });
    }

    try {
        const { data: user, error: fetchError } = await supabase.from('users').select('password').eq('id', userIdToDelete).single();
        if (fetchError || !user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        await supabase.from('review_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('comment_likes').delete().eq('user_id', userIdToDelete);
        await supabase.from('review_comments').delete().eq('user_id', userIdToDelete);
        await supabase.from('reviews').delete().eq('user_id', userIdToDelete);
        await supabase.from('favorites').delete().eq('user_id', userIdToDelete);
        await supabase.from('famous_products').delete().eq('user_id', userIdToDelete);
        await supabase.from('attractions').delete().eq('user_id', userIdToDelete);
        await supabase.from('foodShops').delete().eq('user_id', userIdToDelete);
        await supabase.from('users').delete().eq('id', userIdToDelete);

        res.json({ message: 'ลบบัญชีผู้ใช้สำเร็จ' });

    } catch(err) {
        console.error(`[ERROR] Deleting account for ${userIdToDelete}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดระหว่างการลบบัญชี' });
    }
});

// --- Notifications Endpoints ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch notifications.' });
    }
});

app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.userId)
            .eq('is_read', false);
        if (error) throw error;
        res.json({ count: count || 0 });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch unread count.' });
    }
});

app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.userId).eq('is_read', false);
        if (error) throw error;
        res.status(200).json({ message: 'Notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not mark notifications as read.' });
    }
});

// --- Famous Products Endpoints ---
app.get('/api/famous-products/random', async (req, res) => {
    try {
        const { data, error } = await supabase.from('famous_products').select('*').is('location_id', null);
        if (error) throw error;
        const shuffled = data.sort(() => 0.5 - Math.random());
        res.json(shuffled.slice(0, 2).map(formatRowForFrontend));
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

app.get('/api/famous-products/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: attractions, error: attrError } = await supabase.from('attractions').select('id, name');
        if (attrError) throw attrError;

        const { data: foodShops, error: foodError } = await supabase.from('foodShops').select('id, name');
        if (foodError) throw foodError;
        
        const locationMap = new Map();
        attractions.forEach(loc => locationMap.set(loc.id, loc.name));
        foodShops.forEach(loc => locationMap.set(loc.id, loc.name));

        const { data: products, error: productsError } = await supabase
            .from('famous_products')
            .select('*');

        if (productsError) throw productsError;

        const productsWithLocation = products.map(product => {
            const formatted = formatRowForFrontend(product);
            return {
                ...formatted,
                locationName: product.location_id ? locationMap.get(product.location_id) || 'ไม่พบสถานที่' : 'ส่วนกลาง'
            };
        });

        res.json(productsWithLocation);
    } catch (err) {
        console.error("Error fetching all famous products with locations:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อทั้งหมด' });
    }
});

// --- Location Endpoints ---
app.get('/api/locations/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: attractions, error: attrError } = await supabase
            .from('attractions')
            .select('*')
            .eq('status', 'pending_deletion');
        if (attrError) throw attrError;

        const { data: foodShops, error: foodError } = await supabase
            .from('foodShops')
            .select('*')
            .eq('status', 'pending_deletion');
        if (foodError) throw foodError;

        const allRequests = [...attractions, ...foodShops];
        res.json(allRequests.map(formatRowForFrontend));
    } catch (err) {
        console.error("Error fetching deletion requests:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอลบ' });
    }
});

app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let { data, error } = await supabase
            .from('attractions')
            .update({ status: 'approved' })
            .eq('id', id)
            .select();

        if (error) throw error;
        
        if (!data || data.length === 0) {
            ({ data, error } = await supabase
                .from('foodShops')
                .update({ status: 'approved' })
                .eq('id', id)
                .select());
            if (error) throw error;
        }
        
        if (!data || data.length === 0) {
             return res.status(404).json({ message: 'ไม่พบคำขอลบสำหรับสถานที่นี้' });
        }

        res.json({ message: 'ปฏิเสธการลบและคืนสถานะสถานที่เรียบร้อยแล้ว' });
    } catch (err) {
        console.error(`Error denying deletion for ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอลบ' });
    }
});

app.get('/api/attractions', async (req, res) => {
    try {
        let query = supabase.from('attractions').select('*').eq('status', 'approved');
        if (req.query.sortBy === 'rating') query = query.order('rating', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        res.json(data.map(formatRowForFrontend));
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่ท่องเที่ยว' });
    }
});

app.get('/api/foodShops', async (req, res) => {
    try {
        let query = supabase.from('foodShops').select('*').eq('status', 'approved');
        if (req.query.sortBy === 'rating') query = query.order('rating', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        res.json(data.map(formatRowForFrontend));
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร' });
    }
});

app.get('/api/locations/same-category', async (req, res) => {
    const { category, excludeId } = req.query;
    if (!category) return res.status(400).json({ error: 'Category is required' });
    try {
        const { data: attractions, error: attrError } = await supabase.from('attractions').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5);
        if (attrError) throw attrError;
        const { data: foodShops, error: foodError } = await supabase.from('foodShops').select('*').eq('category', category).neq('id', excludeId || '').eq('status', 'approved').limit(5);
        if (foodError) throw foodError;
        const combined = [...attractions, ...foodShops];
        res.json(combined.sort(() => 0.5 - Math.random()).slice(0, 5).map(formatRowForFrontend));
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสถานที่ในหมวดหมู่เดียวกัน' });
    }
});

app.get('/api/locations/:locationId/famous-products', async (req, res) => {
    const { locationId } = req.params;
    try {
        const { data, error } = await supabase.from('famous_products').select('*').eq('location_id', locationId);
        if (error) throw error;
        res.json(data.map(formatRowForFrontend));
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
    }
});

app.get('/api/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let { data: location } = await supabase.from('attractions').select('*').eq('id', id).single();
        if (!location) ({ data: location } = await supabase.from('foodShops').select('*').eq('id', id).single());
        
        if (location) res.json(formatRowForFrontend(location));
        else res.status(404).json({ error: 'ไม่พบสถานที่' });
    } catch (err) {
        if (err.code !== 'PGRST116') res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' });
        else res.status(404).json({ error: 'ไม่พบสถานที่' });
    }
});

app.post('/api/locations', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { name, category, description, googleMapUrl, hours, contact } = req.body;
    const { userId, displayName, username, profileImageUrl } = req.user;
    if (!name || !category) return res.status(400).json({ error: 'กรุณากรอกชื่อและหมวดหมู่' });
    try {
        const allImageUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

        const newLocation = {
            id: crypto.randomUUID(), name, category, description: description || '',
            google_map_url: googleMapUrl, hours, contact, user_id: userId, status: 'approved',
            image_url: allImageUrls.length > 0 ? allImageUrls[0] : null,
            detail_images: allImageUrls.length > 1 ? allImageUrls.slice(1) : [],
            type: ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(category) ? 'foodshop' : 'attraction',
            ...extractCoordsFromUrl(googleMapUrl)
        };
        const tableName = newLocation.type === 'foodshop' ? 'foodShops' : 'attractions';
        await supabase.from(tableName).insert(newLocation);
        
        createAndSendNotification({
            type: 'new_location', 
            actorId: userId, 
            actorName: displayName || username,
            actorProfileImageUrl: profileImageUrl,
            payload: { location: formatRowForFrontend(newLocation) }
        });
        res.status(201).json(formatRowForFrontend(newLocation));
    } catch (err) {
        console.error("Error creating location:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});

app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { name, category, description, googleMapUrl, hours, contact, existingImages } = req.body;

    try {
        let location, tableName;
        const { data: attractionData } = await supabase.from('attractions').select('*').eq('id', id).single();
        if (attractionData) {
            location = attractionData;
            tableName = 'attractions';
        } else {
            const { data: foodShopData } = await supabase.from('foodShops').select('*').eq('id', id).single();
            if (foodShopData) {
                location = foodShopData;
                tableName = 'foodShops';
            }
        }

        if (!location) {
            return res.status(404).json({ error: 'ไม่พบสถานที่ที่ต้องการแก้ไข' });
        }
        if (role !== 'admin' && location.user_id !== userId) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
        }
        
        let keptImages = [];
        if (existingImages) {
            try {
                const parsedImages = JSON.parse(existingImages);
                const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
                keptImages = parsedImages.map(url => url.startsWith(baseURL) ? url.substring(baseURL.length) : url);
            } catch (e) {
                if (typeof existingImages === 'string') {
                    const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
                    const relativePath = existingImages.startsWith(baseURL) ? existingImages.substring(baseURL.length) : existingImages;
                    keptImages = [relativePath];
                }
            }
        }

        const newImageUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
        const allImages = [...keptImages, ...newImageUrls];

        const updateData = {
            name: name || location.name,
            category: category || location.category,
            description: description || location.description,
            google_map_url: googleMapUrl || location.google_map_url,
            hours: hours || location.hours,
            contact: contact || location.contact,
            ...extractCoordsFromUrl(googleMapUrl || location.google_map_url),
            image_url: allImages.length > 0 ? allImages[0] : null,
            detail_images: allImages.length > 1 ? allImages.slice(1) : [],
        };

        const { data: updatedLocation, error: updateError } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
            
        if (updateError) throw updateError;

        res.json(formatRowForFrontend(updatedLocation));
    } catch (err) {
        console.error('Error updating location:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสถานที่' });
    }
});

app.post('/api/locations/:id/request-deletion', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        let { data: location } = await supabase.from('attractions').select('user_id').eq('id', id).single();
        let tableName = 'attractions';
        if (!location) {
            ({ data: location } = await supabase.from('foodShops').select('user_id').eq('id', id).single());
            tableName = 'foodShops';
        }
        if (!location) return res.status(404).json({ error: 'Location not found.' });
        if (location.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        
        const { error: updateError } = await supabase.from(tableName).update({ status: 'pending_deletion' }).eq('id', id);
        if (updateError) throw updateError;
        res.json({ message: 'ส่งคำขอลบเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอลบ' });
    }
});

app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await supabase.from('reviews').delete().eq('location_id', id);
        await supabase.from('famous_products').delete().eq('location_id', id);
        await supabase.from('favorites').delete().eq('location_id', id);
        
        await supabase.from('attractions').delete().eq('id', id);
        await supabase.from('foodShops').delete().eq('id', id);
        
        res.json({ message: 'ลบข้อมูลสถานที่สำเร็จ' });
    } catch (err) {
        console.error(`Error deleting location ${id}:`, err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสถานที่' });
    }
});

// --- Review Endpoints ---
app.post('/api/reviews/:locationId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { locationId } = req.params;
    const { rating, comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user;
    if (!rating || !comment) return res.status(400).json({ error: 'กรุณากรอกคะแนนและเนื้อหารีวิว' });
    try {
        const imageUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
        const newReview = {
            id: crypto.randomUUID(), location_id: locationId, user_id: userId,
            author: displayName || username, rating: parseInt(rating, 10), comment: comment,
            image_urls: imageUrls, likes_count: 0
        };
        await supabase.from('reviews').insert(newReview);
        
        const { data: allReviews } = await supabase.from('reviews').select('rating').eq('location_id', locationId);
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = (allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0;
        await supabase.from('attractions').update({ rating: averageRating }).eq('id', locationId);
        await supabase.from('foodShops').update({ rating: averageRating }).eq('id', locationId);
        
        let { data: location } = await supabase.from('attractions').select('*').eq('id', locationId).single();
        if (!location) ({ data: location } = await supabase.from('foodShops').select('*').eq('id', locationId).single());
        
        if (location) {
            createAndSendNotification({
                type: 'new_review', 
                actorId: userId, 
                actorName: displayName || username,
                actorProfileImageUrl: profileImageUrl,
                recipientId: location.user_id, 
                payload: { 
                    location: formatRowForFrontend(location),
                    commentSnippet: comment.substring(0, 50) 
                }
            });
        }
        
        res.status(201).json({ ...newReview, image_urls: newReview.image_urls.map(constructFullUrl) });
    } catch (err) {
        console.error("Error creating review:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' });
    }
});

app.get('/api/reviews/:locationId', async (req, res) => {
    const { locationId } = req.params;
    const { userId } = req.query;
    try {
        // Step 1: Fetch reviews for the location
        const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select('*')
            .eq('location_id', locationId)
            .order('created_at', { ascending: false });
            
        if (reviewsError) throw reviewsError;
        if (!reviewsData || reviewsData.length === 0) {
            return res.json([]);
        }

        // Step 2: Get all review IDs to fetch their comment counts
        const reviewIds = reviewsData.map(review => review.id);

        // Step 3: Fetch all comments related to these reviews
        const { data: commentsData, error: commentsError } = await supabase
            .from('review_comments')
            .select('review_id')
            .in('review_id', reviewIds);

        if (commentsError) throw commentsError;

        // Step 4: Create a map of comment counts for easy lookup
        const commentCounts = commentsData.reduce((acc, comment) => {
            acc[comment.review_id] = (acc[comment.review_id] || 0) + 1;
            return acc;
        }, {});

        // Step 5: Merge the comment counts back into the reviews data
        const reviewsWithCount = reviewsData.map(review => ({
            ...review,
            comments_count: commentCounts[review.id] || 0
        }));

        const formatReview = (review) => ({
            ...review,
            image_urls: (Array.isArray(review.image_urls) ? review.image_urls : []).filter(Boolean).map(url => constructFullUrl(url))
        });
        
        // If no user is logged in, return reviews without like status
        if (!userId) {
            return res.json(reviewsWithCount.map(r => ({ ...formatReview(r), user_has_liked: false })));
        }
        
        // If a user is logged in, check which reviews they have liked
        const { data: likesData, error: likesError } = await supabase
            .from('review_likes')
            .select('review_id')
            .eq('user_id', userId)
            .in('review_id', reviewIds);
            
        if (likesError) throw likesError;
        
        const likedReviewIds = new Set(likesData.map(like => like.review_id));
        
        res.json(reviewsWithCount.map(r => ({ ...formatReview(r), user_has_liked: likedReviewIds.has(r.id) })));

    } catch (err) {
        console.error("Error fetching reviews with comment count:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว' });
    }
});

app.put('/api/reviews/:reviewId', authenticateToken, upload.array('reviewImages', 5), async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comment, existingImages } = req.body;
    const { userId, role } = req.user;

    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('*').eq('id', reviewId).single();
        if (fetchError || !review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการแก้ไข' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });

        const newImageUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
        let keptImages = [];
        if (existingImages) {
            try {
                const parsedImages = JSON.parse(existingImages);
                const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
                keptImages = parsedImages.map(url => url.startsWith(baseURL) ? url.substring(baseURL.length) : url);
            } catch (e) {
                keptImages = [];
            }
        }
        
        const updateData = {
            rating: rating ? parseInt(rating, 10) : review.rating,
            comment: comment || review.comment,
            image_urls: [...keptImages, ...newImageUrls]
        };

        const { data: updatedReview, error: updateError } = await supabase.from('reviews').update(updateData).eq('id', reviewId).select().single();
        if (updateError) throw updateError;

        const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('rating').eq('location_id', review.location_id);
        if (reviewsError) throw reviewsError;
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = (allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0;
        await supabase.from('attractions').update({ rating: averageRating }).eq('id', review.location_id);
        await supabase.from('foodShops').update({ rating: averageRating }).eq('id', review.location_id);

        const formattedReview = {
            ...updatedReview,
            image_urls: (updatedReview.image_urls || []).map(url => constructFullUrl(url)),
            user_has_liked: false
        };
        res.json(formattedReview);

    } catch (err) {
        console.error('Error updating review:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรีวิว' });
    }
});

app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, role } = req.user;

    try {
        const { data: review, error: fetchError } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
        if (fetchError || !review) return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการลบ' });
        if (review.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรีวิวนี้' });

        await supabase.from('review_comments').delete().eq('review_id', reviewId);
        await supabase.from('review_likes').delete().eq('review_id', reviewId);

        const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId);
        if (deleteError) throw deleteError;

        const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('rating').eq('location_id', review.location_id);
        if (reviewsError) throw reviewsError;
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = (allReviews.length > 0) ? (totalRating / allReviews.length).toFixed(1) : 0;
        await supabase.from('attractions').update({ rating: averageRating }).eq('id', review.location_id);
        await supabase.from('foodShops').update({ rating: averageRating }).eq('id', review.location_id);

        res.json({ message: 'ลบรีวิวสำเร็จ' });

    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบรีวิว' });
    }
});


app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;
    try {
        const { data: existingLikes, error: findError } = await supabase
            .from('review_likes')
            .select('id')
            .match({ user_id: userId, review_id: reviewId });

        if (findError) throw findError;
        
        const { data: review, error: reviewError } = await supabase.from('reviews').select('likes_count, user_id, location_id, comment').eq('id', reviewId).single();
        if (reviewError || !review) return res.status(404).json({ error: 'Review not found' });

        let currentLikes = Number(review.likes_count || 0);

        if (existingLikes && existingLikes.length > 0) {
            await supabase.from('review_likes').delete().match({ user_id: userId, review_id: reviewId });
            currentLikes = Math.max(0, currentLikes - 1);
        } else {
            await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId });
            currentLikes += 1;
            
            if (review.user_id !== userId) { 
                let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).single();
                if (!location) ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).single());

                if (location) {
                    createAndSendNotification({
                        type: 'new_like',
                        actorId: userId,
                        actorName: displayName || username,
                        actorProfileImageUrl: profileImageUrl,
                        recipientId: review.user_id,
                        payload: {
                            location: formatRowForFrontend(location),
                            commentSnippet: review.comment.substring(0, 50)
                        }
                    });
                }
            }
        }

        const { data: updatedReview, error: updateError } = await supabase
            .from('reviews')
            .update({ likes_count: currentLikes })
            .eq('id', reviewId)
            .select('likes_count')
            .single();
            
        if (updateError) throw updateError;
        
        res.json({ status: (existingLikes && existingLikes.length > 0) ? 'unliked' : 'liked', likesCount: updatedReview.likes_count });

    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการกดไลค์รีวิว' });
    }
});

// --- Review Comments Endpoints ---
app.get('/api/reviews/:reviewId/comments', async (req, res) => {
    const { reviewId } = req.params;
    try {
        const { data, error } = await supabase
            .from('review_comments')
            .select('*')
            .eq('review_id', reviewId)
            .order('created_at', { ascending: true }); // Order comments chronologically

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error("Error fetching comments for review:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคิดเห็น' });
    }
});

app.post('/api/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const { userId, username, displayName, profileImageUrl } = req.user;

    if (!comment) {
        return res.status(400).json({ error: 'เนื้อหาคอมเมนต์ห้ามว่างเปล่า' });
    }

    try {
        const newComment = {
            id: crypto.randomUUID(),
            review_id: reviewId,
            user_id: userId,
            author: displayName || username,
            comment: comment,
            likes_count: 0
        };
        const { data, error } = await supabase.from('review_comments').insert(newComment).select().single();
        if (error) throw error;

        const { data: review } = await supabase.from('reviews').select('user_id, location_id').eq('id', reviewId).single();
        
        if (review && review.user_id !== userId) {
            let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).single();
            if (!location) ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).single());

            if (location) {
                createAndSendNotification({
                    type: 'new_reply',
                    actorId: userId,
                    actorName: displayName || username,
                    actorProfileImageUrl: profileImageUrl,
                    recipientId: review.user_id,
                    payload: {
                        location: formatRowForFrontend(location),
                        commentSnippet: comment.substring(0, 50)
                    }
                });
            }
        }
        res.status(201).json(data);
    } catch (err) {
        console.error("Error creating comment:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกคอมเมนต์' });
    }
});

app.post('/api/comments/:commentId/toggle-like', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    const { userId, username, displayName, profileImageUrl } = req.user;

    try {
        const { data: comment, error: commentError } = await supabase
            .from('review_comments')
            .select('user_id, review_id, comment, likes_count')
            .eq('id', commentId)
            .single();

        if (commentError || !comment) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        const { data: existingLike, error: findError } = await supabase
            .from('comment_likes')
            .select('id')
            .match({ user_id: userId, comment_id: commentId })
            .single();

        if (findError && findError.code !== 'PGRST116') throw findError;

        let currentLikes = Number(comment.likes_count || 0);
        let status;

        if (existingLike) {
            await supabase.from('comment_likes').delete().match({ id: existingLike.id });
            currentLikes = Math.max(0, currentLikes - 1);
            status = 'unliked';
        } else {
            await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
            currentLikes += 1;
            status = 'liked';

            if (comment.user_id !== userId) {
                const { data: review } = await supabase.from('reviews').select('location_id').eq('id', comment.review_id).single();
                if (review) {
                    let { data: location } = await supabase.from('attractions').select('*').eq('id', review.location_id).single();
                    if (!location) ({ data: location } = await supabase.from('foodShops').select('*').eq('id', review.location_id).single());

                    if (location) {
                        createAndSendNotification({
                            type: 'new_comment_like',
                            actorId: userId,
                            actorName: displayName || username,
                            actorProfileImageUrl: profileImageUrl,
                            recipientId: comment.user_id,
                            payload: {
                                location: formatRowForFrontend(location),
                                commentSnippet: comment.comment.substring(0, 50)
                            }
                        });
                    }
                }
            }
        }

        const { data: updatedComment, error: updateError } = await supabase
            .from('review_comments')
            .update({ likes_count: currentLikes })
            .eq('id', commentId)
            .select('likes_count')
            .single();

        if (updateError) throw updateError;
        
        res.json({ status, likesCount: updatedComment.likes_count });

    } catch (err) {
        console.error("Error toggling comment like:", err);
        res.status(500).json({ error: 'Failed to toggle like on comment.' });
    }
});


// --- Auth Endpoints ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    try {
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
        if (existingUser) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: crypto.randomUUID(), username, display_name: username, password: hashedPassword, role: 'user' };
        const { error } = await supabase.from('users').insert(newUser);
        if (error) throw error;
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const profileImageUrl = Array.isArray(user.profile_image_url) && user.profile_image_url.length > 0 ? user.profile_image_url[0] : user.profile_image_url;
            const token = jwt.sign({ 
                userId: user.id, 
                username: user.username, 
                displayName: user.display_name, 
                role: user.role,
                profileImageUrl: profileImageUrl
            }, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.json({ message: 'เข้าสู่ระบบสำเร็จ!', user: formatRowForFrontend(user), token });
        } else {
            res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (err) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// --- Favorites Endpoints ---
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    try {
      const { data, error } = await supabase.from('favorites').select('location_id').eq('user_id', userId);
      if (error) throw error;
      const favoriteIds = data.map(fav => fav.location_id);
      res.json(favoriteIds);
    } catch (err) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการโปรด' });
    }
});
 
app.post('/api/favorites/toggle', authenticateToken, async (req, res) => {
    const { locationId } = req.body;
    const { userId } = req.user;
    if (!locationId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    try {
      const { data: existing } = await supabase.from('favorites').select('id').match({ user_id: userId, location_id: locationId }).single();
      if (existing) {
        await supabase.from('favorites').delete().match({ id: existing.id });
        res.json({ status: 'removed' });
      } else {
        await supabase.from('favorites').insert({ user_id: userId, location_id: locationId });
        res.json({ status: 'added' });
      }
    } catch (err) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรายการโปรด' });
    }
});

// --- Famous Product CRUD ---
app.post('/api/famous-products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, locationId } = req.body;
    const { userId, displayName, username, profileImageUrl } = req.user;
    if (!name ) return res.status(400).json({ error: 'Name is required.' });

    try {
        const newProduct = {
            id: crypto.randomUUID(), name, description: description || '',
            imageurl: req.file ? `/uploads/${req.file.filename}` : null,
            location_id: locationId || null,
            user_id: userId
        };
        const { error } = await supabase.from('famous_products').insert(newProduct);
        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }
        
        let location = null;
        if (locationId) {
             let { data: attraction } = await supabase.from('attractions').select('*').eq('id', locationId).single();
             if (!attraction) {
                ({ data: attraction } = await supabase.from('foodShops').select('*').eq('id', locationId).single());
            }
            location = attraction;
        }

        createAndSendNotification({
            type: 'new_product', 
            actorId: userId, 
            actorName: displayName || username,
            actorProfileImageUrl: profileImageUrl,
            payload: { 
                location: location ? formatRowForFrontend(location) : null,
                product: newProduct 
            }
        });
        res.status(201).json(formatRowForFrontend(newProduct));
    } catch (err) {
        console.error("Error creating product:", err);
        res.status(500).json({ error: `Failed to create product: ${err.message}` });
    }
});

app.put('/api/famous-products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const { userId, role } = req.user;
    try {
        const { data: product } = await supabase.from('famous_products').select('*').eq('id', id).single();
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        const updateData = { name: name || product.name, description: description || product.description };
        if (req.file) updateData.imageurl = `/uploads/${req.file.filename}`;
        const { data: updatedProduct, error } = await supabase.from('famous_products').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        res.json(formatRowForFrontend(updatedProduct));
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

app.delete('/api/famous-products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    try {
        const { data: product } = await supabase.from('famous_products').select('user_id').eq('id', id).single();
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.user_id !== userId && role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
        const { error } = await supabase.from('famous_products').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Product deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`✅✅✅ SERVER (SUPABASE) IS RUNNING at http://localhost:${port}`);
});

