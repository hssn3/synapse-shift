/**
 * Database Seed Script
 * Seeds: hospital, roles, admin user, accreditation data
 * Run: npm run seed
 */
const { query, getClient } = require('../src/config/database');
const config = require('../src/config/app');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Role definitions from ROLES_AND_PERMISSIONS.json
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

// Default committee types
const DEFAULT_COMMITTEE_TYPES = [
  { type: 'infection_control', name: 'کمیته کنترل عفونت' },
  { type: 'accreditation', name: 'کمیته اعتباربخشی' },
  { type: 'pharmacy', name: 'کمیته دارویی' },
  { type: 'patient_safety', name: 'کمیته ایمنی بیمار' },
  { type: 'ethics', name: 'کمیته اخلاق پزشکی' },
  { type: 'nursing', name: 'کمیته پرستاری' },
];

// Default calendar events (Iranian health observances)
const DEFAULT_CALENDAR_EVENTS = [
  { title: 'روز جهانی بهداشت دست', description: 'فرا رسیدن روز جهانی بهداشت دست - یادآوری اهمیت شستشوی دست در کنترل عفونت', month: 5, day: 5, recurring: true, targetRole: 'infection_control_supervisor' },
  { title: 'روز جهانی بیماری‌های عفونی', description: 'روز جهانی آگاهی‌بخشی درباره بیماری‌های عفونی', month: 4, day: 7, recurring: true, targetRole: 'infection_control_supervisor' },
  { title: 'هفته جهانی شیر مادر', description: 'هفته جهانی تغذیه با شیر مادر - ترویج شیردهی اختصاصی', month: 8, day: 1, recurring: true, targetRole: 'breastfeeding_specialist' },
  { title: 'روز جهانی بیمار', description: 'فرا رسیدن روز جهانی بیمار - توجه به حقوق بیمار', month: 8, day: 9, recurring: true, targetRole: null },
  { title: 'روز ملی پرستار', description: 'روز ملی پرستار - بزرگداشت زحمات پرستاران', month: 5, day: 12, recurring: true, targetRole: null },
];

async function seedHospital() {
  console.log('[Seed] Creating default hospital...');
  const existing = await query('SELECT id FROM hospitals LIMIT 1');
  if (existing.rows.length > 0) {
    console.log('[Seed] Hospital already exists, skipping');
    return existing.rows[0].id;
  }
  const res = await query(
    `INSERT INTO hospitals (name, letterhead_config, signature_config) VALUES ($1, $2, $3) RETURNING id`,
    [
      config.defaultHospitalName,
      JSON.stringify({ header_text: '', footer_text: '', address: '', phone: '', logo_url: '' }),
      JSON.stringify({ enabled: false, signatory_name: '', signatory_title: '', signature_image_url: '' }),
    ]
  );
  console.log('[Seed] Hospital created:', res.rows[0].id);
  return res.rows[0].id;
}

async function seedRoles(hospitalId) {
  console.log('[Seed] Creating roles...');
  for (const role of ROLE_DEFINITIONS) {
    const existing = await query('SELECT id FROM roles WHERE code = $1 AND (hospital_id = $2 OR hospital_id IS NULL)', [role.code, hospitalId]);
    if (existing.rows.length > 0) {
      // Update permissions
      await query('UPDATE roles SET permissions = $1 WHERE id = $2', [JSON.stringify(role.permissions), existing.rows[0].id]);
      console.log(`[Seed] Role updated: ${role.code}`);
    } else {
      await query(
        'INSERT INTO roles (hospital_id, code, title_fa, permissions) VALUES ($1, $2, $3, $4)',
        [null, role.code, role.title_fa, JSON.stringify(role.permissions)]
      );
      console.log(`[Seed] Role created: ${role.code}`);
    }
  }
}

async function seedAdminUser(hospitalId) {
  console.log('[Seed] Creating admin user...');
  const existing = await query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (existing.rows.length > 0) {
    console.log('[Seed] Admin user already exists, skipping');
    return;
  }
  const roleRes = await query('SELECT id FROM roles WHERE code = $1', ['admin']);
  if (roleRes.rows.length === 0) {
    console.error('[Seed] Admin role not found!');
    return;
  }
  const passwordHash = await bcrypt.hash('admin123456', config.bcrypt.rounds);
  await query(
    `INSERT INTO users (hospital_id, full_name, username, password_hash, role_id, department)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [hospitalId, 'مدیر سیستم', 'admin', passwordHash, roleRes.rows[0].id, 'مدیریت']
  );
  console.log('[Seed] Admin user created (username: admin, password: admin123456)');
  console.log('[Seed] ⚠️  Please change the admin password after first login!');
}

async function seedAccreditationData() {
  console.log('[Seed] Seeding accreditation standards data...');
  const existing = await query('SELECT COUNT(*) as count FROM accreditation_sections');
  if (parseInt(existing.rows[0].count) > 0) {
    console.log('[Seed] Accreditation data already exists, skipping');
    return;
  }

  const dataPath = path.join(__dirname, 'accreditation-standards-data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('[Seed] accreditation-standards-data.json not found at', dataPath);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let sectionCount = 0, axisCount = 0, standardCount = 0, measureCount = 0;

    for (const [sectionCode, sectionData] of Object.entries(data)) {
      // Insert section
      const sectionRes = await client.query(
        `INSERT INTO accreditation_sections (code, level_type, title, page)
         VALUES ($1, 'section', $2, $3) RETURNING id`,
        [sectionCode, sectionData.title || null, sectionData.title_page || null]
      );
      const sectionId = sectionRes.rows[0].id;
      sectionCount++;

      if (!sectionData.axes) continue;

      for (const [axisCode, axisData] of Object.entries(sectionData.axes)) {
        // Insert axis
        const axisRes = await client.query(
          `INSERT INTO accreditation_sections (code, level_type, parent_id, title)
           VALUES ($1, 'axis', $2, $3) RETURNING id`,
          [axisCode, sectionId, axisData.title || null]
        );
        const axisId = axisRes.rows[0].id;
        axisCount++;

        // Insert standards
        if (axisData.standards) {
          for (const [stdCode, stdData] of Object.entries(axisData.standards)) {
            const stdRes = await client.query(
              `INSERT INTO accreditation_sections (code, level_type, parent_id, title, statement, page)
               VALUES ($1, 'standard', $2, $3, $4, $5) RETURNING id`,
              [stdCode, axisId, stdData.code || stdCode, stdData.statement || null, stdData.page || null]
            );
            standardCount++;
          }
        }

        // Insert measures
        if (axisData.measures && Array.isArray(axisData.measures)) {
          for (const measure of axisData.measures) {
            // Find parent standard
            let parentStandardId = null;
            if (measure.standard_code) {
              const stdRes = await client.query(
                'SELECT id FROM accreditation_sections WHERE code = $1 AND level_type = $2',
                [measure.standard_code, 'standard']
              );
              if (stdRes.rows.length > 0) {
                parentStandardId = stdRes.rows[0].id;
              }
            }
            if (!parentStandardId) parentStandardId = axisId;

            await client.query(
              `INSERT INTO accreditation_sections
                 (code, level_type, parent_id, statement, detail_text, page, measure_level, patient_safety_flag, weight_multiplier)
               VALUES ($1, 'measure', $2, $3, $4, $5, $6, $7, $8)`,
              [
                measure.code,
                parentStandardId,
                measure.statement || null,
                measure.detail_text || null,
                measure.page || null,
                measure.level || null,
                measure.patient_safety_flag ? 1 : 0,
                (measure.patient_safety_flag ? 2.0 : 1.0),
              ]
            );
            measureCount++;
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[Seed] Accreditation data inserted: ${sectionCount} sections, ${axisCount} axes, ${standardCount} standards, ${measureCount} measures`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Error seeding accreditation data:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function seedDefaultCommittees(hospitalId) {
  console.log('[Seed] Creating default committees...');
  for (const c of DEFAULT_COMMITTEE_TYPES) {
    const existing = await query('SELECT id FROM committees WHERE hospital_id = $1 AND committee_type = $2', [hospitalId, c.type]);
    if (existing.rows.length > 0) continue;
    await query(
      'INSERT INTO committees (hospital_id, name, committee_type, meeting_frequency) VALUES ($1, $2, $3, $4)',
      [hospitalId, c.name, c.type, 'ماهانه']
    );
    console.log(`[Seed] Committee created: ${c.name}`);
  }
}

async function seedDefaultCalendarEvents(hospitalId) {
  console.log('[Seed] Creating default calendar events...');
  const currentYear = new Date().getFullYear();
  
  for (const evt of DEFAULT_CALENDAR_EVENTS) {
    const eventDate = `${currentYear}-${String(evt.month).padStart(2,'0')}-${String(evt.day).padStart(2,'0')}`;
    const existing = await query('SELECT id FROM calendar_events WHERE hospital_id = $1 AND title = $2 AND event_date = $3', [hospitalId, evt.title, eventDate]);
    if (existing.rows.length > 0) continue;

    let targetRoleIds = null;
    if (evt.targetRole) {
      const roleRes = await query('SELECT id FROM roles WHERE code = $1', [evt.targetRole]);
      if (roleRes.rows.length > 0) {
        targetRoleIds = [roleRes.rows[0].id];
      }
    }

    await query(
      `INSERT INTO calendar_events (hospital_id, title, description, event_date, is_recurring, recurrence_rule, target_role_ids, reminder_days_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 3)`,
      [hospitalId, evt.title, evt.description, eventDate, evt.recurring ? 1 : 0, evt.recurring ? 'yearly' : null, targetRoleIds ? JSON.stringify(targetRoleIds) : null]
    );
    console.log(`[Seed] Calendar event created: ${evt.title}`);
  }
}

async function run() {
  console.log('========================================');
  console.log('  Database Seed - Hospital Platform');
  console.log('========================================\n');

  try {
    const hospitalId = await seedHospital();
    await seedRoles(hospitalId);
    await seedAdminUser(hospitalId);
    await seedAccreditationData();
    await seedDefaultCommittees(hospitalId);
    await seedDefaultCalendarEvents(hospitalId);

    console.log('\n[Seed] ✅ All data seeded successfully!');
    console.log('\n⚠️  Default admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123456');
    console.log('   → Change password after first login!\n');
  } catch (err) {
    console.error('\n[Seed] ❌ Seeding failed:', err);
    process.exit(1);
  }
  process.exit(0);
}

run();
