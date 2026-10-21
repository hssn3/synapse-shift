const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database('database/hospital.db', { readonly: true });
const img = JSON.parse(fs.readFileSync('data/personnel-from-images.json', 'utf8'));

const norm = s => String(s || '')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/ك/g, 'ک').replace(/ي/g, 'ی')
  .replace(/\s+/g, ' ')
  .trim();

const staff = db.prepare('SELECT ward, first_name, last_name, position FROM ward_staff WHERE is_active = 1').all();
const byWard = new Map();
for (const s of staff) {
  const key = norm(s.ward);
  if (!byWard.has(key)) byWard.set(key, []);
  byWard.get(key).push(s);
}

let totalImg = 0, missing = 0, extra = 0, posDiff = 0;
const report = [];

for (const [ward, people] of Object.entries(img)) {
  if (ward.startsWith('_') || ward.includes('تکراری')) continue;
  const dbList = byWard.get(norm(ward)) || [];
  const dbNames = new Map(dbList.map(s => [norm(s.first_name + ' ' + s.last_name), s]));
  const imgNames = new Set(people.map(p => norm(p.name)));
  totalImg += people.length;

  const miss = people.filter(p => !dbNames.has(norm(p.name)));
  const ext = dbList.filter(s => !imgNames.has(norm(s.first_name + ' ' + s.last_name)));
  const pos = people.filter(p => dbNames.has(norm(p.name)) && norm(dbNames.get(norm(p.name)).position) !== norm(p.position));

  missing += miss.length; extra += ext.length; posDiff += pos.length;
  report.push({ ward, img: people.length, db: dbList.length, missing: miss.map(p => p.name), extra: ext.map(s => s.first_name + ' ' + s.last_name), posDiff: pos.map(p => p.name + ' (' + (dbNames.get(norm(p.name)) || {}).position + ' → ' + p.position + ')') });
}

console.log(JSON.stringify({ totalImg, missing, extra, posDiff }, null, 1));
for (const r of report) {
  console.log('\n== ' + r.ward + '  (تصویر ' + r.img + ' / دیتابیس ' + r.db + ')');
  if (r.missing.length) console.log('  کم در دیتابیس:', r.missing.join('، '));
  if (r.extra.length) console.log('  اضافه در دیتابیس:', r.extra.join('، '));
  if (r.posDiff.length) console.log('  سمت متفاوت:', r.posDiff.join('، '));
}
fs.writeFileSync('build/personnel-diff.json', JSON.stringify(report, null, 1), 'utf8');
