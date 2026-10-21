-- =====================================================================
-- اسکیمای D1 برای نسخهٔ Cloudflare — تولیدشده با cloudflare/dump-sql.cjs
-- مبدأ: hospital.db • تاریخ: 2026-10-20T13:41:20.075Z
-- اجرا: npx wrangler d1 execute synapse-shift --local --file=cloudflare/schema.sql
-- =====================================================================
PRAGMA foreign_keys=OFF;

CREATE TABLE platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

CREATE TABLE super_admins (
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
      );

CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title_fa TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  , hierarchy_order INTEGER, hierarchy_level INTEGER);

CREATE TABLE hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    letterhead_config TEXT DEFAULT '{}',
    signature_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , subdomain TEXT, custom_url TEXT, admin_user_id TEXT REFERENCES users(id), created_by_super_admin TEXT REFERENCES super_admins(id), subscription_status TEXT DEFAULT "trial", subscription_expires_at TEXT, shift_print_config TEXT DEFAULT '{}');

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    national_id TEXT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role_id TEXT NOT NULL REFERENCES roles(id),
    department TEXT,
    supervisor_id TEXT REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , gender TEXT, avatar_file TEXT, bio TEXT, contact_method TEXT, title_prefix TEXT);

CREATE TABLE nursing_wards (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    icon TEXT DEFAULT '✚',
    head_nurse_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    deputy1_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    deputy2_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , bed_count INTEGER DEFAULT 0);

CREATE TABLE ward_staff (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'زن',
    personnel_code TEXT,
    mobile TEXT,
    position TEXT,
    hire_date TEXT,
    monthly_hour_quota INTEGER NOT NULL DEFAULT 169,
    extra_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , years_experience INTEGER, fixed_shift TEXT, employment_status TEXT DEFAULT 'قراردادی', sort_order INTEGER);

CREATE TABLE shift_schedules (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    jalali_year INTEGER NOT NULL,
    jalali_month INTEGER NOT NULL,
    note TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , holidays TEXT DEFAULT '', description TEXT, custom_rows TEXT, finalized_at TEXT, finalized_by TEXT, audit_json TEXT);

CREATE TABLE shift_entries (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES shift_schedules(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES ward_staff(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    codes TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  , is_lead INTEGER NOT NULL DEFAULT 0);

CREATE TABLE shift_ward_settings (
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    hour_m INTEGER NOT NULL DEFAULT 6,
    clock_m TEXT DEFAULT '07:00-13:30',
    hour_e INTEGER NOT NULL DEFAULT 6,
    clock_e TEXT DEFAULT '13:00-19:00',
    hour_n INTEGER NOT NULL DEFAULT 12,
    clock_n TEXT DEFAULT '19:00-07:00',
    hour_h INTEGER NOT NULL DEFAULT 6,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (hospital_id, ward)
  );

CREATE TABLE shift_units (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'پشتیبانی',
    sort_order INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

CREATE TABLE controlled_documents (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL DEFAULT 'procedure',
    title TEXT NOT NULL,
    doc_code TEXT,
    decree_text TEXT,
    issue_date TEXT,
    last_review_date TEXT,
    prepared_date TEXT,
    purpose TEXT,
    scope TEXT,
    legal_references TEXT,
    definitions TEXT,
    resources TEXT,
    related_staff TEXT,
    responsible_person TEXT,
    monitoring_method TEXT,
    work_method TEXT,
    related_documents TEXT,
    distribution_list TEXT DEFAULT '[]',
    attachment_file TEXT,
    attachment_name TEXT,
    status TEXT DEFAULT 'draft',
    version_no INTEGER DEFAULT 1,
    created_by TEXT REFERENCES users(id),
    updated_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  , section_id TEXT , is_example INTEGER DEFAULT 0, review_date TEXT, source TEXT, revision_no INTEGER DEFAULT 0);
CREATE INDEX idx_roles_hospital ON roles(hospital_id);
CREATE UNIQUE INDEX roles_code_unique ON roles(code);
CREATE UNIQUE INDEX idx_hospitals_subdomain ON hospitals(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX idx_users_hospital ON users(hospital_id);
CREATE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_nursing_ward_uniq ON nursing_wards(hospital_id, title);
CREATE INDEX idx_ward_staff_ward ON ward_staff(hospital_id, ward);
CREATE UNIQUE INDEX idx_ward_staff_code ON ward_staff(hospital_id, personnel_code)
     WHERE personnel_code IS NOT NULL AND personnel_code != '';
CREATE UNIQUE INDEX idx_shift_sched_uniq ON shift_schedules(hospital_id, ward, jalali_year, jalali_month);
CREATE UNIQUE INDEX idx_shift_entry_uniq ON shift_entries(schedule_id, staff_id, day);
CREATE UNIQUE INDEX idx_shift_units_uniq ON shift_units(hospital_id, title);
CREATE INDEX idx_cdoc_hospital ON controlled_documents(hospital_id, doc_type);
CREATE INDEX idx_cdoc_section ON controlled_documents(section_id);
CREATE INDEX idx_controlled_docs_code ON controlled_documents(doc_code);
CREATE INDEX idx_controlled_docs_source ON controlled_documents(source);
