const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const newTitle = 'برنامه کد بحران اورژانس';
const row = db.prepare("SELECT payload FROM shift_code_meta WHERE code_type = 'crisis'").get();
if (!row) { console.log('no crisis meta'); process.exit(0); }
const meta = JSON.parse(row.payload || '{}');
meta.title = newTitle;
db.prepare("UPDATE shift_code_meta SET payload = ?, updated_at = datetime('now') WHERE code_type = 'crisis'").run(JSON.stringify(meta));
console.log('crisis title set to:', JSON.parse(db.prepare("SELECT payload FROM shift_code_meta WHERE code_type='crisis'").get().payload).title);
