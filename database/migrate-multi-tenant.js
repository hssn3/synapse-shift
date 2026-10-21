/**
 * Multi-Tenant Migration
 * Adds super_admins table and hospital subdomain support
 */
const { db } = require('../src/config/database-sqlite');
const bcrypt = require('bcryptjs');

function uuid() {
  return require('crypto').randomUUID();
}

async function runMigration() {
  console.log('[Migration Multi-Tenant] Starting...');

  try {
    // 1. Create super_admins table
    db.exec(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('[Migration] super_admins table created');

    // 2. Add new columns to hospitals (if not exist)
    const hospitalCols = db.prepare("PRAGMA table_info(hospitals)").all();
    const hasSubdomain = hospitalCols.some(c => c.name === 'subdomain');
    
    if (!hasSubdomain) {
      // نکته: SQLite اجازه نمی‌دهد ستون جدید مستقیماً UNIQUE باشد (محدودیت شناخته‌شده ALTER TABLE در SQLite)
      // به‌جای آن: ستون ساده اضافه می‌شود و یکتایی با یک ایندکس UNIQUE جدا تضمین می‌شود
      db.exec('ALTER TABLE hospitals ADD COLUMN subdomain TEXT');
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_subdomain ON hospitals(subdomain) WHERE subdomain IS NOT NULL');
      db.exec('ALTER TABLE hospitals ADD COLUMN custom_url TEXT');
      db.exec('ALTER TABLE hospitals ADD COLUMN admin_user_id TEXT REFERENCES users(id)');
      db.exec('ALTER TABLE hospitals ADD COLUMN created_by_super_admin TEXT REFERENCES super_admins(id)');
      db.exec('ALTER TABLE hospitals ADD COLUMN subscription_status TEXT DEFAULT "trial"');
      db.exec('ALTER TABLE hospitals ADD COLUMN subscription_expires_at TEXT');
      console.log('[Migration] hospitals table extended with multi-tenant fields');
    } else {
      console.log('[Migration] hospitals already has multi-tenant fields, skipping');
    }

    // 3. Create super admin user
    const existing = db.prepare('SELECT id FROM super_admins WHERE username = ?').get('superadmin');
    if (!existing) {
      const passwordHash = bcrypt.hashSync('SuperAdmin@2026', 12);
      const superAdminId = uuid();
      db.prepare(`
        INSERT INTO super_admins (id, full_name, username, password_hash, email)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        superAdminId,
        'مدیر اصلی پلتفرم',
        'superadmin',
        passwordHash,
        'admin@hospital-platform.ir'
      );
      console.log('[Migration] Super admin created:');
      console.log('   Username: superadmin');
      console.log('   Password: SuperAdmin@2026');
      console.log('   ⚠️  Change this password immediately!');
    } else {
      console.log('[Migration] Super admin already exists');
    }

    console.log('[Migration Multi-Tenant] ✅ Done');
  } catch (err) {
    console.error('[Migration Multi-Tenant] ❌ Failed:', err);
    throw err;
  }
}

async function run() {
  await runMigration();
  process.exit(0);
}

run();
