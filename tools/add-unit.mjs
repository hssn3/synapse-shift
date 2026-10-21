/* افزودن واحد «دفتر پرستاری» + اصلاح یک نام، روی محیط محلی و تولید */
const LOCAL = 'http://127.0.0.1:3000';
const PROD = 'https://synapse-shift.hcode016.workers.dev';
const USER = '4ee9de45-dca3-4c1d-921a-e1c631c2967c';

async function login(base) {
  const res = await fetch(base + '/api/entry/role-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: USER, password: '0000' }),
  });
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function ensureUnit(base) {
  const cookie = await login(base);
  const list = await (await fetch(base + '/api/shift/units', { headers: { cookie } })).json();
  const has = (list.units || []).some(u => u.title === 'دفتر پرستاری');
  if (has) return 'already: ' + base;
  const res = await fetch(base + '/api/shift/units', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'دفتر پرستاری', kind: 'پشتیبانی' }),
  });
  return (res.ok ? 'added: ' : 'failed(' + res.status + '): ') + base;
}

console.log(await ensureUnit(LOCAL));
console.log(await ensureUnit(PROD));
