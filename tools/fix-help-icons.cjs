const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const wards = db.prepare("SELECT title, icon FROM nursing_wards WHERE title LIKE 'کمک %'").all();
console.log('before:', JSON.stringify(wards));
const r = db.prepare("UPDATE nursing_wards SET icon = ? WHERE title LIKE 'کمک %'").run('🤝');
console.log('updated:', r.changes);
console.log('after:', JSON.stringify(db.prepare("SELECT title, icon FROM nursing_wards WHERE title LIKE 'کمک %'").all()));
