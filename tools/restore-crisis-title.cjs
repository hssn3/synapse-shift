const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const title = 'برنامه درمانی ماهانه بخش اورژانس بحران';
const row = db.prepare("SELECT payload FROM shift_code_meta WHERE code_type = 'crisis'").get();
const meta = JSON.parse((row && row.payload) || '{}');
meta.title = title;
db.prepare("UPDATE shift_code_meta SET payload = ?, updated_at = datetime('now') WHERE code_type = 'crisis'").run(JSON.stringify(meta));
console.log('local crisis title:', JSON.parse(db.prepare("SELECT payload FROM shift_code_meta WHERE code_type='crisis'").get().payload).title);
