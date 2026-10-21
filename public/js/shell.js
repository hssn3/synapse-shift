/* =====================================================================
   پوسته‌ی سبک — فقط برای «پرسنل و برنامه‌ی ماهانه‌ی شیفت»
   ---------------------------------------------------------------------
   چیزی که این فایل می‌دهد:
     • ورود کاشی‌ای (انتخاب مرکز → انتخاب سمت) با همان APIهای قبلی
     • متغیرها/هلپرهایی که shift-schedule.js انتظار دارد:
       $ , S , API , toast , BTN , fa , todayJalali , toGregorian , esc
     • هد/فوتر ساده‌ی برنامه و خروج از حساب
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------- پایه ---------------- */
  const $ = id => document.getElementById(id);
  global.$ = $;

  const S = { user: null };
  global.S = S;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  global.esc = esc;

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function fa(n) { return String(n).replace(/\d/g, d => FA_DIGITS[+d]); }
  global.fa = fa;

  /* ---------------- تقویم شمسی (همان الگوریتم پروژه‌ی اصلی) ---------------- */
  const JDIV = (a, b) => Math.floor(a / b);
  function jalCal(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    let gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, leap, n, i;
    for (i = 1; i < breaks.length; i += 1) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += JDIV(jump, 33) * 8 + JDIV(jump % 33, 4); jp = jm; }
    n = jy - jp;
    leapJ += JDIV(n, 33) * 8 + JDIV((n % 33) + 3, 4);
    if ((jump % 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = JDIV(gy, 4) - JDIV((JDIV(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + JDIV(jump + 4, 33) * 33;
    leap = (((n + 1) % 33) - 1) % 4;
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  const UNIX_EPOCH_JDN = 2440588;
  function g2d(gy, gm, gd) { return Math.round(Date.UTC(gy, gm - 1, gd) / 86400000) + UNIX_EPOCH_JDN; }
  function d2g(jdn) {
    const d = new Date((jdn - UNIX_EPOCH_JDN) * 86400000);
    return { gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate() };
  }
  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - JDIV(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f, jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + JDIV(k, 31); jd = (k % 31) + 1; return { jy, jm, jd }; }
      k -= 186;
    } else {
      jy -= 1;
      const rPrev = jalCal(jy);
      k += 179;
      if (rPrev.leap === 0) k += 1;
    }
    jm = 7 + JDIV(k, 30); jd = (k % 30) + 1;
    return { jy, jm, jd };
  }
  const toJalali = (gy, gm, gd) => d2j(g2d(gy, gm, gd));
  const toGregorian = (jy, jm, jd) => d2g(j2d(jy, jm, jd));
  global.toJalali = toJalali;
  global.toGregorian = toGregorian;

  // تهران = UTC+3:30 (ایران از ۱۴۰۱ ساعت تابستانی ندارد)
  const TEHRAN_OFFSET_MS = 3.5 * 3600000;
  const tehranNow = () => new Date(Date.now() + TEHRAN_OFFSET_MS);
  function todayJalali() {
    const t = tehranNow();
    return toJalali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  global.todayJalali = todayJalali;

  /* ---------------- toast / BTN ---------------- */
  function toast(msg, isErr) {
    const el = document.createElement('div');
    el.className = 'sh-toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  }
  global.toast = toast;

  const BTN = {
    alert: (m) => { window.alert(m); return Promise.resolve(); },
    confirm: (m) => Promise.resolve(window.confirm(m)),
    confirmDanger: (m) => Promise.resolve(window.confirm(m)),
    prompt: (m, d) => Promise.resolve(window.prompt(m, d)),
  };
  global.BTN = BTN;

  /* ---------------- API ---------------- */
  async function req(method, path, body) {
    const opt = { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opt.body = JSON.stringify(body);
    const r = await fetch('/api' + path, opt);
    let d = null;
    try { d = await r.json(); } catch (e) { /* پاسخ غیر JSON */ }
    if (!r.ok) throw new Error((d && d.error) || ('خطای ' + r.status));
    return d;
  }

  const API = {
    session: () => req('GET', '/auth/session'),
    logout: () => req('POST', '/auth/logout', {}),
    publicHospitals: () => req('GET', '/public/hospitals'),
    entryRoles: (hospitalId) => req('GET', '/entry/hospital/' + encodeURIComponent(hospitalId) + '/roles'),
    roleLogin: (user_id, password) => req('POST', '/entry/role-login', { user_id, password }),
    changePassword: (b) => req('POST', '/auth/change-password', b),

    hnMyWards: () => req('GET', '/nursing/head/my-wards'),
    nursingHierarchy: () => req('GET', '/nursing/hierarchy'),
    wardAdd: (b) => req('POST', '/nursing/wards', b),
    wardResetPassword: (id, password) => req('PUT', '/nursing/wards/' + encodeURIComponent(id) + '/password', { password }),

    shiftStaffList: (ward, includeInactive) => req('GET', '/shift/staff?ward=' + encodeURIComponent(ward) + (includeInactive ? '&include_inactive=1' : '')),
    shiftStaffAdd: (b) => req('POST', '/shift/staff', b),
    shiftStaffUpdate: (id, b) => req('PUT', '/shift/staff/' + id, b),
    shiftStaffDelete: (id) => req('DELETE', '/shift/staff/' + id),
    shiftSetStaffOrder: (b) => req('PUT', '/shift/staff-order', b),
    shiftFinalize: (b) => req('POST', '/shift/finalize', b),
    shiftSchedule: (ward, year, month) => req('GET', '/shift/schedule?ward=' + encodeURIComponent(ward) + '&year=' + year + '&month=' + month),
    shiftCrisisGet: (ward, year, month) => req('GET', '/shift/crisis?ward=' + encodeURIComponent(ward) + '&year=' + year + '&month=' + month),
    shiftCrisisCell: (b) => req('PUT', '/shift/crisis/cell', b),
    shiftSetNote: (b) => req('PUT', '/shift/schedule/note', b),
    shiftSetCell: (b) => req('PUT', '/shift/schedule/cell', b),
    shiftGetSettings: (ward) => req('GET', '/shift/settings?ward=' + encodeURIComponent(ward)),
    shiftSetSettings: (b) => req('PUT', '/shift/settings', b),
    shiftPositions: () => req('GET', '/shift/positions'),
    shiftSetPositions: (b) => req('PUT', '/shift/positions', b),
    shiftSetCustomRows: (b) => req('PUT', '/shift/schedule/custom-rows', b),
    shiftUnits: () => req('GET', '/shift/units'),
    shiftUnitAdd: (b) => req('POST', '/shift/units', b),
    shiftUnitDelete: (id) => req('DELETE', '/shift/units/' + id),
    shiftRegisterForm: () => req('POST', '/shift/register-form', {}),
    shiftGetPrintConfig: () => req('GET', '/shift/print-config'),
    shiftSetPrintConfig: (b) => req('PUT', '/shift/print-config', b),
  };
  global.API = API;

  /* ---------------- پوسته‌ی برنامه ---------------- */
  const icon = (n, c) => (typeof ic === 'function' ? ic(n, c) : '');
  const isManager = u => !!(u && (u.is_manager || ((u.permissions || []).includes('manage_nursing_hierarchy'))));

  function renderHeader() {
    const u = S.user || {};
    $('ghdr').innerHTML = `
      <div class="sh-hdr">
        <div class="sh-brand">
          ${u.hospital_has_logo
            ? `<img class="sh-hdr-logo" src="/api/hospital/logo" alt="">`
            : `<span class="sh-logo">${icon('calendar', 'lg')}</span>`}
          <div>
            <div class="sh-t">${esc(u.hospital_name || 'بیمارستان')}</div>
            <div class="sh-s">پرسنل و برنامه‌ی ماهانه‌ی شیفت</div>
          </div>
        </div>
        <div class="sh-user">
          <div class="sh-uinfo">
            <div class="sh-un">${esc(u.full_name || '')}</div>
            <div class="sh-ur">${esc(u.role_title || '')}</div>
          </div>
          ${isManager(u) ? `<button class="btn btn-o btn-sm" onclick="shOpenAddWard()">${icon('plus')} افزودن بخش</button>` : ''}
          <button class="btn btn-o btn-sm" onclick="shOpenChangePassword()">${icon('edit')} تغییر رمز</button>
          <button class="btn btn-o btn-sm" onclick="shLogout()">خروج</button>
        </div>
      </div>`;
  }
  global.shLogout = async function () {
    try { await API.logout(); } catch (e) { /* بی‌صدا */ }
    location.href = '/';
  };

  /* ---------------- مودال‌های عمومی (با ×، کلیک بیرون و Esc) ---------------- */
  function shOpenModal({ title, body, submitText = 'تأیید', onSubmit, width = 460 }) {
    const old = document.getElementById('shModal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'sh-modal';
    wrap.id = 'shModal';
    wrap.innerHTML = `<div class="sh-modal-box" style="max-width:${Number(width) || 460}px" role="dialog" aria-modal="true">
      <div class="sh-modal-hd">
        <b>${esc(title)}</b>
        <button type="button" class="sh-modal-x" data-close aria-label="بستن">×</button>
      </div>
      <form class="sh-modal-form">
        <div class="sh-modal-body">${body}<div class="sh-modal-err" role="alert"></div></div>
        <div class="sh-modal-actions">
          <button type="submit" class="btn btn-g btn-sm">${esc(submitText)}</button>
          <button type="button" class="btn btn-o btn-sm" data-close>بستن</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(wrap);
    const close = () => {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', ev => { if (ev.target === wrap) close(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const form = wrap.querySelector('form');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const err = form.querySelector('.sh-modal-err');
      err.textContent = '';
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try { await onSubmit(form, close); }
      catch (ex) { err.textContent = (ex && ex.message) || 'خطا'; }
      finally { if (btn) btn.disabled = false; }
    });
    const first = form.querySelector('input:not([type="hidden"]),select,textarea');
    if (first) setTimeout(() => { try { first.focus(); } catch (e) { /* بی‌صدا */ } }, 40);
    return { wrap, close };
  }
  global.shOpenModal = shOpenModal;

  /* ---------------- ورود ---------------- */
  function loginShell(inner) {
    $('ghdr').innerHTML = '';
    $('ptitle').textContent = '';
    $('content').innerHTML = `<div class="sh-login">${inner}</div>`;
  }

  async function renderHospitals() {
    loginShell('<div class="empty">در حال بارگذاری…</div>');
    let hospitals = [];
    try { hospitals = (await API.publicHospitals()).hospitals || []; } catch (e) { /* بی‌صدا */ }
    if (!hospitals.length) return loginShell('<div class="panel g"><div class="empty">هیچ بیمارستان فعالی ثبت نشده است.</div></div>');
    const urlId = new URL(location.href).searchParams.get('hospital');
    const wanted = hospitals.find(h => h.id === urlId) || hospitals[0];
    if (hospitals.length === 1) return renderHospitalLogin(wanted.id);
    if (urlId) return renderHospitalLogin(wanted.id);
    loginShell(`
      <div class="panel g login-card">
        <div class="login-section">
          <div class="login-sec-title">انتخاب بیمارستان</div>
          <div class="login-wards">
            ${hospitals.map(h => `<button class="login-tile ward" onclick="shPickHospital('${esc(h.id)}')">
              <span class="login-tile-ico">${icon('tree')}</span>
              <span class="login-tile-txt"><b>${esc(h.name)}</b><small>ورود</small></span>
              <span class="login-tile-go">ورود</span>
            </button>`).join('')}
          </div>
        </div>
      </div>`);
  }
  global.shPickHospital = function (id) {
    localStorage.setItem('p_last_hospital', id);
    const url = new URL(location.href);
    url.searchParams.set('hospital', id);
    history.replaceState(null, '', url.toString());
    renderHospitalLogin(id);
  };

  async function renderHospitalLogin(hospitalId) {
    loginShell('<div class="empty">در حال بارگذاری…</div>');
    let data = null;
    try { data = await API.entryRoles(hospitalId); }
    catch (e) { return loginShell('<div class="panel g"><div class="empty">' + esc(e.message) + '</div></div>'); }
    localStorage.setItem('p_last_hospital', hospitalId);
    const url = new URL(location.href);
    url.searchParams.set('hospital', hospitalId);
    history.replaceState(null, '', url.toString());
    const h = data.hospital || {};
    const manager = data.manager;
    const wards = data.wards || [];
    const logo = h.has_logo
      ? `<img class="login-logo" src="/api/public/hospital/${encodeURIComponent(hospitalId)}/logo" alt="لوگوی ${esc(h.name || '')}">`
      : `<div class="login-logo-fallback">${icon('calendar', 'lg')}</div>`;
    loginShell(`
      <div class="panel g login-card">
        <div class="login-brand">
          ${logo}
          <div>
            <h1>${esc(h.name || 'بیمارستان')}</h1>
            <div class="sub">سامانه‌ی پرسنل و برنامه‌ی ماهانه‌ی شیفت</div>
          </div>
        </div>
        <div class="login-section">
          <div class="login-sec-title">مدیر پرستاری</div>
          ${manager ? `<button class="login-tile manager" data-kind="manager" data-user="${esc(manager.user_id)}"
              data-title="مدیر پرستاری — ${esc(manager.full_name || '')}" onclick="shAskPasswordFrom(this)">
            <span class="login-tile-ico">${icon('user')}</span>
            <span class="login-tile-txt"><b>${esc(manager.role_title || 'مدیر پرستاری')}</b><small>${esc(manager.full_name || '')}</small></span>
            <span class="login-tile-go">ورود</span>
          </button>` : '<div class="empty">مدیر پرستاری برای این بیمارستان تعریف نشده است.</div>'}
        </div>
        <div class="login-section">
          <div class="login-sec-title">بخش‌ها</div>
          ${wards.length ? `<div class="login-wards">
            ${wards.map(w => `<button class="login-tile ward" data-kind="ward" data-user="${esc(w.user_id)}"
                data-title="سرپرستار بخش ${esc(w.title)}" onclick="shAskPasswordFrom(this)">
              <span class="login-tile-ico">${icon('tree')}</span>
              <span class="login-tile-txt"><b>سرپرستار بخش ${esc(w.title)}</b><small>${esc(w.head_name || '')}</small></span>
              <span class="login-tile-go">ورود</span>
            </button>`).join('')}
          </div>` : '<div class="empty">هنوز بخشی تعریف نشده است. مدیر پرستاری پس از ورود می‌تواند بخش اضافه کند.</div>'}
        </div>
        <div class="login-note">${icon('info')} رمز عبور را از مدیر پرستاری یا سرپرستار بخش دریافت کنید.</div>
      </div>`);
  }

  global.shAskPasswordFrom = function (el) {
    if (!el) return;
    shAskPassword(el.dataset.kind, el.dataset.user, el.dataset.title);
  };
  global.shAskPassword = function (kind, userId, title) {
    shOpenModal({
      title: title || (kind === 'manager' ? 'ورود مدیر پرستاری' : 'ورود سرپرستار'),
      submitText: 'ورود',
      width: 430,
      body: `<div class="fg"><label for="shLoginPass">رمز عبور</label>
        <input id="shLoginPass" type="password" autocomplete="current-password" required placeholder="رمز عبور را وارد کنید"></div>
        <div class="sub">${kind === 'manager' ? 'رمز مدیر پرستاری را وارد کنید.' : 'رمز ورود این بخش را وارد کنید.'}</div>`,
      onSubmit: async (form, close) => {
        const password = form.querySelector('#shLoginPass').value;
        if (!password) throw new Error('رمز عبور الزامی است');
        await API.roleLogin(userId, password);
        close();
        location.hash = '#staffshift';
        location.reload();
      }
    });
  };

  /* ---------------- تغییر رمز / افزودن بخش ---------------- */
  global.shOpenChangePassword = function () {
    shOpenModal({
      title: 'تغییر رمز عبور',
      submitText: 'ذخیره‌ی رمز جدید',
      width: 440,
      body: `
        <div class="fg"><label for="shCurPass">رمز فعلی</label><input id="shCurPass" type="password" autocomplete="current-password" required></div>
        <div class="fg"><label for="shNewPass">رمز جدید</label><input id="shNewPass" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="fg"><label for="shNewPass2">تکرار رمز جدید</label><input id="shNewPass2" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="sub">رمز جدید حداقل ۴ نویسه باشد.</div>`,
      onSubmit: async (form, close) => {
        const cur = form.querySelector('#shCurPass').value;
        const p1 = form.querySelector('#shNewPass').value;
        const p2 = form.querySelector('#shNewPass2').value;
        if (p1.length < 4) throw new Error('رمز جدید باید حداقل ۴ نویسه باشد');
        if (p1 !== p2) throw new Error('تکرار رمز جدید مطابقت ندارد');
        await API.changePassword({ current_password: cur, new_password: p1, confirm_password: p2 });
        close();
        toast('رمز عبور تغییر کرد');
      }
    });
  };

  global.shOpenAddWard = function () {
    if (!isManager(S.user)) return toast('فقط مدیر پرستاری می‌تواند بخش تعریف کند', true);
    shOpenModal({
      title: 'افزودن بخش جدید',
      submitText: 'ایجاد بخش',
      width: 500,
      body: `
        <div class="fg"><label for="shWardTitle">نام بخش</label><input id="shWardTitle" maxlength="60" required placeholder="مثلاً اورژانس"></div>
        <div class="fg"><label for="shWardHead">نام سرپرستار (اختیاری)</label><input id="shWardHead" maxlength="80" placeholder="نام و نام خانوادگی سرپرستار"></div>
        <div class="fg"><label for="shWardBeds">تعداد تخت</label><input id="shWardBeds" type="number" min="0" max="999" value="4"></div>
        <div class="fg"><label for="shWardPass">رمز ورود بخش</label><input id="shWardPass" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="fg"><label for="shWardPass2">تکرار رمز ورود</label><input id="shWardPass2" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="sub">پس از ساخت بخش، سرپرستار با همین رمز وارد می‌شود و می‌تواند پرسنل و شیفت‌ها را تعریف کند.</div>`,
      onSubmit: async (form, close) => {
        const title = form.querySelector('#shWardTitle').value.trim();
        const head = form.querySelector('#shWardHead').value.trim();
        const beds = form.querySelector('#shWardBeds').value;
        const p1 = form.querySelector('#shWardPass').value;
        const p2 = form.querySelector('#shWardPass2').value;
        if (!title) throw new Error('نام بخش الزامی است');
        if (p1.length < 4) throw new Error('رمز ورود بخش باید حداقل ۴ نویسه باشد');
        if (p1 !== p2) throw new Error('تکرار رمز مطابقت ندارد');
        await API.wardAdd({ title, head_name: head, bed_count: beds, password: p1 });
        close();
        toast('بخش «' + title + '» اضافه شد');
        if (typeof renderShiftSchedule === 'function') await renderShiftSchedule();
      }
    });
  };

  /* ---------------- بوت ---------------- */
  async function boot() {
    let s;
    try { s = await API.session(); } catch (e) { s = { authenticated: false }; }
    if (!s.authenticated) { renderHospitals(); return; }

    S.user = s.user;
    renderHeader();
    try {
      await renderShiftSchedule();
    } catch (e) {
      $('content').innerHTML = '<div class="panel g"><div class="empty">' + esc(e.message) + '</div></div>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})(window);
