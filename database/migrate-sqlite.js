/**
 * SQLite Migration Script
 * Creates all tables with SQLite-compatible types
 */
const { db, query } = require('../src/config/database-sqlite');
const bcrypt = require('bcryptjs');
const config = require('../src/config/app');
const fs = require('fs');
const path = require('path');

const migrations = [
  `CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    letterhead_config TEXT DEFAULT '{}',
    signature_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title_fa TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS users (
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
  )`,

  `CREATE TABLE IF NOT EXISTS accreditation_sections (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    level_type TEXT NOT NULL,
    parent_id TEXT REFERENCES accreditation_sections(id) ON DELETE CASCADE,
    title TEXT,
    statement TEXT,
    detail_text TEXT,
    page INTEGER,
    measure_level INTEGER,
    patient_safety_flag INTEGER DEFAULT 0,
    weight_multiplier REAL DEFAULT 1.0
  )`,

  `CREATE TABLE IF NOT EXISTS activity_types (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    form_schema TEXT DEFAULT '{}',
    requires_evidence_upload INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS activity_measure_mapping (
    id TEXT PRIMARY KEY,
    activity_type_id TEXT NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
    measure_id TEXT NOT NULL REFERENCES accreditation_sections(id) ON DELETE CASCADE,
    auto_evidence INTEGER DEFAULT 1,
    created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(activity_type_id, measure_id)
  )`,

  `CREATE TABLE IF NOT EXISTS activity_records (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    activity_type_id TEXT NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
    recorded_by TEXT NOT NULL REFERENCES users(id),
    department TEXT,
    form_data TEXT DEFAULT '{}',
    status TEXT DEFAULT 'submitted',
    occurred_at TEXT NOT NULL,
    is_confidential INTEGER DEFAULT 0,
    is_anonymous_submission INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS activity_evidence_files (
    id TEXT PRIMARY KEY,
    activity_record_id TEXT NOT NULL REFERENCES activity_records(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT,
    original_filename TEXT,
    file_size_bytes INTEGER,
    uploaded_by TEXT REFERENCES users(id),
    uploaded_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS measure_status (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    measure_id TEXT NOT NULL REFERENCES accreditation_sections(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'not_reviewed',
    notes TEXT,
    last_reviewed_by TEXT REFERENCES users(id),
    last_reviewed_at TEXT,
    linked_activity_record_id TEXT REFERENCES activity_records(id) ON DELETE SET NULL,
    UNIQUE(hospital_id, measure_id)
  )`,

  `CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    recurrence_rule TEXT,
    target_role_ids TEXT,
    reminder_days_before INTEGER DEFAULT 1,
    related_measure_id TEXT REFERENCES accreditation_sections(id),
    created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_by TEXT NOT NULL REFERENCES users(id),
    assigned_to TEXT NOT NULL REFERENCES users(id),
    related_measure_id TEXT REFERENCES accreditation_sections(id),
    due_date TEXT,
    status TEXT DEFAULT 'assigned',
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS committees (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    committee_type TEXT,
    members TEXT DEFAULT '[]',
    chairperson_id TEXT REFERENCES users(id),
    meeting_frequency TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS committee_meeting_minutes (
    id TEXT PRIMARY KEY,
    committee_id TEXT NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    meeting_date TEXT NOT NULL,
    attendees TEXT DEFAULT '[]',
    agenda_items TEXT DEFAULT '[]',
    decisions TEXT DEFAULT '[]',
    next_meeting_date TEXT,
    document_file_id TEXT REFERENCES activity_evidence_files(id) ON DELETE SET NULL,
    created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS nursing_shift_reports (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_reference TEXT,
    nurse_id TEXT NOT NULL REFERENCES users(id),
    shift_type TEXT NOT NULL,
    shift_date TEXT NOT NULL,
    structured_data TEXT DEFAULT '{}',
    free_text_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS patient_complaints_suggestions (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_anonymous INTEGER DEFAULT 1,
    submitter_contact TEXT,
    status TEXT DEFAULT 'new',
    handled_by TEXT REFERENCES users(id),
    response TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS staff_suggestions (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    submitted_by TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    reviewer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS medical_error_reports (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    error_category TEXT,
    description TEXT NOT NULL,
    is_confidential INTEGER DEFAULT 1,
    is_anonymous_submission INTEGER DEFAULT 0,
    severity TEXT,
    reported_by TEXT REFERENCES users(id),
    department TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS patient_satisfaction_surveys (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department TEXT,
    questions_and_answers TEXT DEFAULT '{}',
    overall_score REAL,
    submitted_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS hospital_kpis (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    dimension TEXT,
    indicator_type TEXT,
    aspect TEXT,
    definition TEXT,
    numerator_description TEXT,
    denominator_description TEXT,
    target_value REAL,
    upper_limit REAL,
    lower_limit REAL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS gen6_rankings (
    id TEXT PRIMARY KEY,
    rank_code TEXT NOT NULL UNIQUE,
    rank_title_fa TEXT NOT NULL,
    min_total_percent INTEGER NOT NULL,
    min_safety_percent INTEGER NOT NULL,
    special_conditions TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

// Indexes
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id)',
  'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
  'CREATE INDEX IF NOT EXISTS idx_accred_sections_parent ON accreditation_sections(parent_id)',
  'CREATE INDEX IF NOT EXISTS idx_accred_sections_code ON accreditation_sections(code)',
  'CREATE INDEX IF NOT EXISTS idx_accred_sections_level ON accreditation_sections(level_type)',
  'CREATE INDEX IF NOT EXISTS idx_activity_records_hospital ON activity_records(hospital_id)',
  'CREATE INDEX IF NOT EXISTS idx_measure_status_hospital ON measure_status(hospital_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_hospital ON tasks(hospital_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)',
  'CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date)',
  'CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_kpis_hospital ON hospital_kpis(hospital_id)',
];

function uuid() {
  return require('crypto').randomUUID();
}

async function runMigrations() {
  console.log('[Migration] Starting SQLite migrations...');
  for (const sql of migrations) {
    try { db.exec(sql); } catch (err) { console.error('[Migration] FAILED:', err.message); }
  }
  for (const sql of indexes) {
    try { db.exec(sql); } catch (err) { console.error('[Migration] Index FAILED:', err.message); }
  }
  console.log('[Migration] Done');
}

async function seedData() {
  console.log('[Seed] Starting...');

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM hospitals').get();
  if (existing.count > 0) {
    console.log('[Seed] Already seeded, skipping');
    return;
  }

  // Hospital
  const hospitalId = uuid();
  db.prepare(`INSERT INTO hospitals (id, name, letterhead_config, signature_config) VALUES (?, ?, ?, ?)`).run(
    hospitalId, config.defaultHospitalName, '{}', '{}'
  );
  console.log('[Seed] Hospital created:', hospitalId);

  // Roles
  const ROLE_DEFINITIONS = [
    { code: 'admin', title_fa: 'مدیر داخلی', permissions: ['manage_users','manage_roles','manage_hospital_settings','manage_letterhead_signature','manage_activity_types','manage_activity_measure_mapping','manage_calendar_events','manage_committees','create_committee_minutes','view_committee_minutes','view_all_dashboards','view_audit_log','export_reports','view_accreditation_full_tree','view_confidential_records'] },
    { code: 'nursing_director', title_fa: 'مدیر پرستاری', permissions: ['view_own_dashboard','view_accreditation_full_tree','edit_measure_status','approve_measure_status','view_measure_status_readonly','submit_activity_record','view_own_activity_records','view_all_activity_records','approve_activity_record','upload_evidence_file','view_calendar','assign_tasks','view_all_tasks','manage_committees','create_committee_minutes','view_committee_minutes','view_nursing_shift_reports','view_staff_performance_dashboard','export_reports'] },
    { code: 'education_supervisor', title_fa: 'سوپروایزر آموزشی', permissions: ['view_own_dashboard','view_measure_status_readonly','edit_measure_status','submit_activity_record','view_own_activity_records','upload_evidence_file','view_calendar','view_own_tasks','create_committee_minutes','view_committee_minutes','submit_staff_suggestion'] },
    { code: 'clinical_supervisor', title_fa: 'سوپروایزر بالینی', permissions: ['view_own_dashboard','view_measure_status_readonly','edit_measure_status','submit_activity_record','view_own_activity_records','upload_evidence_file','view_calendar','view_own_tasks','assign_tasks','view_committee_minutes','submit_staff_suggestion','view_nursing_shift_reports'] },
    { code: 'infection_control_supervisor', title_fa: 'سوپروایزر کنترل عفونت', permissions: ['view_own_dashboard','view_measure_status_readonly','edit_measure_status','submit_activity_record','view_own_activity_records','upload_evidence_file','view_calendar','view_own_tasks','manage_committees','create_committee_minutes','view_committee_minutes','submit_medical_error_report','manage_medical_error_reports'] },
    { code: 'breastfeeding_specialist', title_fa: 'کارشناس شیر مادر', permissions: ['view_own_dashboard','view_measure_status_readonly','edit_measure_status','submit_activity_record','view_own_activity_records','upload_evidence_file','view_calendar','view_own_tasks'] },
    { code: 'quality_control_manager', title_fa: 'مدیر کنترل کیفیت', permissions: ['view_all_dashboards','view_accreditation_full_tree','edit_measure_status','approve_measure_status','view_all_activity_records','approve_activity_record','view_calendar','manage_calendar_events','view_all_tasks','assign_tasks','view_committee_minutes','manage_committees','create_committee_minutes','view_staff_performance_dashboard','manage_patient_complaints','review_staff_suggestions','manage_medical_error_reports','view_confidential_records','export_reports','view_audit_log'] },
    { code: 'staff_nurse', title_fa: 'پرستار', permissions: ['view_own_dashboard','view_own_tasks','submit_nursing_shift_report','submit_staff_suggestion','submit_medical_error_report','view_calendar'] },
    { code: 'anonymous_reporter', title_fa: 'گزارش‌دهنده ناشناس', permissions: ['submit_patient_complaint_suggestion','submit_medical_error_report'] },
  ];

  const roleIds = {};
  for (const role of ROLE_DEFINITIONS) {
    const roleId = uuid();
    roleIds[role.code] = roleId;
    db.prepare('INSERT INTO roles (id, hospital_id, code, title_fa, permissions) VALUES (?, NULL, ?, ?, ?)').run(
      roleId, role.code, role.title_fa, JSON.stringify(role.permissions)
    );
  }
  console.log('[Seed] Roles created:', Object.keys(roleIds).length);

  // Admin user
  const passwordHash = bcrypt.hashSync('admin123456', config.bcrypt.rounds);
  db.prepare(`INSERT INTO users (id, hospital_id, full_name, username, password_hash, role_id, department) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuid(), hospitalId, 'مدیر سیستم', 'admin', passwordHash, roleIds.admin, 'مدیریت'
  );
  console.log('[Seed] Admin user created (admin / admin123456)');

  // Accreditation data
  const dataPath = path.join(__dirname, 'accreditation-standards-data.json');
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    let sectionCount = 0, axisCount = 0, standardCount = 0, measureCount = 0;
    const insertSection = db.prepare('INSERT INTO accreditation_sections (id, code, level_type, parent_id, title, statement, detail_text, page, measure_level, patient_safety_flag, weight_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const insertMany = db.transaction(() => {
      for (const [sectionCode, sectionData] of Object.entries(data)) {
        const sectionId = uuid();
        insertSection.run(sectionId, sectionCode, 'section', null, sectionData.title || null, null, null, sectionData.title_page || null, null, 0, 1.0);
        sectionCount++;

        if (!sectionData.axes) continue;
        for (const [axisCode, axisData] of Object.entries(sectionData.axes)) {
          const axisId = uuid();
          insertSection.run(axisId, axisCode, 'axis', sectionId, axisData.title || null, null, null, null, null, 0, 1.0);
          axisCount++;

          if (axisData.standards) {
            for (const [stdCode, stdData] of Object.entries(axisData.standards)) {
              const stdId = uuid();
              insertSection.run(stdId, stdCode, 'standard', axisId, stdData.code || stdCode, stdData.statement || null, null, stdData.page || null, null, 0, 1.0);
              standardCount++;
            }
          }

          if (axisData.measures && Array.isArray(axisData.measures)) {
            for (const measure of axisData.measures) {
              let parentStandardId = null;
              if (measure.standard_code) {
                const stdRow = db.prepare('SELECT id FROM accreditation_sections WHERE code = ? AND level_type = ?').get(measure.standard_code, 'standard');
                if (stdRow) parentStandardId = stdRow.id;
              }
              if (!parentStandardId) parentStandardId = axisId;

              insertSection.run(uuid(), measure.code, 'measure', parentStandardId, null,
                measure.statement || null, measure.detail_text || null, measure.page || null,
                measure.level || null, measure.patient_safety_flag ? 1 : 0,
                measure.patient_safety_flag ? 2.0 : 1.0);
              measureCount++;
            }
          }
        }
      }
    });
    insertMany();
    console.log(`[Seed] Accreditation: ${sectionCount} sections, ${axisCount} axes, ${standardCount} standards, ${measureCount} measures`);
  }

  // Committees
  const DEFAULT_COMMITTEES = [
    { type: 'infection_control', name: 'کمیته کنترل عفونت' },
    { type: 'accreditation', name: 'کمیته اعتباربخشی' },
    { type: 'pharmacy', name: 'کمیته دارویی' },
    { type: 'patient_safety', name: 'کمیته ایمنی بیمار' },
    { type: 'ethics', name: 'کمیته اخلاق پزشکی' },
    { type: 'nursing', name: 'کمیته پرستاری' },
  ];
  for (const c of DEFAULT_COMMITTEES) {
    db.prepare('INSERT INTO committees (id, hospital_id, name, committee_type, meeting_frequency) VALUES (?, ?, ?, ?, ?)').run(
      uuid(), hospitalId, c.name, c.type, 'ماهانه'
    );
  }

  // Calendar events
  const currentYear = new Date().getFullYear();
  const events = [
    { title: 'روز جهانی بهداشت دست', desc: 'یادآوری اهمیت شستشوی دست', month: 5, day: 5, role: 'infection_control_supervisor' },
    { title: 'هفته جهانی شیر مادر', desc: 'ترویج شیردهی', month: 8, day: 1, role: 'breastfeeding_specialist' },
    { title: 'روز ملی پرستار', desc: 'بزرگداشت زحمات پرستاران', month: 5, day: 12, role: null },
    { title: 'روز جهانی بیمار', desc: 'توجه به حقوق بیمار', month: 8, day: 9, role: null },
  ];
  for (const evt of events) {
    const date = `${currentYear}-${String(evt.month).padStart(2,'0')}-${String(evt.day).padStart(2,'0')}`;
    let targetRoles = null;
    if (evt.role && roleIds[evt.role]) targetRoles = JSON.stringify([roleIds[evt.role]]);
    db.prepare('INSERT INTO calendar_events (id, hospital_id, title, description, event_date, is_recurring, recurrence_rule, target_role_ids, reminder_days_before) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), hospitalId, evt.title, evt.desc, date, 1, 'yearly', targetRoles, 3
    );
  }

  // Gen6 Rankings
  const GEN6_RANKINGS = [
    { rank: 'excellent', title_fa: 'عالی', min_total: 85, min_safety: 80, condition: 'هیچ محوری کمتر از ۸۰ نباشد + ۵ مزیت منحصر به فرد' },
    { rank: 'superior', title_fa: 'برتر', min_total: 75, min_safety: 70, condition: 'هیچ محوری کمتر از ۷۰ نباشد + ۵ مزیت منحصر به فرد' },
    { rank: 'level_1', title_fa: 'سطح یک', min_total: 65, min_safety: 60, condition: 'عدم سوابق نظارتی موثر' },
    { rank: 'level_2', title_fa: 'سطح دو', min_total: 60, min_safety: 55, condition: 'عدم سوابق نظارتی موثر' },
    { rank: 'level_3', title_fa: 'سطح سه', min_total: 52, min_safety: 50, condition: 'عدم سوابق نظارتی موثر' },
    { rank: 'level_4', title_fa: 'سطح چهار', min_total: 48, min_safety: 50, condition: 'عدم سوابق نظارتی موثر' },
  ];
  for (const r of GEN6_RANKINGS) {
    db.prepare('INSERT INTO gen6_rankings (id, rank_code, rank_title_fa, min_total_percent, min_safety_percent, special_conditions) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuid(), r.rank, r.title_fa, r.min_total, r.min_safety, r.condition
    );
  }

  // KPIs (key subset from Excel)
  const KPI_INDICATORS = [
    { title: 'میزان سقوط بیمار', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'سقوط بیمار از تخت یا در سرویس بهداشتی', num: 'تعداد موارد سقوط', den: 'کل بیماران بستری', target: 0 },
    { title: 'نرخ مرگ و میر در اثر MI', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'بیماران MI که فوت شده‌اند', num: 'بیماران فوتی MI', den: 'کل بیماران MI', target: null },
    { title: 'میزان عوارض انتقال خون', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'علائم ناخواسته پس از انتقال خون', num: 'موارد عارضه', den: 'کل انتقال خون', target: null },
    { title: 'میزان جدا شدن زخم محل جراحی', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'جدا شدن زخم محل جراحی', num: 'موارد', den: 'کل جراحی‌ها', target: null },
    { title: 'میزان زخم بستر (فشاری)', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'بیماران بستری با زخم بستر جدید', num: 'بیماران با زخم بستر', den: 'کل ترخیص‌ها', target: null },
    { title: 'میزان عفونت زخم محل جراحی', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'عفونت با کشت مثبت', num: 'موارد عفونت', den: 'کل جراحی‌ها', target: null },
    { title: 'میزان عفونت بیمارستانی', cat: 'infection_control', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'عفونت ۴۸-۷۲ ساعت پس از پذیرش', num: 'موارد', den: 'کل بستری‌ها', target: null },
    { title: 'میزان عوارض بیهوشی', cat: 'patient_safety', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'عوارض بیهوشی', num: 'موارد', den: 'کل بیهوشی‌ها', target: null },
    { title: 'درصد CPR موفق در اورژانس', cat: 'emergency', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'نسبت CPR موفق به کل CPR', num: 'CPR موفق', den: 'کل CPR', target: null },
    { title: 'درصد CPR ناموفق در اورژانس', cat: 'emergency', dim: 'ایمنی', type: 'پیامدی', asp: 'بالینی', def: 'نسبت CPR ناموفق به کل CPR', num: 'CPR ناموفق', den: 'کل CPR', target: null },
    { title: 'درصد ترک با مسئولیت شخصی', cat: 'emergency', dim: 'رضایتمندی', type: 'پیامدی', asp: 'بالینی', def: 'ترک درمان نیمه‌کاره', num: 'موارد ترک', den: 'کل بستری اورژانس', target: null },
    { title: 'میانگین زمان انتظار ویزیت (تریاژ ۱)', cat: 'emergency', dim: 'به‌موقع بودن', type: 'فرآیندی', asp: 'بالینی', def: 'زمان بین تریاژ و ویزیت', num: 'مجموع زمان', den: 'تعداد بیماران', target: null },
    { title: 'میانه زمان خروج از اورژانس', cat: 'emergency', dim: 'به‌موقع بودن', type: 'فرآیندی', asp: 'بالینی', def: 'میانه ماندگاری در اورژانس', num: 'زمان خروج-ورود', den: 'تعداد بیماران', target: null },
    { title: 'درصد خروج زیر ۱۲ ساعت اورژانس', cat: 'emergency', dim: 'به‌موقع بودن', type: 'ساختاری', asp: 'بالینی', def: 'تعیین تکلیف زیر ۱۲ ساعت', num: 'خروج زیر ۱۲ ساعت', den: 'کل اورژانس', target: null },
  ];
  for (const kpi of KPI_INDICATORS) {
    db.prepare('INSERT INTO hospital_kpis (id, hospital_id, title, category, dimension, indicator_type, aspect, definition, numerator_description, denominator_description, target_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), hospitalId, kpi.title, kpi.cat, kpi.dim, kpi.type, kpi.asp, kpi.def, kpi.num, kpi.den, kpi.target
    );
  }
  console.log('[Seed] KPIs created:', KPI_INDICATORS.length);
  console.log('[Seed] ✅ All data seeded!');
  console.log('[Seed] Login: admin / admin123456');
}

async function run() {
  await runMigrations();
  await seedData();
  process.exit(0);
}

run();
