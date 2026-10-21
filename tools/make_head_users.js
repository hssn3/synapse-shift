const bcrypt = require('bcryptjs');

const HOSPITAL = 'dd43b5de-bd17-4245-8dbf-246de3db401d';
const ROLE_HEAD = '6366aed1-278d-4fd3-b8b9-57e078197f0e';

const heads = [
  { n: 1, ward: 'ICU 1', name: 'علیرضا ترقی', user: 'head_icu1' },
  { n: 2, ward: 'ICU 2', name: 'زهرا میلادی', user: 'head_icu2' },
  { n: 3, ward: 'اتاق عمل', name: 'معصومه خیاز', user: 'head_or' },
  { n: 4, ward: 'جراحی', name: 'فرخ طاهری', user: 'head_surgery' },
  { n: 5, ward: 'کلینیک', name: 'سمیرا میرزایی', user: 'head_clinic' },
  { n: 6, ward: 'آندوسکوپی', name: 'مرجان بادان فیروز', user: 'head_endo' },
  { n: 7, ward: 'CSSD', name: 'حسن ایرانی', user: 'head_cssd' },
  { n: 8, ward: 'انبار', name: 'عباس متصدری', user: 'head_anbar' },
];

(async () => {
  const lines = [];
  for (const h of heads) {
    const id = `f0000000-0000-4000-8000-0000000000${h.n.toString().padStart(2, '0')}`;
    const hash = await bcrypt.hash('0000', 8);
    lines.push(`INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('${id}', '${HOSPITAL}', '${h.name}', '${h.user}', '${hash}', '${ROLE_HEAD}', 1, 'زن');`);
    lines.push(`UPDATE nursing_wards SET head_nurse_id = '${id}' WHERE title = '${h.ward}';`);
  }
  require('fs').writeFileSync('cloudflare/migration-head-users.sql', lines.join('\n') + '\n', 'utf8');
  console.log('written', lines.length, 'statements');
})();
