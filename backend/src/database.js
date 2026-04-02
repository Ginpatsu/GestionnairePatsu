const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

const DB_PATH = path.join(__dirname, '..', 'data', 'mcpanel.db');

const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================
// Tables
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'operator', 'admin', 'admin+')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'Minecraft',
    icon TEXT DEFAULT 'Sword',
    ssh_host TEXT NOT NULL,
    ssh_port INTEGER DEFAULT 22,
    ssh_username TEXT NOT NULL,
    ssh_password TEXT DEFAULT '',
    ssh_key_path TEXT DEFAULT '',
    server_path TEXT NOT NULL,
    screen_name TEXT NOT NULL DEFAULT 'minecraft',
    jar_file TEXT DEFAULT 'server.jar',
    min_ram TEXT DEFAULT '1G',
    max_ram TEXT DEFAULT '4G',
    run_as_user TEXT DEFAULT '',
    start_script TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS server_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(server_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    server_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ============================================
// Migration : recréer users avec le bon CHECK si besoin
// ============================================
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'operator', 'admin', 'admin+')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO users_new SELECT * FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
} catch {
  // Déjà à jour
}

// ============================================
// Admin+ par défaut si aucun utilisateur
// ============================================
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync(config.defaultAdmin.password, 12);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
    config.defaultAdmin.username,
    hashedPassword,
    'admin+'
  );
  console.log(`[DB] Admin+ par défaut créé : ${config.defaultAdmin.username}`);
}

// ============================================
// Migration : ajouter colonnes category et icon si manquantes
// ============================================
try {
  db.exec(`ALTER TABLE servers ADD COLUMN category TEXT DEFAULT 'Minecraft'`);
} catch {}
try {
  db.exec(`ALTER TABLE servers ADD COLUMN icon TEXT DEFAULT 'Sword'`);
} catch {}

// ============================================
// Serveur par défaut depuis .env si aucun serveur
// ============================================
const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get();
if (serverCount.count === 0 && config.ssh.host) {
  db.prepare(`
    INSERT INTO servers (name, description, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path,
      server_path, screen_name, jar_file, min_ram, max_ram, run_as_user, start_script)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Serveur principal',
    'Serveur importé depuis la configuration',
    config.ssh.host,
    config.ssh.port,
    config.ssh.username,
    config.ssh.password || '',
    config.ssh.privateKeyPath || '',
    config.minecraft.serverPath,
    config.minecraft.screenName,
    config.minecraft.jarFile,
    config.minecraft.minRam,
    config.minecraft.maxRam,
    config.minecraft.runAsUser || '',
    config.minecraft.startScript || ''
  );
  console.log('[DB] Serveur par défaut créé depuis .env');
}

module.exports = db;
