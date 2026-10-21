/**
 * Migration: افزودن نقش مسئول به سنجه‌های اعتباربخشی
 * هر سنجه بر اساس محور و کلیدواژه‌های متن رسمی کتاب، به یک نقش سازمانی نسبت داده می‌شود.
 * Run: npm run migrate-roles
 */
const { db } = require('../src/config/database-sqlite');

// نگاشت اولیه با کدهای نقشی نوشته شده بود که هیچ‌کدام در جدول واقعیِ roles وجود
// نداشتند (مثلاً quality_manager/env_health/tech_officer/pharmacist/...) — یعنی
// ستون «مسئول» برای ۸۰٪ سنجه‌ها (۴۱۷ از ۵۲۰) به سمتی اشاره می‌کرد که هیچ کاربر
// واقعی نمی‌توانست آن را داشته باشد. اینجا هر کد به نزدیک‌ترین نقشِ واقعاً
// موجود در roles نگاشت شده (بر اساس دامنه‌ی محورهای همان نقش در role-axes.js)؛
// جایی که نقش تخصصی معادلی در جدول نیست (آزمایشگاه/رادیولوژی/انتقال‌خون/مدارک
// پزشکی/بلایا)، به مدیر کنترل کیفیت نسبت داده شده — همان نقشی که دید کامل
// روی درخت اعتباربخشی دارد و عملاً مالک این محورهاست تا نقش اختصاصی ساخته شود.
const AXIS_ROLE = {
  'الف-1':'quality_control_manager','الف-2':'quality_control_manager','الف-3':'hr_manager','الف-4':'nursing_director',
  'الف-5':'quality_control_manager','الف-6':'environmental_health_officer','الف-7':'technical_officer','ب-1':'clinical_supervisor',
  'ب-2':'clinical_supervisor','ب-3':'clinical_supervisor','ب-4':'breastfeeding_specialist','ب-5':'infection_control_supervisor',
  'ب-6':'technical_officer','ب-7':'quality_control_manager','ب-8':'quality_control_manager','ب-9':'quality_control_manager',
  'ب-10':'clinical_supervisor','ج-1':'nursing_director','ج-2':'quality_control_manager',
};

const KW_ROLE = [
  ['مدیر پرستاری','nursing_director'],['مترون','nursing_director'],
  ['سوپروایزر آموزشی','education_supervisor'],['سوپروایزر بالینی','clinical_supervisor'],
  ['کنترل عفونت','infection_control_supervisor'],['سرپرستار','nursing_director'],
  ['بهبود کیفیت','quality_control_manager'],['ایمنی بیمار','quality_control_manager'],
  ['مسئول فنی','technical_officer'],['داروساز','technical_officer'],['داروخانه','technical_officer'],
  ['بهداشت محیط','environmental_health_officer'],['تجهیزات پزشکی','technical_officer'],['مددکار','nursing_director'],
  ['آزمایشگاه','quality_control_manager'],['رادیولوژی','quality_control_manager'],['انتقال خون','quality_control_manager'],
  ['شیر مادر','breastfeeding_specialist'],['مدارک پزشکی','quality_control_manager'],
  ['رئیس بیمارستان','hospital_president'],['مدیر بیمارستان','hospital_president'],
];

function runMigration() {
  console.log('[Migration Roles] Starting...');
  try {
    const cols = db.prepare('PRAGMA table_info(accreditation_sections)').all();
    if (!cols.some(c => c.name === 'responsible_role')) {
      db.exec('ALTER TABLE accreditation_sections ADD COLUMN responsible_role TEXT');
      console.log('[Migration Roles] Column responsible_role added');
    } else {
      console.log('[Migration Roles] Column already exists');
    }

    // ساخت نقشه‌ی کد سنجه -> کد محور (والدِ والد)
    const rows = db.prepare("SELECT id, code, parent_id, level_type, statement, detail_text FROM accreditation_sections").all();
    const byId = {}; rows.forEach(r => byId[r.id] = r);

    function axisCodeOf(row) {
      // بالا رفتن در درخت تا رسیدن به level_type='axis'
      let cur = row, guard = 0;
      while (cur && guard++ < 6) {
        if (cur.level_type === 'axis') return cur.code;
        cur = cur.parent_id ? byId[cur.parent_id] : null;
      }
      // fallback: از خود کد سنجه استنتاج کن (مثل «الف-4-1-3» -> «الف-4»)
      const p = (row.code || '').split('-');
      return p.length >= 2 ? p[0] + '-' + p[1] : null;
    }

    const upd = db.prepare('UPDATE accreditation_sections SET responsible_role = ? WHERE id = ?');
    const measures = rows.filter(r => r.level_type === 'measure');
    let n = 0;
    const tx = db.transaction(() => {
      for (const m of measures) {
        const text = (m.statement || '') + ' ' + (m.detail_text || '');
        let role = null;
        for (const [kw, r] of KW_ROLE) { if (text.includes(kw)) { role = r; break; } }
        if (!role) role = AXIS_ROLE[axisCodeOf(m)] || 'quality_control_manager';
        upd.run(role, m.id);
        n++;
      }
    });
    tx();

    console.log(`[Migration Roles] ✅ ${n} measures assigned a responsible role`);
  } catch (err) {
    console.error('[Migration Roles] ❌ Failed:', err);
    throw err;
  }
}

/* پیش از این، این فایل موقع require شدن خودش را اجرا می‌کرد و بعد
   process.exit(0) می‌زد — یعنی از داخل boot قابل صدا زدن نبود (سرور را
   می‌کشت) و عملاً فقط با `npm run migrate-roles` اجرا می‌شد. آن اسکریپت در
   دستور استارت production نیست، پس روی نصب‌های تازه ستون responsible_role
   اصلاً ساخته نمی‌شد و «مسئول هر سنجه» همه‌جا «—» می‌ماند. */
module.exports = { runMigration };

if (require.main === module) {
  runMigration();
  process.exit(0);
}
