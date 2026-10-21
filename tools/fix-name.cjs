const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const r = db.prepare("UPDATE ward_staff SET first_name = ? WHERE first_name = ? AND last_name = ?")
  .run('خاتم', 'خانم', 'احمدی');
console.log('local updated rows:', r.changes);
const row = db.prepare("SELECT first_name, last_name, ward FROM ward_staff WHERE last_name = ?").all('احمدی');
console.log(JSON.stringify(row));
