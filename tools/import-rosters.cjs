const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const sql = fs.readFileSync('cloudflare/seed-code-rosters.sql', 'utf8');
db.exec(sql);
const rows = db.prepare("SELECT code_type, COUNT(*) c FROM shift_code_entries GROUP BY code_type").all();
console.log('rows by code:', JSON.stringify(rows));
const sample = db.prepare("SELECT day, shift, role_no, person_name FROM shift_code_entries WHERE code_type='99' AND day=1 ORDER BY shift, role_no").all();
console.log('code99 day1:', sample.map(r => r.shift + r.role_no + '=' + r.person_name).join(' | '));
