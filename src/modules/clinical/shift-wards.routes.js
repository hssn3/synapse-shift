/**
 * بخش‌های شیفت — دو مسیرِ فقط‌خواندنی که صفحه‌ی «پرسنل و برنامه‌ی ماهانه‌ی شیفت»
 * برای فهرست کردن بخش‌ها لازم دارد:
 *   - /nursing/head/my-wards : بخش‌هایی که کاربر سرپرستار/جانشین آن‌هاست
 *   - /nursing/hierarchy     : فهرست کامل بخش‌های بیمارستان (برای نقش‌های نظارتی)
 * استخراج‌شده از ماژول‌های بزرگ‌تر nursing-hierarchy/head-nurse — فقط همان دو کوئری.
 */
const express = require('express');
const router = express.Router();
const {
  query, db, bcrypt, config, uuid, authRequired, hospitalScope,
  headNurseWardsOf, nrsCanView, nrsCanManage,
} = require('../common');

router.get('/nursing/head/my-wards', authRequired, hospitalScope, (req, res) => {
  try {
    res.json({ wards: headNurseWardsOf(req.hospitalId, req.user.id) });
  } catch (err) { console.error('[ShiftWards]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.get('/nursing/hierarchy', authRequired, hospitalScope, (req, res) => {
  if (!nrsCanView(req)) return res.status(403).json({ error: 'دسترسی ندارید' });
  try {
    const wards = query(
      `SELECT w.id, w.title, w.icon, w.sort_order,
              w.head_nurse_id, hn.full_name as head_nurse_name,
              w.deputy1_id, d1.full_name as deputy1_name,
              w.deputy2_id, d2.full_name as deputy2_name
       FROM nursing_wards w
       LEFT JOIN users hn ON hn.id = w.head_nurse_id
       LEFT JOIN users d1 ON d1.id = w.deputy1_id
       LEFT JOIN users d2 ON d2.id = w.deputy2_id
       WHERE w.hospital_id = ? ORDER BY w.sort_order, w.created_at`, [req.hospitalId]).rows;
    res.json({ wards, can_manage: nrsCanManage(req) });
  } catch (err) { console.error('[ShiftWards]', err); res.status(500).json({ error: 'خطای سرور' }); }
});


// ---- تعریف بخش جدید (فقط مدیر پرستاری) ----
// سرپرستارِ بخش در همان تراکنش ساخته می‌شود تا بخشِ بدون‌کاربر (و در نتیجه
// ورودیِ بی‌صاحب در صفحهٔ ورود) هرگز ساخته نشود.
router.post('/nursing/wards', authRequired, hospitalScope, async (req, res) => {
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'فقط مدیر پرستاری می‌تواند بخش تعریف کند' });
  const title = String((req.body && req.body.title) || '').trim().slice(0, 60);
  const password = String((req.body && req.body.password) || '');
  const headName = String((req.body && req.body.head_name) || '').trim().slice(0, 80) || ('سرپرستار بخش ' + title);
  const bedCount = Number.isFinite(+(req.body && req.body.bed_count)) && +(req.body && req.body.bed_count) >= 0
    ? Math.round(+(req.body && req.body.bed_count)) : 0;
  if (!title) return res.status(400).json({ error: 'نام بخش الزامی است' });
  if (password.length < 4) return res.status(400).json({ error: 'رمز ورود بخش باید حداقل ۴ نویسه باشد' });
  try {
    const dup = query('SELECT id FROM nursing_wards WHERE hospital_id = ? AND title = ?', [req.hospitalId, title]).rows[0];
    if (dup) return res.status(409).json({ error: 'بخشی با همین نام قبلاً ثبت شده است' });
    const headRole = query("SELECT id FROM roles WHERE code = 'head_nurse'").rows[0];
    if (!headRole) return res.status(500).json({ error: 'نقش سرپرستار پیدا نشد' });
    const headId = uuid();
    const wardId = uuid();
    const username = 'ward_' + headId.replace(/-/g, '').slice(0, 12);
    const hash = await bcrypt.hash(password, config.bcrypt.rounds);
    const maxOrder = query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM nursing_wards WHERE hospital_id = ?',
      [req.hospitalId]).rows[0].m;
    const tx = db.transaction(() => {
      query(`INSERT INTO users (id, hospital_id, full_name, username, password_hash, role_id, supervisor_id, is_active, gender, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,1,NULL,datetime('now'),datetime('now'))`,
        [headId, req.hospitalId, headName, username, hash, headRole.id, req.user.id]);
      query(`INSERT INTO nursing_wards (id, hospital_id, title, icon, head_nurse_id, deputy1_id, deputy2_id, sort_order, bed_count, created_at, updated_at)
             VALUES (?,?,?,?,?,NULL,NULL,?,?,datetime('now'),datetime('now'))`,
        [wardId, req.hospitalId, title, (req.body && req.body.icon ? String(req.body.icon).slice(0, 8) : '🏥'),
          headId, maxOrder + 1, bedCount]);
    });
    tx();
    res.status(201).json({ status: 'created', id: wardId, head_user_id: headId });
  } catch (err) {
    console.error('[ShiftWards] create error:', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ---- تغییر رمز ورود سرپرستارِ یک بخش (فقط مدیر پرستاری) ----
router.put('/nursing/wards/:id/password', authRequired, hospitalScope, async (req, res) => {
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'دسترسی ندارید' });
  try {
    const w = query('SELECT id, head_nurse_id FROM nursing_wards WHERE id = ? AND hospital_id = ?',
      [req.params.id, req.hospitalId]).rows[0];
    if (!w) return res.status(404).json({ error: 'بخش یافت نشد' });
    if (!w.head_nurse_id) return res.status(400).json({ error: 'برای این بخش سرپرستار تعریف نشده است' });
    const password = String((req.body && req.body.password) || '');
    if (password.length < 4) return res.status(400).json({ error: 'رمز جدید باید حداقل ۴ نویسه باشد' });
    const hash = await bcrypt.hash(password, config.bcrypt.rounds);
    query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ? AND hospital_id = ?",
      [hash, w.head_nurse_id, req.hospitalId]);
    res.json({ status: 'updated' });
  } catch (err) {
    console.error('[ShiftWards] password error:', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
