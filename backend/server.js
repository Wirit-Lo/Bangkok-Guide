// Import necessary modules
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();


console.log('--- SERVER WITH ADMIN SYSTEM (v14.0 Deletion Approval) LOADING ---');


// Create an Express application instance
const app = express();
const port = 5000;

// Array to hold connected clients for SSE
let clients = [];

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));
const db = new Database('./travel_guide.db');


// --- Database Schema Setup ---
db.exec(`
  CREATE TABLE IF NOT EXISTS attractions (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, fullDescription TEXT,
    lat REAL, lng REAL, google_map_url TEXT, imageUrl TEXT, detailImages TEXT,
    rating REAL, reviews INTEGER, hours TEXT, contact TEXT, type TEXT NOT NULL, category TEXT,
    user_id TEXT, status TEXT DEFAULT 'approved', deletion_requested_at DATETIME
  );
  
  CREATE TABLE IF NOT EXISTS foodShops (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, fullDescription TEXT,
    lat REAL, lng REAL, google_map_url TEXT, imageUrl TEXT, detailImages TEXT,
    rating REAL, reviews INTEGER, hours TEXT, contact TEXT, type TEXT NOT NULL, category TEXT,
    user_id TEXT, status TEXT DEFAULT 'approved', deletion_requested_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    user_id TEXT,
    author TEXT,
    rating INTEGER NOT NULL,
    comment TEXT,
    image_urls TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    password TEXT NOT NULL,
    profile_image_url TEXT,
    role TEXT NOT NULL DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    PRIMARY KEY (user_id, location_id)
  );

  CREATE TABLE IF NOT EXISTS review_likes (
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (review_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS review_comments (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    user_id TEXT,
    author TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS famous_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    imageUrl TEXT,
    location_id TEXT,
    user_id TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      type TEXT NOT NULL,
      payload TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);
console.log('Tables checked/created.');

// Seeding and other setup code remains the same...
try {
  const count = db.prepare('SELECT COUNT(*) as count FROM famous_products').get().count;
  if (count === 0) {
    console.log('Seeding famous_products table...');
    const insert = db.prepare('INSERT INTO famous_products (id, name, description, imageUrl) VALUES (?, ?, ?, ?)');
    const seedData = [
      { id: crypto.randomUUID(), name: 'ก๋วยเตี๋ยวเรือรังสิต', description: 'ต้นตำรับก๋วยเตี๋ยวเรือรสเด็ด เข้มข้นถึงเครื่อง', imageUrl: '/uploads/placeholder-boat-noodle.png' },
      { id: crypto.randomUUID(), name: 'ขนมบ้าบิ่น', description: 'ขนมไทยโบราณ หอมมะพร้าวอ่อน รสชาติหวานมัน', imageUrl: '/uploads/placeholder-ba-bin.png' },
    ];
    seedData.forEach(item => {
      const placeholderPath = path.join(uploadsDir, path.basename(item.imageUrl));
      if (!fs.existsSync(placeholderPath)) {
        fs.writeFileSync(placeholderPath, '');
      }
    });
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item.id, item.name, item.description, item.imageUrl);
    });
    insertMany(seedData);
    console.log('Famous products seeding complete.');
  }
} catch (err) {
  console.error('Error seeding famous_products table:', err.message);
}


// Function to add a column if it doesn't exist
function addColumnIfNotExists(tableName, columnName, columnType) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columnExists = columns.some(col => col.name === columnName);
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      console.log(`Added column '${columnName}' to table '${tableName}'.`);
    }
  } catch (err) {
    console.error(`Error checking/adding column ${columnName} to ${tableName}:`, err.message);
  }
}

// --- Migrations ---
addColumnIfNotExists('users', 'display_name', 'TEXT');
addColumnIfNotExists('users', 'role', "TEXT NOT NULL DEFAULT 'user'");
addColumnIfNotExists('famous_products', 'location_id', 'TEXT');
addColumnIfNotExists('famous_products', 'user_id', 'TEXT');
addColumnIfNotExists('attractions', 'user_id', 'TEXT');
addColumnIfNotExists('attractions', 'status', "TEXT DEFAULT 'approved'");
addColumnIfNotExists('attractions', 'deletion_requested_at', 'DATETIME');
addColumnIfNotExists('foodShops', 'user_id', 'TEXT');
addColumnIfNotExists('foodShops', 'status', "TEXT DEFAULT 'approved'");
addColumnIfNotExists('foodShops', 'deletion_requested_at', 'DATETIME');

try {
  db.exec(`UPDATE users SET display_name = username WHERE display_name IS NULL OR display_name = ''`);
  console.log("Migrated existing users to have a display name.");
} catch(err) {
  console.error("Error migrating display names:", err.message);
}


// --- Multer Setup ---
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

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access is required for this action.' });
  }
};


// --- Helper Functions ---
function extractCoordsFromUrl(url) {
  if (!url) return null;
  const preciseMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (preciseMatch) return { lat: parseFloat(preciseMatch[1]), lng: parseFloat(preciseMatch[2]) };
  const generalMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (generalMatch) return { lat: parseFloat(generalMatch[1]), lng: parseFloat(generalMatch[2]) };
  return null;
}

const formatRowForFrontend = (row) => {
  if (!row) return null;
  const constructFullUrl = (relativePath) => {
    if (!relativePath || relativePath.startsWith('http')) return relativePath;
    return `http://localhost:5000${relativePath}`;
  };
  let detailImagesArray = [];
  try {
    detailImagesArray = row.detailImages ? JSON.parse(row.detailImages) : [];
    if (!Array.isArray(detailImagesArray)) detailImagesArray = [];
  } catch (e) { detailImagesArray = []; }
  return {
    ...row,
    coords: { lat: row.lat, lng: row.lng },
    googleMapUrl: row.google_map_url,
    imageUrl: constructFullUrl(row.imageUrl),
    detailImages: detailImagesArray.map(constructFullUrl),
  };
};

const formatUserForFrontend = (user) => {
  if (!user) return null;
  const constructFullUrl = (relativePath) => {
    if (!relativePath || relativePath.startsWith('http')) return relativePath;
    return `http://localhost:5000${relativePath}`;
  };
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    profile_image_url: constructFullUrl(user.profile_image_url),
    role: user.role
  };
};

function createAndSendNotification(eventData) {
  const { type, actorId, actorName, payload, recipientId } = eventData;
  
  const insert = db.prepare('INSERT INTO notifications (id, user_id, actor_id, actor_name, type, payload, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
  
  if (recipientId) {
    if (recipientId !== actorId) {
      insert.run(crypto.randomUUID(), recipientId, actorId, actorName, type, JSON.stringify(payload));
    }
  } else {
    const users = db.prepare('SELECT id FROM users WHERE id != ?').all(actorId);
    const insertMany = db.transaction((notifications) => {
      for (const notif of notifications) insert.run(notif.id, notif.user_id, notif.actor_id, notif.actor_name, notif.type, notif.payload);
    });
    const notificationsToInsert = users.map(user => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      actor_id: actorId,
      actor_name: actorName,
      type,
      payload: JSON.stringify(payload)
    }));
    if (notificationsToInsert.length > 0) {
      insertMany(notificationsToInsert);
    }
  }

  const liveEventPayload = { type, ...payload, actorId, actorName };
  clients.forEach(client => {
    const clientUser = jwt.decode(client.token);
    if (clientUser) {
      if (recipientId && clientUser.userId === recipientId && clientUser.userId !== actorId) {
        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
      } else if (!recipientId && clientUser.userId !== actorId) {
        client.res.write(`data: ${JSON.stringify(liveEventPayload)}\n\n`);
      }
    }
  });
}


// --- API Endpoints ---

app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '14.0' }));

app.get('/api/events', authenticateToken, (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, headers);

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res: res,
    token: req.query.token
  };
  clients.push(newClient);
  console.log(`${clientId} SSE Connection opened for user ${req.user.userId}.`);

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    console.log(`${clientId} SSE Connection closed.`);
    clients = clients.filter(client => client.id !== clientId);
  });
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(req.user.userId);
    
    const formatted = notifications.map(n => {
      const payload = JSON.parse(n.payload);
      const formattedPayload = {
        ...payload,
        location: payload.location ? formatRowForFrontend(payload.location) : undefined,
        product: payload.product ? formatRowForFrontend(payload.product) : undefined,
      };
      return { ...n, payload: formattedPayload };
    });

    res.json(formatted);
  } catch(err) {
    res.status(500).json({ error: 'Could not fetch notifications.' });
  }
});

app.post('/api/notifications/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
      .run(req.user.userId);
    res.status(200).json({ message: 'Notifications marked as read.' });
  } catch(err) {
    res.status(500).json({ error: 'Could not mark notifications as read.' });
  }
});

// ... Famous products, reviews, etc. ...
app.get('/api/famous-products/random', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM famous_products WHERE location_id IS NULL ORDER BY RANDOM() LIMIT 2').all();
    res.json(products.map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
  }
});
app.get('/api/famous-products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM famous_products WHERE location_id IS NULL ORDER BY name').all();
    res.json(products.map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อทั้งหมด' });
  }
});
app.post('/api/famous-products', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อของขึ้นชื่อ' });
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const newProduct = { id: crypto.randomUUID(), name, description: description || '', imageUrl, location_id: null, user_id: req.user.userId };
  try {
    db.prepare('INSERT INTO famous_products (id, name, description, imageUrl, location_id, user_id) VALUES (@id, @name, @description, @imageUrl, @location_id, @user_id)').run(newProduct);
    res.status(201).json(formatRowForFrontend(newProduct));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
});
app.put('/api/famous-products/:id', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อของขึ้นชื่อ' });
  const existingProduct = db.prepare('SELECT * FROM famous_products WHERE id = ? AND location_id IS NULL').get(id);
  if (!existingProduct) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
  let imageUrl = existingProduct.imageUrl;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }
  try {
    db.prepare('UPDATE famous_products SET name = ?, description = ?, imageUrl = ? WHERE id = ?').run(name, description || '', imageUrl, id);
    res.json(formatRowForFrontend({ id, name, description, imageUrl }));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});
app.delete('/api/famous-products/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM famous_products WHERE id = ? AND location_id IS NULL').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการลบ หรือไม่ใช่ของขึ้นชื่อส่วนกลาง' });
    res.json({ message: 'ลบข้อมูลสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});
app.get('/api/famous-products/all', authenticateToken, requireAdmin, (req, res) => {
  try {
    const query = `
        SELECT
            fp.id, fp.name, fp.description, fp.imageUrl, fp.location_id, fp.user_id,
            COALESCE(a.name, fs.name) AS location_name
        FROM famous_products AS fp
        LEFT JOIN attractions AS a ON fp.location_id = a.id
        LEFT JOIN foodShops AS fs ON fp.location_id = fs.id
        ORDER BY 
            CASE WHEN location_name IS NULL THEN 0 ELSE 1 END, 
            location_name ASC, 
            fp.name ASC
    `;
    const products = db.prepare(query).all();
    res.json(products.map(p => {
      const formattedRow = formatRowForFrontend(p);
      return {
        ...p, 
        imageUrl: formattedRow.imageUrl
      };
    }));
  } catch (err) {
    console.error("Error fetching all products:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อทั้งหมด' });
  }
});
app.get('/api/locations/:locationId/products', (req, res) => {
  const { locationId } = req.params;
  try {
    const products = db.prepare('SELECT * FROM famous_products WHERE location_id = ?').all(locationId);
    res.json(products.map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลของขึ้นชื่อ' });
  }
});
app.post('/api/products', authenticateToken, upload.single('image'), (req, res) => {
  const { name, description, locationId } = req.body;
  const { userId, displayName } = req.user;
  if (!name || !locationId) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อและรหัสสถานที่' });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const newProduct = {
    id: crypto.randomUUID(), name, description: description || '', imageUrl,
    location_id: locationId, user_id: userId
  };
  try {
    db.prepare('INSERT INTO famous_products (id, name, description, imageUrl, location_id, user_id) VALUES (@id, @name, @description, @imageUrl, @location_id, @user_id)').run(newProduct);
    
    const location = db.prepare('SELECT * FROM attractions WHERE id = ?').get(locationId) || db.prepare('SELECT * FROM foodShops WHERE id = ?').get(locationId);
    
    createAndSendNotification({
      type: 'new_product',
      actorId: userId,
      actorName: displayName,
      payload: {
        product: newProduct,
        location: location
      }
    });

    res.status(201).json(formatRowForFrontend(newProduct));
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
});
app.put('/api/products/:productId', authenticateToken, upload.single('image'), (req, res) => {
  const { productId } = req.params;
  const { name, description } = req.body;
  const requestingUser = req.user;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  const existingProduct = db.prepare('SELECT * FROM famous_products WHERE id = ?').get(productId);
  if (!existingProduct) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  if (existingProduct.user_id !== requestingUser.userId && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
  }
  let imageUrl = existingProduct.imageUrl;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }
  try {
    db.prepare('UPDATE famous_products SET name = ?, description = ?, imageUrl = ? WHERE id = ?').run(name, description || '', imageUrl, productId);
    res.json(formatRowForFrontend({ ...existingProduct, name, description, imageUrl }));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});
app.delete('/api/products/:productId', authenticateToken, (req, res) => {
  const { productId } = req.params;
  const requestingUser = req.user;
  const product = db.prepare('SELECT user_id FROM famous_products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  if (product.user_id !== requestingUser.userId && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบข้อมูลนี้' });
  }
  try {
    const result = db.prepare('DELETE FROM famous_products WHERE id = ?').run(productId);
    if (result.changes === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการลบ' });
    res.json({ message: 'ลบข้อมูลสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});
app.get('/api/locations/same-category', (req, res) => {
  const { category, excludeId } = req.query;
  if (!category) return res.status(400).json({ error: 'Category is required' });
  try {
    const attractions = db.prepare("SELECT * FROM attractions WHERE category = ? AND id != ? AND status = 'approved'").all(category, excludeId || '');
    const foodShops = db.prepare("SELECT * FROM foodShops WHERE category = ? AND id != ? AND status = 'approved'").all(category, excludeId || '');
    let combined = [...attractions, ...foodShops];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    res.json(combined.slice(0, 5).map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสถานที่ในหมวดหมู่เดียวกัน' });
  }
});
app.get('/api/attractions', (req, res) => {
  const { sortBy } = req.query;
  let query = "SELECT * FROM attractions WHERE status = 'approved'";
  if (sortBy === 'rating') query += " ORDER BY rating DESC";
  try {
    res.json(db.prepare(query).all().map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่ท่องเที่ยว' });
  }
});
app.get('/api/foodShops', (req, res) => {
  const { sortBy } = req.query;
  let query = "SELECT * FROM foodShops WHERE status = 'approved'";
  if (sortBy === 'rating') query += " ORDER BY rating DESC";
  try {
    res.json(db.prepare(query).all().map(formatRowForFrontend));
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร' });
  }
});

// FIX: Moved this route before '/api/locations/:id' to avoid routing conflicts.
// UPDATE: Added sorting functionality based on query parameter.
app.get('/api/locations/pending-deletion', authenticateToken, requireAdmin, (req, res) => {
  const { sortBy = 'newest' } = req.query; // Default to 'newest'
  const sortOrder = sortBy === 'oldest' ? 'ASC' : 'DESC';

  try {
    const query = `
      SELECT * FROM attractions WHERE status = 'pending_deletion'
      UNION ALL
      SELECT * FROM foodShops WHERE status = 'pending_deletion'
      ORDER BY deletion_requested_at ${sortOrder}
    `;
    const pendingDeletions = db.prepare(query).all();
    res.json(pendingDeletions.map(formatRowForFrontend));
  } catch (err) {
    console.error("Error fetching pending deletions:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

app.get('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  try {
    let location = db.prepare('SELECT * FROM attractions WHERE id = ?').get(id) || db.prepare('SELECT * FROM foodShops WHERE id = ?').get(id);
    if (location) res.json(formatRowForFrontend(location));
    else res.status(404).json({ error: 'ไม่พบสถานที่' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' });
  }
});
app.post('/api/locations', authenticateToken, upload.array('images', 10), (req, res) => {
  const { name, category, description, googleMapUrl, hours, contact } = req.body;
  const { userId, displayName } = req.user;
  if (!name || !category) return res.status(400).json({ error: 'กรุณากรอกชื่อและหมวดหมู่' });
  const imageUrl = req.files && req.files.length > 0 ? `/uploads/${req.files[0].filename}` : null;
  const detailImages = req.files && req.files.length > 1 ? JSON.stringify(req.files.slice(1).map(file => `/uploads/${file.filename}`)) : JSON.stringify([]);
  const coords = extractCoordsFromUrl(googleMapUrl);
  const tableName = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(category) ? 'foodShops' : 'attractions';
  const type = tableName === 'foodShops' ? 'foodshop' : 'attraction';
  const newLocation = {
    id: crypto.randomUUID(), name, description: description || '', fullDescription: '',
    lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
    google_map_url: googleMapUrl || '', imageUrl, detailImages,
    rating: 0, reviews: 0, hours: hours || '', contact: contact || '', type, category,
    user_id: userId, status: 'approved', deletion_requested_at: null
  };
  const columns = Object.keys(newLocation).join(', ');
  const placeholders = Object.keys(newLocation).map(key => `@${key}`).join(', ');
  try {
    db.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`).run(newLocation);
    
    createAndSendNotification({
      type: 'new_location',
      actorId: userId,
      actorName: displayName,
      payload: {
        location: newLocation
      }
    });

    res.status(201).json(formatRowForFrontend(newLocation));
  } catch (err) {
    console.error("Error creating location:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
});
app.put('/api/locations/:id', authenticateToken, upload.array('images', 10), (req, res) => {
  const { id } = req.params;
  const { name, category, description, googleMapUrl, hours, contact, existingImages } = req.body;
  const dbTransaction = db.transaction(() => {
    let location = db.prepare('SELECT * FROM attractions WHERE id = ?').get(id);
    let tableName = 'attractions';
    if (!location) {
      location = db.prepare('SELECT * FROM foodShops WHERE id = ?').get(id);
      tableName = 'foodShops';
    }
    if (!location) throw new Error('NOT_FOUND');

    if (location.user_id !== req.user.userId && req.user.role !== 'admin') {
      throw new Error('FORBIDDEN');
    }

    const keptImages = existingImages ? JSON.parse(existingImages) : [];
    const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const cleanKeptImages = keptImages.map(img => img.replace(`http://localhost:5000`, ''));
    const allImageUrls = [...cleanKeptImages, ...newImageUrls];
    const imageUrl = allImageUrls[0] || null;
    const detailImages = JSON.stringify(allImageUrls.slice(1));
    const coords = extractCoordsFromUrl(googleMapUrl);
    db.prepare(
      `UPDATE ${tableName} 
        SET name=?, category=?, description=?, google_map_url=?, lat=?, lng=?, hours=?, contact=?, imageUrl=?, detailImages=? 
        WHERE id=?`
    ).run(name, category, description, googleMapUrl, coords?.lat, coords?.lng, hours, contact, imageUrl, detailImages, id);
    return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
  });
  try {
    const updatedLocation = dbTransaction();
    res.json(formatRowForFrontend(updatedLocation));
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้' });
    console.error("Error updating location:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});
app.delete('/api/locations/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const transaction = db.transaction(() => {
    let result = db.prepare('DELETE FROM attractions WHERE id = ?').run(id);
    if (result.changes === 0) {
      result = db.prepare('DELETE FROM foodShops WHERE id = ?').run(id);
    }
    if (result.changes === 0) return { changes: 0 };
    
    db.prepare('DELETE FROM reviews WHERE location_id = ?').run(id);
    db.prepare('DELETE FROM famous_products WHERE location_id = ?').run(id);
    db.prepare('DELETE FROM favorites WHERE location_id = ?').run(id);
    return { changes: 1 };
  });
  try {
    const { changes } = transaction();
    if (changes === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลสถานที่ที่ต้องการลบ' });
    res.json({ message: 'ลบข้อมูลสถานที่สำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสถานที่' });
  }
});

app.post('/api/locations/:id/request-deletion', authenticateToken, (req, res) => {
  const { id } = req.params;
  let location = db.prepare('SELECT user_id FROM attractions WHERE id = ?').get(id);
  let tableName = 'attractions';
  if (!location) {
    location = db.prepare('SELECT user_id FROM foodShops WHERE id = ?').get(id);
    tableName = 'foodShops';
  }
  if (!location) return res.status(404).json({ error: 'ไม่พบสถานที่' });
  if (location.user_id !== req.user.userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ร้องขอลบสถานที่นี้' });
  }
  try {
    db.prepare(`UPDATE ${tableName} SET status = 'pending_deletion', deletion_requested_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    res.json({ message: 'ส่งคำขอลบสถานที่แล้ว Admin จะตรวจสอบในลำดับถัดไป' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/locations/:id/approve-deletion', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const transaction = db.transaction(() => {
    let result = db.prepare('DELETE FROM attractions WHERE id = ?').run(id);
    if (result.changes === 0) {
      result = db.prepare('DELETE FROM foodShops WHERE id = ?').run(id);
    }
    if (result.changes === 0) return { changes: 0 };
    
    db.prepare('DELETE FROM reviews WHERE location_id = ?').run(id);
    db.prepare('DELETE FROM famous_products WHERE location_id = ?').run(id);
    db.prepare('DELETE FROM favorites WHERE location_id = ?').run(id);
    return { changes: 1 };
  });
  try {
    const { changes } = transaction();
    if (changes > 0) res.json({ message: 'อนุมัติการลบสำเร็จ' });
    else res.status(404).json({ error: 'ไม่พบสถานที่' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/locations/:id/deny-deletion', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    let result = db.prepare(`UPDATE attractions SET status = 'approved', deletion_requested_at = NULL WHERE id = ?`).run(id);
    if (result.changes === 0) {
        result = db.prepare(`UPDATE foodShops SET status = 'approved', deletion_requested_at = NULL WHERE id = ?`).run(id);
    }
    if (result.changes > 0) res.json({ message: 'ปฏิเสธการลบสำเร็จ' });
    else res.status(404).json({ error: 'ไม่พบสถานที่' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});


app.get('/api/reviews/:locationId', (req, res) => {
  const { locationId } = req.params;
  const { userId } = req.query;
  try {
    const reviewsData = db.prepare('SELECT * FROM reviews WHERE location_id = ? ORDER BY created_at DESC').all(locationId);
    const reviews = reviewsData.map(review => {
      let user_has_liked = false;
      if (userId) {
        user_has_liked = !!db.prepare('SELECT 1 FROM review_likes WHERE review_id = ? AND user_id = ?').get(review.id, userId);
      }
      return { ...review, image_urls: review.image_urls ? JSON.parse(review.image_urls).map(url => `http://localhost:5000${url}`) : [], user_has_liked };
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว' });
  }
});
app.post('/api/reviews', authenticateToken, upload.array('reviewImages', 5), (req, res) => {
  const { locationId, locationType, rating, comment } = req.body;
  const { userId } = req.user;
  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
  const author = user ? user.display_name : req.user.username;
  
  if (!locationId || !locationType || !rating) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
  const imageUrlsJson = JSON.stringify(req.files ? req.files.map(file => `/uploads/${file.filename}`) : []);
  const transaction = db.transaction(() => {
    const reviewId = crypto.randomUUID();
    db.prepare('INSERT INTO reviews (id, location_id, user_id, author, rating, comment, image_urls) VALUES (?, ?, ?, ?, ?, ?, ?)').run(reviewId, locationId, userId, author, rating, comment || '', imageUrlsJson);
    const stats = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE location_id = ?').get(locationId);
    const tableName = locationType === 'attraction' ? 'attractions' : 'foodShops';
    db.prepare(`UPDATE ${tableName} SET rating = ?, reviews = ? WHERE id = ?`).run(stats.avg_rating, stats.review_count, locationId);
  });
  try {
    transaction();
    res.status(201).json({ message: 'เพิ่มรีวิวสำเร็จ!' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' });
  }
});
app.delete('/api/reviews/:reviewId', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { locationId, locationType } = req.body;
  const requestingUser = req.user;
  if (!locationId || !locationType) return res.status(400).json({ error: 'ข้อมูลสำหรับยืนยันตนไม่ครบถ้วน' });
  const transaction = db.transaction(() => {
    const review = db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(reviewId);
    if (!review) throw new Error('NOT_FOUND');
    if (review.user_id !== requestingUser.userId && requestingUser.role !== 'admin') throw new Error('FORBIDDEN');
    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
    const stats = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE location_id = ?').get(locationId);
    const tableName = locationType === 'attraction' ? 'attractions' : 'foodShops';
    db.prepare(`UPDATE ${tableName} SET rating = ?, reviews = ? WHERE id = ?`).run(stats.avg_rating || 0, stats.review_count || 0, locationId);
  });
  try {
    transaction();
    res.json({ message: 'ลบรีวิวสำเร็จ' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการลบ' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรีวิวนี้' });
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบรีวิว' });
  }
});
app.put('/api/reviews/:reviewId', authenticateToken, upload.array('newImages', 5), (req, res) => {
  const { reviewId } = req.params;
  const { locationId, locationType, rating, comment, existingImages } = req.body;
  const requestingUser = req.user;
  if (!locationId || !locationType || !rating) return res.status(400).json({ error: 'ข้อมูลสำหรับอัปเดตไม่ครบถ้วน' });
  const transaction = db.transaction(() => {
    const review = db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(reviewId);
    if (!review) throw new Error('NOT_FOUND');
    if (review.user_id !== requestingUser.userId && requestingUser.role !== 'admin') throw new Error('FORBIDDEN');
    const keptImages = existingImages ? JSON.parse(existingImages).map(url => url.replace(`http://localhost:5000`, '')) : [];
    const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const allImageUrlsJson = JSON.stringify([...keptImages, ...newImageUrls]);
    db.prepare('UPDATE reviews SET rating = ?, comment = ?, image_urls = ? WHERE id = ?').run(rating, comment || '', allImageUrlsJson, reviewId);
    const stats = db.prepare('SELECT AVG(rating) as avg_rating FROM reviews WHERE location_id = ?').get(locationId);
    const tableName = locationType === 'attraction' ? 'attractions' : 'foodShops';
    db.prepare(`UPDATE ${tableName} SET rating = ? WHERE id = ?`).run(stats.avg_rating || 0, locationId);
  });
  try {
    transaction();
    res.json({ message: 'อัปเดตรีวิวสำเร็จ' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'ไม่พบรีวิวที่ต้องการแก้ไข' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรีวิว' });
  }
});
app.post('/api/reviews/:reviewId/toggle-like', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { userId, displayName } = req.user;

  const reviewInfo = db.prepare('SELECT user_id, location_id FROM reviews WHERE id = ?').get(reviewId);
  if (!reviewInfo) return res.status(404).json({ error: 'Review not found' });
  
  let likesCount = 0;
  const transaction = db.transaction(() => {
    const existingLike = db.prepare('SELECT * FROM review_likes WHERE review_id = ? AND user_id = ?').get(reviewId, userId);
    if (existingLike) {
      db.prepare('DELETE FROM review_likes WHERE review_id = ? AND user_id = ?').run(reviewId, userId);
    } else {
      db.prepare('INSERT INTO review_likes (review_id, user_id) VALUES (?, ?)').run(reviewId, userId);
      
      const location = db.prepare('SELECT * FROM attractions WHERE id = ?').get(reviewInfo.location_id) || db.prepare('SELECT * FROM foodShops WHERE id = ?').get(reviewInfo.location_id);
      if (location) {
        createAndSendNotification({
          type: 'new_like',
          actorId: userId,
          actorName: displayName,
          recipientId: reviewInfo.user_id,
          payload: { location }
        });
      }
    }
    likesCount = db.prepare('SELECT COUNT(*) as count FROM review_likes WHERE review_id = ?').get(reviewId).count;
    db.prepare('UPDATE reviews SET likes_count = ? WHERE id = ?').run(likesCount, reviewId);
  });

  try {
    transaction();
    res.json({ likesCount });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});
app.get('/api/reviews/:reviewId/comments', (req, res) => {
  const { reviewId } = req.params;
  try {
    const comments = db.prepare('SELECT * FROM review_comments WHERE review_id = ? ORDER BY created_at ASC').all(reviewId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงคอมเมนต์' });
  }
});
app.post('/api/reviews/:reviewId/comments', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { comment } = req.body;
  const { userId, displayName } = req.user;
  if (!comment) return res.status(400).json({ error: 'กรุณาใส่ความคิดเห็น' });

  const reviewInfo = db.prepare('SELECT user_id, location_id FROM reviews WHERE id = ?').get(reviewId);
  if (!reviewInfo) return res.status(404).json({ error: 'Review not found' });

  let newComment;
  const transaction = db.transaction(() => {
    newComment = { id: crypto.randomUUID(), review_id: reviewId, user_id: userId, author: displayName, comment };
    db.prepare('INSERT INTO review_comments (id, review_id, user_id, author, comment) VALUES (@id, @review_id, @user_id, @author, @comment)').run(newComment);
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM review_comments WHERE review_id = ?').get(reviewId).count;
    db.prepare('UPDATE reviews SET comments_count = ? WHERE id = ?').run(commentCount, reviewId);
  });
  try {
    transaction();
    
    const location = db.prepare('SELECT * FROM attractions WHERE id = ?').get(reviewInfo.location_id) || db.prepare('SELECT * FROM foodShops WHERE id = ?').get(reviewInfo.location_id);
    if(location) {
        createAndSendNotification({
          type: 'new_reply',
          actorId: userId,
          actorName: displayName,
          recipientId: reviewInfo.user_id,
          payload: { 
            location,
            comment: newComment.comment 
          }
        });
    }
    
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโพสต์คอมเมนต์' });
  }
});
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  try {
    if (db.prepare('SELECT * FROM users WHERE username = ?').get(username)) {
      return res.status(409).json({ error: 'ชื่อผู้ใช้สำหรับเข้าระบบนี้ถูกใช้งานแล้ว' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { 
      id: crypto.randomUUID(), username, display_name: username,
      password: hashedPassword, profile_image_url: null, role: 'user'
    };
    db.prepare('INSERT INTO users (id, username, display_name, password, profile_image_url, role) VALUES (?, ?, ?, ?, ?, ?)').run(newUser.id, newUser.username, newUser.display_name, newUser.password, newUser.profile_image_url, newUser.role);
    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!', user: formatUserForFrontend(newUser) });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ userId: user.id, username: user.username, displayName: user.display_name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.json({ message: 'เข้าสู่ระบบสำเร็จ!', user: formatUserForFrontend(user), token });
    } else {
      res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});
app.get('/api/favorites', authenticateToken, (req, res) => {
  const { userId } = req.user;
  try {
    const favorites = db.prepare('SELECT location_id FROM favorites WHERE user_id = ?').all(userId).map(row => row.location_id);
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการโปรด' });
  }
});
app.post('/api/favorites/toggle', authenticateToken, (req, res) => {
  const { locationId } = req.body;
  const { userId } = req.user;
  if (!locationId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const existing = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND location_id = ?').get(userId, locationId);
    if (existing) {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND location_id = ?').run(userId, locationId);
      res.json({ status: 'removed' });
    } else {
      db.prepare('INSERT INTO favorites (user_id, location_id) VALUES (?, ?)').run(userId, locationId);
      res.json({ status: 'added' });
    }
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกรายการโปรด' });
  }
});
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const user = db.prepare('SELECT id, username, display_name, profile_image_url, role FROM users WHERE id = ?').get(userId);
    if (user) res.json(formatUserForFrontend(user));
    else res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});
app.put('/api/users/:userId', authenticateToken, upload.single('profileImage'), async (req, res) => {
  const userIdToUpdate = req.params.userId;
  const requestingUser = req.user;
  if (userIdToUpdate !== requestingUser.userId && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden: You can only update your own profile." });
  }
  const { username, displayName, currentPassword, newPassword } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userIdToUpdate);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    
    const isChangeRequiringPassword = (username && username !== user.username) || (newPassword && newPassword.length > 0);
    if (isChangeRequiringPassword && requestingUser.role !== 'admin') {
      if (!currentPassword) return res.status(401).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง' });
      if (!await bcrypt.compare(currentPassword, user.password)) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    
    const transaction = db.transaction(() => {
      if (username && username !== user.username) {
        if (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userIdToUpdate)) throw new Error('USERNAME_TAKEN');
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userIdToUpdate);
      }
      if (displayName && displayName !== user.display_name) {
        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, userIdToUpdate);
        db.prepare('UPDATE reviews SET author = ? WHERE user_id = ?').run(displayName, userIdToUpdate);
        db.prepare('UPDATE review_comments SET author = ? WHERE user_id = ?').run(displayName, userIdToUpdate);
      }
      if (newPassword && newPassword.length > 0) {
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedNewPassword, userIdToUpdate);
      }
      if (req.file) {
        db.prepare('UPDATE users SET profile_image_url = ? WHERE id = ?').run(`/uploads/${req.file.filename}`, userIdToUpdate);
      }
    });
    
    transaction();
    const updatedUserRaw = db.prepare('SELECT * FROM users WHERE id = ?').get(userIdToUpdate);
    
    const newToken = jwt.sign(
      { 
        userId: updatedUserRaw.id, 
        username: updatedUserRaw.username, 
        displayName: updatedUserRaw.display_name, 
        role: updatedUserRaw.role 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    res.json({ 
      message: 'อัปเดตโปรไฟล์สำเร็จ!', 
      user: formatUserForFrontend(updatedUserRaw), 
      token: newToken 
    });
  } catch (err) {
    if (err.message === 'USERNAME_TAKEN') return res.status(409).json({ error: 'ชื่อผู้ใช้สำหรับเข้าระบบนี้ถูกใช้งานแล้ว' });
    console.error("Profile update error:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
  }
});
app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
  const userIdToDelete = req.params.userId;
  const requestingUser = req.user;
  const { currentPassword } = req.body;

  if (userIdToDelete !== requestingUser.userId) {
    return res.status(403).json({ error: "Forbidden: You can only delete your own account." });
  }

  if (!currentPassword) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการลบบัญชี' });
  }

  try {
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userIdToDelete);
    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM reviews WHERE user_id = ?').run(userIdToDelete);
      db.prepare('DELETE FROM review_comments WHERE user_id = ?').run(userIdToDelete);
      db.prepare('DELETE FROM review_likes WHERE user_id = ?').run(userIdToDelete);
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userIdToDelete);
      db.prepare('DELETE FROM famous_products WHERE user_id = ?').run(userIdToDelete);
      db.prepare('DELETE FROM users WHERE id = ?').run(userIdToDelete);
    });

    deleteTransaction();

    res.json({ message: 'ลบบัญชีผู้ใช้และข้อมูลทั้งหมดเรียบร้อยแล้ว' });

  } catch (err) {
    console.error("Account deletion error:", err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในระหว่างการลบบัญชี' });
  }
});


// --- Auto-delete scheduler ---
setInterval(() => {
  console.log('Running scheduled job: checking for expired deletion requests...');
  
  const transaction = db.transaction(() => {
    // FIX: Use SQLite's built-in datetime function for reliable time comparison
    const expiredAttractions = db.prepare("SELECT id FROM attractions WHERE status = 'pending_deletion' AND deletion_requested_at < datetime('now', '-5 days')").all();
    const expiredFoodShops = db.prepare("SELECT id FROM foodShops WHERE status = 'pending_deletion' AND deletion_requested_at < datetime('now', '-5 days')").all();
    
    const allExpired = [...expiredAttractions, ...expiredFoodShops];

    if (allExpired.length > 0) {
      console.log(`Found ${allExpired.length} expired deletion requests. Deleting now...`);
      const deleteAttraction = db.prepare('DELETE FROM attractions WHERE id = ?');
      const deleteFoodShop = db.prepare('DELETE FROM foodShops WHERE id = ?');
      const deleteReviews = db.prepare('DELETE FROM reviews WHERE location_id = ?');
      const deleteProducts = db.prepare('DELETE FROM famous_products WHERE location_id = ?');
      const deleteFavorites = db.prepare('DELETE FROM favorites WHERE location_id = ?');

      for (const loc of allExpired) {
        deleteReviews.run(loc.id);
        deleteProducts.run(loc.id);
        deleteFavorites.run(loc.id);
        deleteAttraction.run(loc.id);
        deleteFoodShop.run(loc.id);
        console.log(`Deleted location ${loc.id} and all related data.`);
      }
    }
  });

  try {
    transaction();
  } catch(err) {
    console.error("Error during scheduled deletion:", err);
  }

}, 5 * 24 * 60 * 60 * 1000); // Run every minute for testing. Change to 60 * 60 * 1000 in production.


// --- Start Server ---
app.listen(port, () => {
  console.log(`✅✅✅ SERVER v14.0 IS RUNNING at http://localhost:${port}`);
});

process.on('SIGINT', () => {
  if (db) db.close();
  process.exit(0);
});

