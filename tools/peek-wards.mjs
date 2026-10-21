const base = 'http://127.0.0.1:8787';
const login = await fetch(base + '/api/entry/role-login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: '4ee9de45-dca3-4c1d-921a-e1c631c2967c', password: '0000' }),
});
const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
const res = await fetch(base + '/api/nursing/hierarchy', { headers: { cookie } });
const data = await res.json();
console.log('status', res.status);
const wards = data.wards || data.levels || [];
console.log('count', wards.length);
console.log(JSON.stringify(wards.slice(0, 3), null, 1).slice(0, 800));
console.log('titles:', wards.map(w => w.title).join(' | '));
