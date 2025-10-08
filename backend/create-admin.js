const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// --- Admin Account Details ---
const ADMIN_USERNAME = 'Wiritpon';
const ADMIN_PASSWORD = '0612569592';
// -----------------------------

const db = new Database('./travel_guide.db');
console.log('Connected to the travel_guide.db database.');

async function setupAdmin() {
  try {
    // Step 1: Ensure the 'role' column exists in the users table.
    const columns = db.prepare(`PRAGMA table_info(users)`).all();
    const columnExists = columns.some(col => col.name === 'role');
    if (!columnExists) {
      console.log("Adding 'role' column to 'users' table...");
      db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
      console.log("Column 'role' added successfully.");
    }

    // Step 2: Check if the admin user already exists.
    const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get(ADMIN_USERNAME);

    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
         db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(ADMIN_USERNAME);
         console.log(`User '${ADMIN_USERNAME}' already existed and has been PROMOTED to admin.`);
      } else {
        console.log(`Admin user '${ADMIN_USERNAME}' already exists. No action needed.`);
      }
      return;
    }

    // Step 3: If admin user does not exist, create a new one.
    console.log(`Admin user '${ADMIN_USERNAME}' not found. Creating new admin account...`);
    
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    const newAdmin = {
      id: crypto.randomUUID(),
      username: ADMIN_USERNAME,
      display_name: 'Admin ' + ADMIN_USERNAME,
      password: hashedPassword,
      profile_image_url: null,
      role: 'admin', // Set the role to 'admin'
    };

    const stmt = db.prepare(
      'INSERT INTO users (id, username, display_name, password, profile_image_url, role) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(newAdmin.id, newAdmin.username, newAdmin.display_name, newAdmin.password, newAdmin.profile_image_url, newAdmin.role);
    
    console.log(`✅ Successfully created new admin user: ${ADMIN_USERNAME}`);

  } catch (err) {
    console.error('❌ Error during admin setup:', err.message);
  } finally {
    db.close();
    console.log('Database connection closed.');
  }
}

setupAdmin();

