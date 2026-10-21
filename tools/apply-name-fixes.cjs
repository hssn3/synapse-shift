const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('database/hospital.db');
const sql = fs.readFileSync('cloudflare/fix-personnel-names.sql', 'utf8');
db.exec(sql);
const c = db.prepare('SELECT COUNT(*) c FROM ward_staff WHERE is_active = 1').get();
console.log('active staff:', c.c);
const check = db.prepare("SELECT first_name, last_name, ward FROM ward_staff WHERE last_name IN ('طاهری','بیگدلی','فولادوند','خزایی') ORDER BY ward").all();
console.log(JSON.stringify(check));
