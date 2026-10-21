const D = require('better-sqlite3');
const db = new D('database/hospital.db', { readonly: true });
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shift_code_entries'").get();
console.log('table:', t ? t.name : 'MISSING');
if (t) console.log('rows:', db.prepare('SELECT COUNT(*) c FROM shift_code_entries').get().c);
const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_code_entry_uniq'").get();
console.log('index:', idx ? idx.name : 'MISSING');
