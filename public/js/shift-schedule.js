/* =====================================================================
   پرسنل بخش و برنامه‌ی ماهانه‌ی شیفت
   ---------------------------------------------------------------------
   منبع: فایل اکسلی که کارفرما خودش برای شیفت‌بندی می‌ساخت. منطق محاسبه
   پرسنل، گرید ماهانه، اضافه‌کار و چاپ A4 افقی.
      </div>
   فرمول‌های همان فایل کپی شده — توضیح کامل در src/routes/api.js بخش
   «پرسنل بخش و برنامه‌ی ماهانه‌ی شیفت».

   سه تب: «پرسنل» (افزودن/ویرایش کارمند)، «برنامه‌ی شیفت» (گرید ماهانه با
   تنظیمِ ساعتِ هر شیفت و تعطیلات دستی)، و چاپِ یک‌صفحه‌ای A4 افقی با آرم و
   امضاها — قالبِ چاپ (کد فرم، یادآوری‌ها، برچسبِ امضاها، تماس‌ها) از تب
   «تنظیمات بیمارستان» (سطح hospital، manage_hospital_settings) قابل‌تغییر
   است، هرجا کاربر بخواهد صدایش بزند؛ این‌جا هم یک میان‌بر برایش گذاشته شده
   تا لازم نباشد صفحه عوض شود.

   دسترسی از همان مدل سرپرستار/جانشین بخش استفاده می‌کند — چیزی که
   super-devchat.js/super-docs.js هم برایش کردند: فایل جدا تا app.js
   بیشتر باد نکند.
   ===================================================================== */
(function (global) {
  'use strict';
  // `'` هم به نگاشت اضافه شد (&#39;) — مثل بقیه‌ی اسکیپرهای پروژه، خروجی باید هم برای متن و
  // هم برای اتریبیوت کامل باشد. اما توجه: همین خروجی در onclick="ssSelectWard('…')" (خط ۱۳۱)
  // رشته‌ی تک‌کوتیشنیِ JS را نجات نمی‌دهد؛ HTML واکشیِ «&#39;» را پیش از کامپایلِ رشته به «'»
  // برمی‌گرداند و آپاستروفِ عنوان همچنان رشته را می‌شکند (شاهد عملی: scratch/xss-probe2.cjs،
  // خطای «missing ) after argument list» روی کلیک). رفع ریشه‌ای باید در محلِ استفاده باشد:
  // پاس‌دادن شناسه/ایندکس یا خواندن از data-attribute، به‌جای درج عنوان داخل رشته‌ی onclick.
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n, c) => (typeof ic === 'function' ? ic(n, c) : '');
  const F = n => (typeof fa === 'function' ? fa(n) : String(n));
  const JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const WEEKDAY_SHORT = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
  // تعطیلات رسمیِ نیمهٔ دوم سال ۱۴۰۵ — از تقویم مرکز تقویم دانشگاه تهران و time.ir.
  // این‌ها خودکار رنگ می‌گیرند و در چاپ هم تعطیل حساب می‌شوند؛ جمعه‌ها جداگانه
  // در همان لحظه محاسبه می‌شوند تا با تغییر سال/ماه نیازی به دادهٔ تازه نباشد.
  // تعطیلات رسمی ۱۴۰۵ — راستی‌آزمایی‌شده با تقویم رسمی (bahesab.ir/time و time.ir)
  // در ۱۴۰۵/۰۷/۲۸: آبان فقط ۲۲ (که جمعه است)، آذر هیچ، دی ۲ و ۱۶، بهمن ۴ و ۲۲،
  // اسفند ۹، ۱۹، ۲۰ و ۲۹. جمعه‌ها خودکار در ssMonthHolidayMap اضافه می‌شوند.
  const SS_OFFICIAL_HOLIDAYS = {
    1405: {
      8: { 22: 'شهادت حضرت فاطمه زهرا (س)' },
      10: { 2: 'ولادت امام علی (ع)', 16: 'مبعث رسول اکرم (ص)' },
      11: { 4: 'ولادت حضرت قائم (عج)', 22: 'پیروزی انقلاب اسلامی' },
      12: {
        9: 'شهادت امام علی (ع)', 19: 'عید سعید فطر', 20: 'تعطیل عید فطر',
        29: 'روز ملی شدن صنعت نفت',
      },
    },
  };
  const SS_MONTH_TABS = [8, 9, 10, 11, 12];
  // ردیف‌های شمارشِ نفرات — دقیقاً مثل ردیف‌های ۳۰/۳۱/۳۲ اکسل کارفرما که برای
  // هر شیفت یک ردیفِ جدا داشت، نه یک ردیفِ درهمِ «M/E/N». مرخصی هم اضافه شد
  // چون سرپرستار موقع چیدن برنامه لازم دارد بداند آن روز چند نفر مرخصی‌اند.
  const SHIFT_COUNT_ROWS = [
    { k: 'M', label: 'تعداد نفراتِ شیفت صبح (M)' },
    { k: 'E', label: 'تعداد نفراتِ شیفت عصر (E)' },
    { k: 'N', label: 'تعداد نفراتِ شیفت شب (N)' },
    { k: 'H', label: 'تعداد نفراتِ مرخصی (H)' },
  ];
  // حروف همیشه لاتین‌اند (خواسته‌ی صریح کارفرما) و ترتیب بر اساس ساعتِ کار است، نه
  // الفبا — سرپرستار موقع چیدن برنامه به «چقدر کار» فکر می‌کند، نه به حرف. ساعتِ
  // کنارِ هر گزینه از تنظیماتِ همان بخش خوانده می‌شود، نه عددِ ثابت، چون
  // shift_ward_settings برای هر بخش جداست.
  const SHIFT_PRESETS = [
    { k: 'M', label: 'M — صبح', hours: s => s.hour_m },
    { k: 'E', label: 'E — عصر', hours: s => s.hour_e },
    { k: 'N', label: 'N — شب', hours: s => s.hour_n },
    { k: 'ME', label: 'ME — لانگ (صبح+عصر)', hours: s => s.hour_m + s.hour_e },
    { k: 'EN', label: 'EN — عصر+شب', hours: s => s.hour_e + s.hour_n },
    { k: 'MN', label: 'MN — صبح+شب', hours: s => s.hour_m + s.hour_n },
    { k: 'MEN', label: 'MEN — ۲۴ ساعته (فول)', hours: s => s.hour_m + s.hour_e + s.hour_n },
    { k: 'H', label: 'H — مرخصی', hours: s => s.hour_h },
  ];

  // گروه‌های برگهٔ فرم: مدیریت/سرپرستی، پرستاران، کمک‌پرستاران. کارفرما خواست
  // «برنامهٔ پرستار و کمک‌پرستار جدا وارد شود»، پس در گرید و برگهٔ چاپی بین
  // گروه‌ها یک سطرِ عنوان می‌نشیند و فیلترِ گروه هم برای ورودِ جداگانه هست.
  // ترتیب مهم است: «سرپرستار» خودش «پرستار» دارد و باید *پیش از* گروه پرستاران
  // بیاید، و «کمک‌پرستار» هم نباید در گروه پرستاران بیفتد.
  const SS_GROUPS = [
    { key: 'senior', label: 'مدیریت و سرپرستی', test: s => /مدیر پرستاری|مترون|سوپروایزر|کنترل عفونت|آموزش|سرپرستار|جانشین/.test(s.position || '') },
    { key: 'nurse', label: 'پرستاران', test: s => /پرستار/.test(s.position || '') && !/کمک|بهیار/.test(s.position || '') },
    { key: 'aid', label: 'کمک‌پرستاران و بهیاران', test: s => /کمک|بهیار/.test(s.position || '') },
    { key: 'other', label: 'سایر', test: () => true },
  ];
  function ssGroupOf(s) {
    for (const g of SS_GROUPS) if (g.test(s)) return g;
    return SS_GROUPS[SS_GROUPS.length - 1];
  }

  const SS = { wards: [], wardTitle: null, wardId: null, wardBedCount: null, tab: 'staff', year: null, month: null,
    staff: [], sched: null, settings: null, canEdit: false, isManager: false,
    positions: [], doctors: [], showDoctors: false,
    showSettings: false, showPrintCfg: false, printCfg: null,
    showCustomRows: false, showUnits: false, canManageUnits: false, units: [], groupFilter: 'all',
    dragStaffId: null, crisis: null };

  function todayJ() {
    if (typeof todayJalali === 'function') return todayJalali();
    return { jy: 1404, jm: 1, jd: 1 };
  }
  function weekdayOf(jy, jm, jd) {
    if (typeof toGregorian !== 'function') return '';
    const g = toGregorian(jy, jm, jd);
    return new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay();
  }
  function ssOfficialHolidayMap(year, month) {
    return (SS_OFFICIAL_HOLIDAYS[year] && SS_OFFICIAL_HOLIDAYS[year][month]) || {};
  }
  function ssMonthHolidayMap() {
    const map = new Map();
    const days = (SS.sched && SS.sched.schedule && SS.sched.schedule.days) || 0;
    if (!days) return map;
    const official = ssOfficialHolidayMap(SS.year, SS.month);
    for (let d = 1; d <= days; d++) {
      if (weekdayOf(SS.year, SS.month, d) === 5) map.set(d, 'جمعه');
      if (official[d]) map.set(d, official[d]);
    }
    for (const d of ((SS.sched.schedule && SS.sched.schedule.holidays) || [])) {
      if (!map.has(d)) map.set(d, 'تعطیل دستی');
    }
    return map;
  }
  const canManageHospitalSettings = () => ((S.user && S.user.permissions) || []).includes('manage_hospital_settings');

  async function loadWards() {
    const wards = new Map();
    try {
      const mine = await API.hnMyWards();
      (mine.wards || []).forEach(w => wards.set(w.title, w));
    } catch (e2) { /* سرپرستار/جانشین هیچ بخشی نیست — طبیعی است */ }
    const perms = (S.user && S.user.permissions) || [];
    if (perms.includes('manage_nursing_hierarchy') || perms.includes('view_nursing_hierarchy')) {
      try {
        const all = await API.nursingHierarchy();
        (all.wards || []).forEach(w => wards.set(w.title, w));
      } catch (e2) { /* دسترسی ندارد — نادیده گرفته می‌شود */ }
    }
    // واحدهای دلخواه (مثل دفتر پرستاری) هم در همان فهرست بخش‌ها می‌آیند تا بتوانند
    // پرسنل و برنامهٔ شیفت داشته باشند؛ مدیر پرستاری برای هر واحد دسترسی دارد.
    try {
      const units = await API.shiftUnits();
      (units.units || []).forEach(u => {
        if (!wards.has(u.title)) wards.set(u.title, { title: u.title, icon: '🗂️', isUnit: true, bed_count: null });
      });
    } catch (e2) { /* بدون دسترسی — نادیده */ }
    return [...wards.values()];
  }

  // سمت‌هایی که مدیر پرستاری تعریف کرده؛ همین لیست در فرم پرسنل به‌صورت
  // انتخاب‌شدنی می‌آید تا هر بار تایپ دستی لازم نباشد.
  async function loadPositions() {
    try { SS.positions = (await API.shiftPositions()).positions || []; }
    catch (e2) { SS.positions = []; }
    if (!Array.isArray(SS.positions) || !SS.positions.length) {
      SS.positions = ['مدیر پرستاری', 'سوپروایزر بالینی', 'سرپرستار', 'پرستار', 'کمک‌پرستار', 'بهیار', 'منشی بخش'];
    }
  }

  global.renderShiftSchedule = async function () {
    $('ptitle').textContent = 'پرسنل و برنامه‌ی شیفت';
    SS.isManager = !!(S.user && (S.user.is_manager ||
      ((S.user.permissions || []).includes('manage_nursing_hierarchy'))));
    $('content').innerHTML = '<div class="panel g"><div class="empty">در حال بارگذاری…</div></div>';
    try {
      SS.wards = await loadWards();
      await loadPositions();
      if (!SS.wards.length) {
        $('content').innerHTML = '<div class="panel g"><div class="empty">شما سرپرستار/جانشین هیچ بخشی نیستید و دسترسی نظارتی هم ندارید.</div></div>';
        return;
      }
      if (!SS.wardTitle || !SS.wards.some(w => w.title === SS.wardTitle)) SS.wardTitle = SS.wards[0].title;
      // خواستهٔ کارفرما: برنامه از «آبان» شروع شود، نه ماهِ جاریِ سیستم.
      if (!SS.year) SS.year = todayJ().jy;
      if (!SS.month) SS.month = 8;
      await ssLoadAll();
    } catch (err) { $('content').innerHTML = `<div class="panel g"><div class="empty">${e(err.message)}</div></div>`; }
  };

  // با عوض کردن بخش، اگر فرم‌های کد یا پنل پزشکان باز بود بسته می‌شود و
  // برنامهٔ شیفت همان بخشِ انتخاب‌شده نشان داده می‌شود (نه فرم قبلی).
  function ssResetViewOnWardChange() {
    SS.tab = 'grid';
    SS.showDoctors = false;
    SS.codes = null;
  }
  global.ssSelectWard = async function (title) {
    if (title !== SS.wardTitle) ssResetViewOnWardChange();
    SS.wardTitle = title;
    await ssLoadAll();
  };
  // چرا ایندکس و نه عنوان: `onclick="ssSelectWard('عنوان')"` عنوان را داخل یک رشتهٔ JS می‌گذاشت
  // و آپاستروفِ عنوان (یا هر کاراکترِ کنترلی) رشته را می‌شکست — esc() این را حل نمی‌کند، چون HTML
  // خودش «&#39;» را پیش از تجزیهٔ JS به «'» برمی‌گرداند (شاهد: scratch/xss-probe2.cjs — «missing )
  // after argument list»). حالا فقط یک عدد به رشته می‌رود و نام از خودِ state خوانده می‌شود.
  global.ssSelectWardByIndex = async function (i) {
    const w = SS.wards[i];
    if (w) {
      if (w.title !== SS.wardTitle) ssResetViewOnWardChange();
      SS.wardTitle = w.title;
      await ssLoadAll();
    }
  };
  global.ssOpenCodesCard = function () {
    SS.tab = 'codes';
    ssDraw();
    if (SS.isManager && (!SS.codes || SS.codes.year !== SS.year || SS.codes.month !== SS.month)) {
      ssLoadCodes().then(ssDraw).catch(err => { if (typeof toast === 'function') toast('خطا در بارگذاری فرم: ' + err.message, true); });
    }
  };
  global.ssSelectTab = function (t) {
    SS.tab = t;
    ssDraw();
    if (t === 'crisis') {
      ssLoadCrisis().then(ssDraw).catch(err => { if (typeof toast === 'function') toast('خطا در بارگذاری برنامهٔ بحران: ' + err.message, true); });
    }
    // تب فرم‌های کد داده‌اش را از سرور می‌گیرد (فقط مدیر پرستاری به آن دسترسی دارد).
    if (t === 'codes' && SS.isManager && (!SS.codes || SS.codes.year !== SS.year || SS.codes.month !== SS.month)) {
      ssLoadCodes().then(ssDraw).catch(err => { if (typeof toast === 'function') toast('خطا در بارگذاری فرم: ' + err.message, true); });
    }
  };
  global.ssSetGroupFilter = function (k) { SS.groupFilter = k; ssDraw(); };
  global.ssChangeMonth = async function (delta) {
    let m = SS.month + delta, y = SS.year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    SS.year = y; SS.month = m;
    await ssLoadAll();
  };
  global.ssSelectMonth = async function (m) {
    m = parseInt(m, 10);
    if (!m || m < 1 || m > 12 || m === SS.month) return;
    SS.month = m;
    await ssLoadAll();
  };
  // آیکون هر ماه: نشانهٔ فصلی/مناسبتی از همان مجموعهٔ آیکون پروژه.
  const SS_MONTH_ICONS = { 1: 'sparkle', 2: 'heart', 3: 'star', 4: 'star', 5: 'star', 6: 'book', 7: 'graduation', 8: 'calendar', 9: 'calendar', 10: 'calendar', 11: 'flag', 12: 'sparkle' };
  function ssMonthTabsHtml() {
    const months = SS_MONTH_TABS.includes(SS.month) ? SS_MONTH_TABS.slice() : SS_MONTH_TABS.concat(SS.month).sort((a, b) => a - b);
    return `<div class="ss-month-tabs" role="tablist" aria-label="ماه‌های برنامه">
      <span class="ss-month-year">سال ${F(SS.year)}</span>
      <div class="ss-month-list">
        ${months.map(m => `<button type="button" role="tab" aria-selected="${m === SS.month ? 'true' : 'false'}"
          class="ss-month-tab ${m === SS.month ? 'active' : ''}" onclick="ssSelectMonth(${m})">
          <span class="ss-micon">${I(SS_MONTH_ICONS[m] || 'calendar')}</span><span class="ss-mname">${e(JM[m - 1])}</span>
        </button>`).join('')}
      </div>
    </div>`;
  }

  async function ssLoadAll() {
    const [staffRes, schedRes] = await Promise.all([
      API.shiftStaffList(SS.wardTitle),
      API.shiftSchedule(SS.wardTitle, SS.year, SS.month),
    ]);
    SS.staff = staffRes.staff || [];
    SS.canEdit = !!staffRes.can_edit;
    SS.sched = schedRes;
    SS.settings = schedRes.settings;
    const w = (SS.wards || []).find(x => x.title === SS.wardTitle);
    SS.wardId = w ? w.id : null;
    SS.wardBedCount = w && w.bed_count != null ? w.bed_count : null;
    // اگر مدیر تب فرم‌های کد را باز کرده، همان ماه/سال را برای فرم‌ها هم بخوان.
    if (SS.codes) { try { await ssLoadCodes(); } catch (e2) { SS.codes = null; } }
    ssDraw();
  }

  // گروه‌بندی بخش‌ها برای نمایش کارتی — ترتیب مهم است: «کمک اورژانس» باید در گروه
  // اورژانس بیفتد، و «کمک جراحی» در گروه اتاق عمل.
  // «دفتر پرستاری» همیشه اولین کارتِ فهرست است (گروه مدیریت پرستاری) و گروه
  // پشتیبانی/انبار عمداً پایین‌تر، بعد از بخش‌های درمانی، می‌آید.
  const SS_WARD_GROUPS = [
    { label: 'مدیریت پرستاری', test: t => /دفتر پرستاری/.test(t) },
    { label: 'اورژانس', test: t => /اورژانس/.test(t) },
    { label: 'اتاق عمل و بیهوشی', test: t => /اتاق عمل|بیهوشی/.test(t) },
    { label: 'جراحی', test: t => /جراحی/.test(t) },
    { label: 'مراقبت‌های ویژه', test: t => /ICU|مراقبت ویژه/i.test(t) },
    { label: 'پشتیبانی و انبار', test: t => /CSSD|انبار|تأسیسات|تاسیسات|خدمات/.test(t) },
    { label: 'سایر بخش‌ها', test: () => true },
  ];

  function ssWardGroupsHtml() {
    const groups = SS_WARD_GROUPS.map(g => ({ label: g.label, test: g.test, items: [] }));
    SS.wards.forEach((w, wi) => {
      const g = groups.find(x => x.test(w.title || '')) || groups[groups.length - 1];
      g.items.push({ w, wi });
    });
    return `<div class="ss-ward-groups">
      ${groups.filter(g => g.items.length).map(g => `
        <div class="ss-ward-group">
          <div class="ss-ward-group-title"><span>${e(g.label)}</span><span class="ss-ward-count">${F(g.items.length)}</span><i></i></div>
          <div class="ss-ward-grid">
            ${g.items.map(({ w, wi }) => `<button type="button" class="ss-ward-card ${w.title === SS.wardTitle ? 'active' : ''}"
              onclick="ssSelectWardByIndex(${wi})" title="${e(w.title)}">
              <span class="ss-ward-ico">${e(w.icon || '🏥')}</span><span class="ss-ward-name">${e(w.title)}</span>
            </button>`).join('')}
          </div>
        </div>`).join('')}
      ${SS.isManager ? `<div class="ss-ward-group">
        <div class="ss-ward-group-title"><span>گروه بحران</span><span class="ss-ward-count">۱</span><i></i></div>
        <div class="ss-ward-grid">
          <button type="button" class="ss-ward-card ${SS.tab === 'codes' ? 'active' : ''}" onclick="ssOpenCodesCard()" title="فرم‌های کد ۹۹ و ۵۵">
            <span class="ss-ward-ico">🗂️</span><span class="ss-ward-name">فرم‌های کد ۹۹ و ۵۵</span>
          </button>
        </div>
      </div>` : ''}
    </div>`;
  }

  // بخش‌هایی که برنامهٔ بحران ندارند (خواستهٔ کارفرما)
  const SS_CRISIS_EXCLUDE = new Set(['دفتر پرستاری', 'CSSD', 'انبار', 'کلینیک', 'آندوسکوپی']);
  function ssHasCrisis() { return !SS_CRISIS_EXCLUDE.has(SS.wardTitle); }

  function ssDraw() {
    $('content').innerHTML = `
    <div class="panel g noprint" style="margin-bottom:16px">
      <div class="phd">${I('users', 'lg')}<div><h3>بخش‌ها</h3><div class="sub">پرسنل و برنامه‌ی شیفت بخش انتخابی</div></div></div>
      <div class="pbody">${ssWardGroupsHtml()}</div>
      <div class="pbody" style="padding-top:0">
        <div class="ss-view-tabs">
          <button class="ss-view-tab ${SS.tab === 'staff' ? 'active' : ''}" onclick="ssSelectTab('staff')">${I('user')} پرسنل</button>
          <button class="ss-view-tab ${SS.tab === 'grid' ? 'active' : ''}" onclick="ssSelectTab('grid')">${I('calendar')} برنامه‌ی شیفت</button>
          ${ssHasCrisis() ? `<button class="ss-view-tab ${SS.tab === 'crisis' ? 'active' : ''}" onclick="ssSelectTab('crisis')">${I('shield')} برنامهٔ بحران</button>` : ''}
        </div>
      </div>
    </div>
    ${SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml()))}
`;
  }

  /* ---------------- تب برنامهٔ بحران ---------------- */
  async function ssLoadCrisis() {
    const key = SS.wardTitle + '|' + SS.year + '|' + SS.month;
    if (SS.crisis && SS.crisis.key === key) return;
    const r = await API.shiftCrisisGet(SS.wardTitle, SS.year, SS.month);
    SS.crisis = { key: key, rows: r.staff || [] };
  }

  function ssCrisisHtml() {
    const sc = (SS.sched && SS.sched.schedule) || {};
    const days = sc.days || 30;
    const holidayMap = ssMonthHolidayMap();
    const holidays = new Set(holidayMap.keys());
    const dayCols = Array.from({ length: days }, (_, i) => i + 1);
    const rows = (SS.crisis && SS.crisis.rows) || [];
    return `<div class="panel g noprint">
      <div class="phd">${I('shield', 'lg')}<div style="flex:1"><h3>برنامهٔ بحران — بخش «${e(SS.wardTitle)}»</h3>
        <div class="sub">${JM[SS.month - 1]} ${F(SS.year)} — همین نفرات بخش (بدون کمک‌پرستار/بهیار). روی هر خانه بزن تا شیفت را بگذاری.</div></div></div>
      <div class="pbody" style="padding-top:0">
        ${!rows.length ? '<div class="empty">در حال بارگذاری…</div>' : `
        <div class="tbl-wrap ss-grid-wrap"><table class="ss-grid">
          <thead>
            <tr><th class="ss-sticky" colspan="3">روز هفته</th>
              ${dayCols.map(d => `<th style="font-size:9.5px;font-weight:400">${WEEKDAY_SHORT[weekdayOf(SS.year, SS.month, d)] || ''}</th>`).join('')}</tr>
            <tr><th class="ss-sticky ss-c-num">ردیف</th><th class="ss-c-name">نام و نام خانوادگی</th><th class="ss-c-pos">سمت</th>
              ${dayCols.map(d => `<th class="${holidays.has(d) ? 'ss-holiday' : ''}" title="${e(holidayMap.get(d) || '')}">${F(d)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((s, i) => `<tr data-crisis-id="${e(s.id)}">
              <td class="ss-sticky ss-c-num">${F(i + 1)}</td>
              <td class="ss-c-name"><div class="ss-name-stack"><span>${e(s.first_name)}</span><span>${e(s.last_name)}</span></div></td>
              <td class="ss-c-pos">${e(s.position || '—')}</td>
              ${dayCols.map(d => {
                const code = (s.cells && s.cells[d]) || '';
                return `<td class="ss-cell ${code ? 'ss-' + code : ''}${holidays.has(d) ? ' ss-holiday-col' : ''}"
                  onclick="ssEditCrisisCell('${e(s.id)}',${d},'${e(code)}')">${e(code)}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="sd-note" style="margin-top:12px">${I('info')}<div>M=صبح · E=عصر · N=شب · ME/EN/MEN=ترکیب · H=مرخصی · S=استعلاجی · C=کلاس</div></div>`}
      </div>
    </div>`;
  }

  global.ssEditCrisisCell = function (staffId, day, current) {
    const row = ((SS.crisis && SS.crisis.rows) || []).find(r => r.id === staffId);
    const box = document.createElement('div');
    box.className = 'ss-popover';
    const opts = ['M', 'E', 'N', 'ME', 'EN', 'MN', 'MEN', 'H', 'S', 'C'];
    box.innerHTML = `<div class="ss-pop-inner">
      <div style="font-size:12px;color:var(--td);margin-bottom:8px">روز ${F(day)} — ${e(row ? row.first_name + ' ' + row.last_name : '')}</div>
      <div class="ss-pop-presets">
        ${opts.map(k => `<button type="button" class="btn btn-o btn-sm" data-k="${k}">${k}</button>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn btn-g btn-sm" id="ssCxSave">ذخیره</button>
        <button class="btn btn-o btn-sm" id="ssCxClear">پاک‌کردن</button>
        <button class="btn btn-o btn-sm" id="ssCxCancel">بستن</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    let sel = current || '';
    const paint = () => box.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('btn-g', b.dataset.k === sel));
    paint();
    box.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { sel = (sel === b.dataset.k ? '' : b.dataset.k); paint(); }; });
    const close = () => box.remove();
    box.querySelector('#ssCxCancel').onclick = close;
    box.addEventListener('click', ev => { if (ev.target === box) close(); });
    box.querySelector('#ssCxClear').onclick = async () => { await ssSaveCrisisCell(staffId, day, ''); close(); };
    box.querySelector('#ssCxSave').onclick = async () => { await ssSaveCrisisCell(staffId, day, sel); close(); };
  };

  async function ssSaveCrisisCell(staffId, day, codes) {
    try {
      await API.shiftCrisisCell({ ward: SS.wardTitle, year: SS.year, month: SS.month, staff_id: staffId, day: day, codes: codes });
      const r = ((SS.crisis && SS.crisis.rows) || []).find(x => x.id === staffId);
      if (r) {
        r.cells = r.cells || {};
        if (codes) r.cells[day] = codes; else delete r.cells[day];
      }
      ssDraw();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); }
  }

  /* ---------------- تب پرسنل ---------------- */
  function ssStaffHtml() {
    return `<div class="panel g noprint">
      <div class="phd">${I('user', 'lg')}<div style="flex:1"><h3>پرسنل بخش «${e(SS.wardTitle)}»</h3>
        <div class="sub">این افراد لزوماً کاربر سامانه نیستند — فقط برای برنامه‌ی شیفت ثبت می‌شوند</div></div>
        ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssOpenPositions()">${I('settings')} سمت‌ها</button>` : ''}
        ${SS.canEdit ? `<button class="btn btn-g btn-sm" onclick="ssOpenStaffForm()">${I('plus')} پرسنل تازه</button>` : ''}
      </div>
      <div class="pbody" style="padding-top:0">
        <div id="ssStaffForm"></div>
        ${!SS.staff.length ? '<div class="empty">هنوز پرسنلی ثبت نشده</div>' : `
        <div class="tbl-wrap"><table><thead><tr>
          <th>نام و نام‌خانوادگی</th><th>جنسیت</th><th>کد پرسنلی</th><th>سمت</th>
          <th>وضعیت استخدام</th><th>شیفت ثابت</th><th>سابقه (سال)</th><th>سقف ساعت ماهانه</th><th style="width:120px"></th>
        </tr></thead><tbody>
        ${SS.staff.map(s => `<tr>
          <td><div class="ss-name-stack"><span>${e(s.first_name)}</span><span>${e(s.last_name)}</span></div></td>
          <td>${e(s.gender)}</td>
          <td style="direction:ltr;text-align:left">${e(s.personnel_code || '—')}</td>
          <td>${e(s.position || '—')}</td>
          <td>${e(s.employment_status || '—')}</td>
          <td>${s.fixed_shift ? `<b>${e(s.fixed_shift)}</b>` : 'چرخشی'}</td>
          <td>${s.years_experience == null ? '—' : F(s.years_experience)}</td>
          <td>${F(s.monthly_hour_quota)}</td>
          <td style="white-space:nowrap">
            ${SS.canEdit ? `<button class="btn btn-o btn-sm" onclick="ssOpenStaffForm('${s.id}')" aria-label="ویرایش">${I('edit')}</button>
            <button class="btn btn-o btn-sm" onclick="ssDeleteStaff('${s.id}')" aria-label="حذف">${I('trash')}</button>` : ''}
          </td>
        </tr>`).join('')}
        </tbody></table></div>`}
      </div>
    </div>`;
  }

  global.ssOpenStaffForm = function (id) {
    const st = id ? SS.staff.find(s => s.id === id) : null;
    const info = st ? (st.extra_info || {}) : {};
    document.getElementById('ssStaffForm').innerHTML = `
    <div class="panel g" style="margin-bottom:16px;background:var(--bg)">
      <div class="pbody">
        <div class="docgrid">
          <div class="fg"><label>نام</label><input id="ss_fn" value="${e(st ? st.first_name : '')}"></div>
          <div class="fg"><label>نام‌خانوادگی</label><input id="ss_ln" value="${e(st ? st.last_name : '')}"></div>
          <div class="fg"><label>جنسیت</label>
            <select id="ss_gender"><option value="زن" ${(!st || st.gender === 'زن') ? 'selected' : ''}>زن</option>
              <option value="مرد" ${st && st.gender === 'مرد' ? 'selected' : ''}>مرد</option></select></div>
          <div class="fg"><label>کد پرسنلی</label><input id="ss_code" style="direction:ltr" value="${e(st ? st.personnel_code || '' : '')}"></div>
          <div class="fg"><label>سمت</label>
            <select id="ss_position">
              <option value="">— انتخاب سمت —</option>
              ${(SS.positions || []).map(x => `<option value="${e(x)}" ${st && st.position === x ? 'selected' : ''}>${e(x)}</option>`).join('')}
              ${st && st.position && !(SS.positions || []).includes(st.position) ? `<option value="${e(st.position)}" selected>${e(st.position)}</option>` : ''}
            </select></div>
          <div class="fg"><label>وضعیت استخدام</label>
            <select id="ss_employment">
              ${['قراردادی', 'ساعتی'].map(x =>
                `<option value="${x}" ${((st && st.employment_status) || 'قراردادی') === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select></div>
          <div class="fg"><label>شیفت کاری ثابت</label>
            <select id="ss_fixed">
              <option value="" ${(!st || !st.fixed_shift) ? 'selected' : ''}>چرخشی (بدون شیفت ثابت)</option>
              <option value="M" ${st && st.fixed_shift === 'M' ? 'selected' : ''}>M — صبح</option>
              <option value="E" ${st && st.fixed_shift === 'E' ? 'selected' : ''}>E — عصر</option>
              <option value="N" ${st && st.fixed_shift === 'N' ? 'selected' : ''}>N — شب</option>
              <option value="ME" ${st && st.fixed_shift === 'ME' ? 'selected' : ''}>ME — صبح و عصر</option>
              <option value="EN" ${st && st.fixed_shift === 'EN' ? 'selected' : ''}>EN — عصر و شب</option>
            </select></div>
          <div class="fg"><label>تاریخ شروع همکاری (شمسی، اختیاری)</label><input id="ss_hire" placeholder="مثلاً 1401-05-01" style="direction:ltr" value="${e(st ? st.hire_date || '' : '')}"></div>
          <div class="fg"><label>سابقه‌ی کار (سال)</label><input id="ss_exp" type="number" min="0" max="60" value="${st && st.years_experience != null ? st.years_experience : ''}"></div>
          <div class="fg"><label>سقف ساعت کاری ماهانه</label><input id="ss_quota" type="number" value="${st ? st.monthly_hour_quota : 169}"></div>
        </div>
        <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12.5px;color:var(--gdl)">اطلاعات بیشتر (اختیاری)</summary>
          <div class="docgrid" style="margin-top:8px">
            <div class="fg"><label>کد ملی</label><input id="ss_x_nid" style="direction:ltr" value="${e(info.national_id || '')}"></div>
            <div class="fg"><label>مدرک تحصیلی</label><input id="ss_x_edu" value="${e(info.education || '')}"></div>
            <div class="fg"><label>وضعیت تأهل</label><input id="ss_x_marital" value="${e(info.marital_status || '')}"></div>
            <div class="fg" style="grid-column:span 2"><label>آدرس</label><input id="ss_x_address" value="${e(info.address || '')}"></div>
            <div class="fg" style="grid-column:span 2"><label>یادداشت آزاد</label><textarea id="ss_x_note" rows="2">${e(info.note || '')}</textarea></div>
          </div>
        </details>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-g btn-sm" onclick="ssSaveStaff(${st ? `'${st.id}'` : 'null'})">${I('check')} ذخیره</button>
          <button class="btn btn-o btn-sm" onclick="document.getElementById('ssStaffForm').innerHTML=''">انصراف</button>
        </div>
      </div>
    </div>`;
  };

  // تعریف سمت‌ها توسط مدیر پرستاری؛ هر خط یک سمت. این لیست هم در فرم
  // پرسنل و هم در گزارش/چاپ (از طریق فیلد position) استفاده می‌شود.
  global.ssOpenPositions = function () {
    if (!SS.isManager) return toast('فقط مدیر پرستاری می‌تواند سمت تعریف کند', true);
    shOpenModal({
      title: 'تعریف سمت‌ها',
      submitText: 'ذخیره‌ی سمت‌ها',
      width: 480,
      body: `<div class="sub" style="margin-bottom:10px">هر خط یک سمت. این سمت‌ها در فرم «پرسنل تازه» به‌صورت لیست انتخاب می‌شوند.</div>
        <div class="fg"><label for="ssPosList">سمت‌ها</label>
          <textarea id="ssPosList" rows="9">${e((SS.positions || []).join('\n'))}</textarea></div>`,
      onSubmit: async (form, close) => {
        const list = form.querySelector('#ssPosList').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!list.length) throw new Error('حداقل یک سمت لازم است');
        const r = await API.shiftSetPositions({ positions: list });
        SS.positions = r.positions || list;
        close();
        toast('سمت‌ها ذخیره شد');
        ssDraw();
      }
    });
  };

  global.ssSaveStaff = async function (id) {
    const body = {
      ward: SS.wardTitle,
      first_name: document.getElementById('ss_fn').value.trim(),
      last_name: document.getElementById('ss_ln').value.trim(),
      gender: document.getElementById('ss_gender').value,
      personnel_code: document.getElementById('ss_code').value.trim(),
      position: document.getElementById('ss_position').value.trim(),
      employment_status: document.getElementById('ss_employment').value,
      fixed_shift: document.getElementById('ss_fixed').value,
      hire_date: document.getElementById('ss_hire').value.trim(),
      monthly_hour_quota: document.getElementById('ss_quota').value,
      years_experience: document.getElementById('ss_exp').value === '' ? null : document.getElementById('ss_exp').value,
      extra_info: {
        national_id: document.getElementById('ss_x_nid').value.trim(),
        education: document.getElementById('ss_x_edu').value.trim(),
        marital_status: document.getElementById('ss_x_marital').value.trim(),
        address: document.getElementById('ss_x_address').value.trim(),
        note: document.getElementById('ss_x_note').value.trim(),
      },
    };
    try {
      if (id) await API.shiftStaffUpdate(id, body); else await API.shiftStaffAdd(body);
      if (typeof toast === 'function') toast('ذخیره شد');
      await ssLoadAll();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  global.ssDeleteStaff = async function (id) {
    if (!await BTN.confirmDanger('این پرسنل حذف شود؟ (از سطل بازیافت سوپرادمین قابل بازگردانی است)')) return;
    try { await API.shiftStaffDelete(id); await ssLoadAll(); }
    catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  /* ---------------- تب برنامه‌ی شیفت ---------------- */
  function ssGridHtml() {
    const sc = SS.sched.schedule, days = sc.days, st = SS.settings;
    const holidayMap = ssMonthHolidayMap();
    const holidays = new Set(holidayMap.keys());
    const hc = SS.sched.headcount;
    // SS.staff (تب پرسنل) فقط روستر خام است؛ سلول‌ها و کارکرد/اضافه‌کارِ محاسبه‌شده
    // فقط در پاسخِ endpoint برنامه هست (SS.sched.staff) — دو منبع را قاطی نکنیم.
    const gridStaff = SS.sched.staff || [];
    // وقتی فیلتری گروهی فعال است، ردیف‌های «تعداد نفرات هر شیفت» هم فقط همان
    // گروه را می‌شمارند — وگرنه وقتی سرپرستار برنامهٔ کمک‌پرستارها را جدا وارد
    // می‌کند، عددِ جلوی چشمش عدد کل بخش است و گمراه می‌شود.
    const countList = SS.groupFilter === 'all' ? gridStaff : gridStaff.filter(s => ssGroupOf(s).key === SS.groupFilter);
    const groupCount = (k, d) => { let n = 0; for (const s of countList) { const c = (s.cells && s.cells[d]) || ''; if (c.includes(k)) n++; } return n; };
    const countLabel = r => r.label + (SS.groupFilter === 'all' ? '' : ' — فقط ' + ((SS_GROUPS.find(g => g.key === SS.groupFilter) || {}).label || ''));
    const dayCols = Array.from({ length: days }, (_, i) => i + 1);
    const finalized = sc.finalized_at ? `<span class="ss-finalized-badge" title="آخرین ثبت نهایی">ثبت نهایی: ${e(sc.finalized_at)}${sc.finalized_by_name ? ' — ' + e(sc.finalized_by_name) : ''}</span>` : '';
    return `<div class="panel g noprint" style="margin-bottom:16px">
      <div class="phd">${I('calendar', 'lg')}<div style="flex:1"><h3>برنامه‌ی ${JM[SS.month - 1]} ${F(SS.year)} — بخش «${e(SS.wardTitle)}»</h3>
        <div class="sub">روی هر خانه کلیک کنید تا شیفت را تنظیم کنید؛ روی شماره‌ی روز کلیک کنید تا تعطیل دستی شود. نام‌ها را با دستهٔ کنار ردیف جابه‌جا کنید.</div>
        ${finalized}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssToggleSettings()">${I('settings')} ساعتِ شیفت</button>` : ''}
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssTogglePrintCfg()">${I('settings')} نام‌های امضا / قالب چاپ</button>` : ''}
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssOpenPositions()">${I('settings')} سمت‌ها</button>` : ''}
          ${SS.isManager && SS.wardId ? `<button class="btn btn-o btn-sm" onclick="ssResetWardPass()">${I('key') || I('settings')} رمز ورود این بخش</button>` : ''}
          <button class="btn btn-o btn-sm" onclick="ssGenderCheck()">${I('users')} بررسی همگنی آقا/خانم</button>
          ${SS.canEdit ? `<button class="btn btn-o btn-sm ss-finalize-btn" onclick="ssFinalize()">${I('check')} پایان نوشتن برنامه</button>` : ''}
          <button class="btn btn-g btn-sm" onclick="ssPrint()">${I('print')} چاپ فرم A4 افقی</button>
        </div>
      </div>
      <div class="pbody" style="padding-top:0">
        ${ssMonthTabsHtml()}
        <div id="ssSettingsPanel">${SS.showSettings ? ssSettingsHtml() : ''}</div>
        <div id="ssPrintCfgPanel">${SS.showPrintCfg ? (SS.printCfg ? ssPrintCfgHtml() : '<div class="empty">در حال بارگذاری…</div>') : ''}</div>
        <div id="ssCustomRowsPanel">${SS.showCustomRows ? ssCustomRowsHtml() : ''}</div>
        <div id="ssUnitsPanel">${SS.showUnits ? ssUnitsHtml() : ''}</div>
        <div class="docgrid">
          <div class="fg"><label>یادداشت بالای برنامه (مثلاً «۲۶ روز کاری»)</label>
            <input id="ssNote" value="${e(sc.note || '')}" ${SS.canEdit ? '' : 'disabled'}
              onchange="ssSaveNote(this.value)"></div>
          <div class="fg"><label>توضیحاتِ زیر برگه‌ی چاپی (اختیاری، مخصوصِ همین ماه)</label>
            <textarea id="ssDesc" rows="2" ${SS.canEdit ? '' : 'disabled'}
              onchange="ssSaveDescription(this.value)"
              placeholder="هر توضیحی که باید پای برنامه‌ی همین ماه چاپ شود">${e(sc.description || '')}</textarea></div>
        </div>
        ${!gridStaff.length ? '<div class="empty">اول از تب «پرسنل» چند نفر اضافه کنید</div>' : `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
          <span class="sub">نمایشِ گروه:</span>
          <button class="btn btn-sm ${SS.groupFilter === 'all' ? 'btn-g' : 'btn-o'}" onclick="ssSetGroupFilter('all')">همه</button>
          ${SS_GROUPS.slice(0, 3).map(g => `<button class="btn btn-sm ${SS.groupFilter === g.key ? 'btn-g' : 'btn-o'}" onclick="ssSetGroupFilter('${g.key}')">${e(g.label)}</button>`).join('')}
        </div>
        <div class="tbl-wrap ss-grid-wrap"><table class="ss-grid">
          <thead>
          <tr><th class="ss-sticky" colspan="6">روز هفته</th>
            ${dayCols.map(d => `<th style="font-size:9.5px;font-weight:400">${WEEKDAY_SHORT[weekdayOf(SS.year, SS.month, d)] || ''}</th>`).join('')}
            <th colspan="3"></th></tr>
          <tr>
            <th class="ss-sticky ss-c-num">ردیف</th>
            <th class="ss-c-name">نام و نام خانوادگی</th>
            <th class="ss-c-pos">سمت</th>
            <th class="ss-c-code">شیفت ثابت</th>
            <th class="ss-c-exp">سابقه (سال)</th>
            <th class="ss-c-status">وضعیت استخدام</th>
            ${dayCols.map(d => `<th class="${holidays.has(d) ? 'ss-holiday' : ''}" ${SS.canEdit ? `onclick="ssToggleHoliday(${d})" style="cursor:pointer"` : ''}
              title="${e(holidayMap.get(d) || 'برای تعطیل‌کردن این روز کلیک کنید')}">${F(d)}</th>`).join('')}
            <th>کارکرد کل</th><th>سقف</th><th>اضافه/کسری‌کار</th>
          </tr></thead>
          <tbody>
          ${(() => {
            const list = SS.groupFilter === 'all' ? gridStaff : gridStaff.filter(s => ssGroupOf(s).key === SS.groupFilter);
            if (!list.length) return `<tr><td colspan="${6 + days + 3}">در این گروه کسی ثبت نشده</td></tr>`;
            let lastGroup = null, n = 0;
            const out = [];
            for (const s of list) {
              const g = ssGroupOf(s);
              if (g.key !== lastGroup) {
                lastGroup = g.key;
                out.push(`<tr class="ss-group-row"><td class="ss-sticky" colspan="6">${e(g.label)}</td><td colspan="${days + 3}"></td></tr>`);
              }
              n++;
              out.push(`<tr data-staff-id="${e(s.id)}" data-group="${e(g.key)}" ondragover="ssDragOverRow(event,this)" ondragleave="ssDragLeaveRow(event,this)" ondrop="ssDropRow(event,this)">
            <td class="ss-sticky ss-c-num"><span class="ss-drag-handle" draggable="true" title="برای جابه‌جایی بکشید"
              ondragstart="ssDragStart(event,'${e(s.id)}')" ondragend="ssDragEnd(event)">⋮⋮</span>${F(n)}</td>
            <td class="ss-c-name"><div class="ss-name-stack"><span>${e(s.first_name)}</span><span>${e(s.last_name)}</span></div></td>
            <td class="ss-c-pos ss-inline" data-field="position" onclick="ssBeginInline('${e(s.id)}','position')" title="کلیک برای تغییر سمت">${e(s.position || '—')}<span class="ss-edit-pen">✎</span></td>
            <td class="ss-c-code ss-inline" data-field="fixed_shift" onclick="ssBeginInline('${e(s.id)}','fixed_shift')" title="کلیک برای تغییر شیفت ثابت">${s.fixed_shift ? e(s.fixed_shift) : '<span class="ss-muted">چرخشی</span>'}<span class="ss-edit-pen">✎</span></td>
            <td class="ss-c-exp ss-inline" data-field="years_experience" onclick="ssBeginInline('${e(s.id)}','years_experience')" title="کلیک برای تغییر سابقه">${s.years_experience == null ? '—' : F(s.years_experience)}<span class="ss-edit-pen">✎</span></td>
            <td class="ss-c-status ss-inline" data-field="employment_status" onclick="ssBeginInline('${e(s.id)}','employment_status')" title="کلیک برای تغییر وضعیت استخدام">${e(s.employment_status || '—')}<span class="ss-edit-pen">✎</span></td>
            ${dayCols.map(d => {
              const code = (s.cells && s.cells[d]) || '';
              const isLead = !!(s.leads && s.leads[d]);
              return `<td class="ss-cell ${code ? 'ss-' + code : ''}${holidays.has(d) ? ' ss-holiday-col' : ''}" onclick="ssEditCell('${e(s.id)}',${d},'${e(code)}',${isLead ? 1 : 0})" title="${e(code || 'خالی')}${isLead ? ' — مسئول شیفت' : ''}${holidayMap.get(d) ? ' — ' + e(holidayMap.get(d)) : ''}">${e(code)}${isLead ? '<span class="ss-lead" title="مسئول شیفت">★</span>' : ''}</td>`;
            }).join('')}
            <td><b>${F(s.total_hours)}</b></td>
            <td>${F(s.monthly_hour_quota)}</td>
            <td class="${s.overtime > 0 ? 'ss-pos' : (s.overtime < 0 ? 'ss-neg' : '')}">${s.overtime > 0 ? '+' : ''}${F(s.overtime)}</td>
          </tr>`);
            }
            return out.join('');
          })()}
          ${SHIFT_COUNT_ROWS.map(r => `<tr class="ss-hc-row ss-hc-${r.k}">
            <td class="ss-sticky" colspan="6">${e(countLabel(r))}</td>
            ${dayCols.map(d => `<td>${F(SS.groupFilter === 'all' ? ((hc[d] || {})[r.k] || 0) : groupCount(r.k, d))}</td>`).join('')}
            <td colspan="3"></td></tr>`).join('')}
          </tbody>
        </table></div>
        <div class="sd-note" style="margin-top:12px">${I('info')}
          <div>M=صبح · E=عصر · N=شب · H=مرخصی استحقاقی · S=استعلاجی · C=کلاس · ترکیب‌ها: ME (صبح+عصر) · EN (عصر+شب) · MEN (۲۴ ساعته)</div></div>`}
      </div>
    </div>`;
  }

  /* ---- تنظیمِ ساعتِ هر شیفت — معادلِ ردیف‌های AG30:AJ32 اکسل ---- */
  function ssClockHours(v) {
    const s = String(v || '').replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/[：]/g, ':');
    const m = s.match(/(\d{1,2})(?::(\d{1,2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{1,2}))?/);
    if (!m) return null;
    const start = Number(m[1]) + (Number(m[2] || 0) / 60);
    let end = Number(m[3]) + (Number(m[4] || 0) / 60);
    if (end <= start) end += 24;
    return Math.round((end - start) * 10) / 10;
  }
  global.ssAutoHours = function () {
    [['cm', 'hm'], ['ce', 'he'], ['cn', 'hn']].forEach(([clockId, hourId]) => {
      const h = ssClockHours((document.getElementById('ss_' + clockId) || {}).value);
      const out = document.getElementById('ss_' + hourId);
      if (out && h != null) out.value = h;
    });
  };
  function ssSettingsHtml() {
    const st = SS.settings;
    const field = (label, clockId, hourId, clock, hour) => `<div class="fg">
      <label>${label}</label>
      <div class="ss-clock-row">
        <input id="ss_${clockId}" class="ss-clock-input" style="direction:ltr" value="${e(clock)}"
          oninput="ssAutoHours()" onchange="ssAutoHours()" placeholder="07:00-14:00">
        <input id="ss_${hourId}" class="ss-hours-input" type="number" readonly tabindex="-1" value="${hour}">
        <span class="ss-hours-unit">ساعت</span>
      </div></div>`;
    return `<div class="panel g ss-settings-box" style="margin-bottom:16px;background:var(--bg)">
      <div class="ss-box-head">
        <div><b>ساعتِ شیفت‌های این بخش</b><span class="sub">ساعتِ کارکرد از بازه‌ی زمانی خودکار حساب می‌شود</span></div>
        <button type="button" class="ss-box-close" aria-label="بستن" title="بستن" onclick="ssToggleSettings()">×</button>
      </div>
      <div class="pbody">
        <div class="docgrid">
          ${field('شیفت صبح (M)', 'cm', 'hm', st.clock_m, st.hour_m)}
          ${field('شیفت عصر (E)', 'ce', 'he', st.clock_e, st.hour_e)}
          ${field('شیفت شب (N)', 'cn', 'hn', st.clock_n, st.hour_n)}
        </div>
        <div class="ss-settings-note">${I('info')} مرخصی (H) معادل شیفت صبح حساب می‌شود و ساعتش در «کارکرد کل» جمع می‌شود؛ بازه‌ی صبح را که تغییر دهید، ساعت H هم خودکار همان می‌شود.</div>
        <button class="btn btn-g btn-sm" style="margin-top:8px" onclick="ssSaveSettings()">${I('check')} ذخیره‌ی ساعتِ شیفت این بخش</button>
      </div>
    </div>`;
  }
  global.ssToggleSettings = function () { SS.showSettings = !SS.showSettings; ssDraw(); };
  global.ssSaveSettings = async function () {
    try {
      const r = await API.shiftSetSettings({
        ward: SS.wardTitle,
        hour_m: document.getElementById('ss_hm').value, clock_m: document.getElementById('ss_cm').value,
        hour_e: document.getElementById('ss_he').value, clock_e: document.getElementById('ss_ce').value,
        hour_n: document.getElementById('ss_hn').value, clock_n: document.getElementById('ss_cn').value,
        hour_h: document.getElementById('ss_hm').value,
      });
      SS.settings = r.settings;
      if (typeof toast === 'function') toast('ساعتِ شیفت ذخیره شد');
      await ssLoadAll();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  /* ---- تغییر رمز ورودِ بخش توسط مدیر پرستاری ---- */
  global.ssResetWardPass = function () {
    if (!SS.isManager) return toast('فقط مدیر پرستاری می‌تواند رمز بخش را تغییر دهد', true);
    const w = SS.wards.find(x => x.title === SS.wardTitle);
    if (!w) return;
    if (typeof shOpenModal !== 'function') return;
    shOpenModal({
      title: 'تغییر رمز ورود بخش «' + w.title + '»',
      submitText: 'ذخیره‌ی رمز جدید',
      width: 440,
      body: `
        <div class="sub" style="margin-bottom:12px">سرپرستار این بخش با این رمز وارد می‌شود. رمز فعلی نمایش داده نمی‌شود.</div>
        <div class="fg"><label for="ssWp1">رمز جدید</label><input id="ssWp1" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="fg"><label for="ssWp2">تکرار رمز جدید</label><input id="ssWp2" type="password" minlength="4" autocomplete="new-password" required></div>`,
      onSubmit: async (form, close) => {
        const p1 = form.querySelector('#ssWp1').value;
        const p2 = form.querySelector('#ssWp2').value;
        if (p1.length < 4) throw new Error('رمز جدید باید حداقل ۴ نویسه باشد');
        if (p1 !== p2) throw new Error('تکرار رمز مطابقت ندارد');
        await API.wardResetPassword(w.id, p1);
        close();
        toast('رمز ورود بخش تغییر کرد');
      }
    });
  };

  /* ---- قالب چاپ (کد فرم، یادآوری‌ها، امضاها، تماس‌ها) ---- */
  global.ssTogglePrintCfg = async function () {
    SS.showPrintCfg = !SS.showPrintCfg;
    if (SS.showPrintCfg && !SS.printCfg) {
      try { SS.printCfg = (await API.shiftGetPrintConfig()).config; } catch (e2) { /* اگر نشد، پیش‌فرض در سرور است */ }
    }
    ssDraw();
  };
  // «این یک فرم سازمانی است، پس باید کد دفترچه مثل سایر کدها بخورد» — سرور سندِ
  // کنترل‌شده را می‌سازد (یا همان قبلی را برمی‌گرداند) و کدش را در قالبِ چاپ می‌نشاند.
  window.ssRegisterForm = async function () {
    try {
      const r = await API.shiftRegisterForm();
      SS.printCfg = r.config;
      toast('کد فرم در دفترچه مدارک ثبت شد: ' + r.document.doc_code);
      const box = document.getElementById('ssPrintCfgPanel');
      if (box) box.innerHTML = ssPrintCfgHtml();
    } catch (err) { toast(err.message, true); }
  };

  function ssPrintCfgHtml() {
    const c = SS.printCfg || { form_code: '', revision_date: '', clinical_supervisor_name: '', nursing_manager_name: '',
      hospital_president_name: '', training_title: 'افراد معرفی شده به کلاس‌های آموزشی:', contract_hours: 158,
      care_method: 'Case Method', reminders: [], signatures: ['', '', ''], contacts: [] };
    return `<div class="panel g" style="margin-bottom:16px;background:var(--bg)">
      <div class="pbody">
        <div class="sub" style="margin-bottom:8px">این قالب سراسریِ همان بیمارستان است و روی برگه‌ی چاپیِ همه‌ی بخش‌ها اثر می‌گذارد.</div>
        <div class="docgrid">
          <div class="fg"><label>کد فرم</label>
            <input id="ss_pc_code" style="direction:ltr" value="${e(c.form_code)}">
            <div style="margin-top:6px">
              <button class="btn btn-o btn-sm" onclick="ssRegisterForm()">${c.document_id ? 'ثبت‌شده در دفترچه کد ✔ — گرفتن مجدد' : 'گرفتن کد از دفترچه مدارک'}</button>
              <span class="sub" style="margin-right:6px">این برگه یک فرم سازمانی است؛ با این دکمه به‌عنوان «فرم» در دفترچه کد ثبت می‌شود و کد استانداردش این‌جا می‌نشیند.</span>
            </div></div>
          <div class="fg"><label>تاریخ آخرین بازنگری</label><input id="ss_pc_rev" style="direction:ltr" placeholder="1405/01/01" value="${e(c.revision_date)}"></div>
        </div>
        <div class="docgrid">
          <div class="fg"><label>نام سوپروایزر بالینی</label><input id="ss_pc_super" value="${e(c.clinical_supervisor_name || '')}"></div>
          <div class="fg"><label>نام مدیریت پرستاری</label><input id="ss_pc_manager" value="${e(c.nursing_manager_name || '')}"></div>
          <div class="fg"><label>نام ریاست بیمارستان</label><input id="ss_pc_president" value="${e(c.hospital_president_name || '')}"></div>
          <div class="fg"><label>ساعت موظفی قراردادی</label><input id="ss_pc_hours" type="number" min="0" max="300" value="${c.contract_hours != null ? c.contract_hours : 158}"></div>
          <div class="fg"><label>روش کار</label><input id="ss_pc_care" value="${e(c.care_method || 'Case Method')}"></div>
          <div class="fg"><label>عنوان بالای امضاها</label><input id="ss_pc_training" value="${e(c.training_title || 'افراد معرفی شده به کلاس‌های آموزشی:')}"></div>
        </div>
        <div class="fg"><label>یادآوری‌ها (هر خط یک یادآوری)</label>
          <textarea id="ss_pc_rem" rows="3">${e((c.reminders || []).join('\n'))}</textarea></div>
        <div class="docgrid">
          ${[0, 1, 2, 3, 4, 5].map(i => `<div class="fg"><label>برچسبِ امضای ${F(i + 1)}</label><input id="ss_pc_sig${i}" value="${e((c.signatures || [])[i] || '')}"></div>`).join('')}
        </div>
        <div class="fg"><label>اطلاعات تماس (هر خط یک سطر)</label>
          <textarea id="ss_pc_contacts" rows="3">${e((c.contacts || []).join('\n'))}</textarea></div>
        <button class="btn btn-g btn-sm" onclick="ssSavePrintCfg()">${I('check')} ذخیره‌ی قالب چاپ</button>
      </div>
    </div>`;
  }
  global.ssSavePrintCfg = async function () {
    const lines = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    try {
      const r = await API.shiftSetPrintConfig({
        form_code: document.getElementById('ss_pc_code').value.trim(),
        revision_date: document.getElementById('ss_pc_rev').value.trim(),
        clinical_supervisor_name: document.getElementById('ss_pc_super').value.trim(),
        nursing_manager_name: document.getElementById('ss_pc_manager').value.trim(),
        hospital_president_name: document.getElementById('ss_pc_president').value.trim(),
        contract_hours: document.getElementById('ss_pc_hours').value,
        care_method: document.getElementById('ss_pc_care').value.trim(),
        training_title: document.getElementById('ss_pc_training').value.trim(),
        reminders: lines('ss_pc_rem'),
        signatures: [0, 1, 2, 3, 4, 5].map(i => document.getElementById('ss_pc_sig' + i).value.trim()).filter(Boolean),
        contacts: lines('ss_pc_contacts'),
      });
      SS.printCfg = r.config;
      if (typeof toast === 'function') toast('قالب چاپ ذخیره شد');
      ssDraw();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  /* ---- سطرهای دلخواهِ سربرگ/پاورقی — «دقیقاً مثل اکسل» ----
     هر سطر روی کلِ عرضِ جدول مرج می‌شود؛ کارفرما همین را خواست: بتواند خودش
     متن اضافه کند، بالای جدول یا پایینش، وسط‌چین یا راست‌چین، پررنگ یا ساده. */
  global.ssToggleCustomRows = function () { SS.showCustomRows = !SS.showCustomRows; ssDraw(); };
  function ssCustomRowsHtml() {
    const rows = (SS.sched.schedule.custom_rows || []);
    return `<div class="panel g" style="margin-bottom:16px;background:var(--bg)">
      <div class="pbody">
        <div class="sub" style="margin-bottom:8px">هر سطر روی تمام عرضِ جدول مرج می‌شود و بالای (سربرگ) یا پایینِ (پاورقی) برنامه چاپ می‌شود.</div>
        <div id="ssCrList">
          ${rows.map((r, i) => ssCustomRowFields(r, i)).join('') || '<div class="empty">هنوز سطری اضافه نشده</div>'}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-o btn-sm" onclick="ssAddCustomRow()">${I('plus')} سطر تازه</button>
          <button class="btn btn-g btn-sm" onclick="ssSaveCustomRows()">${I('check')} ذخیره‌ی سطرها</button>
        </div>
      </div>
    </div>`;
  }
  function ssCustomRowFields(r, i) {
    return `<div class="ss-cr-row" data-i="${i}">
      <select class="ss-cr-area">
        <option value="header" ${r.area !== 'footer' ? 'selected' : ''}>سربرگ (بالای جدول)</option>
        <option value="footer" ${r.area === 'footer' ? 'selected' : ''}>پاورقی (زیر جدول)</option>
      </select>
      <input class="ss-cr-text" value="${e(r.text || '')}" placeholder="متنِ سطر">
      <select class="ss-cr-align">
        <option value="center" ${r.align !== 'right' && r.align !== 'left' ? 'selected' : ''}>وسط</option>
        <option value="right" ${r.align === 'right' ? 'selected' : ''}>راست</option>
        <option value="left" ${r.align === 'left' ? 'selected' : ''}>چپ</option>
      </select>
      <label class="ss-cr-bold"><input type="checkbox" class="ss-cr-b" ${r.bold ? 'checked' : ''}> پررنگ</label>
      <button class="btn btn-o btn-sm" onclick="this.closest('.ss-cr-row').remove()">${I('trash')}</button>
    </div>`;
  }
  global.ssAddCustomRow = function () {
    const list = document.getElementById('ssCrList');
    if (list.querySelector('.empty')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', ssCustomRowFields({ area: 'header', text: '', align: 'center', bold: 0 }, list.children.length));
  };
  global.ssSaveCustomRows = async function () {
    const rows = [...document.querySelectorAll('#ssCrList .ss-cr-row')].map(el => ({
      area: el.querySelector('.ss-cr-area').value,
      text: el.querySelector('.ss-cr-text').value.trim(),
      align: el.querySelector('.ss-cr-align').value,
      bold: el.querySelector('.ss-cr-b').checked ? 1 : 0,
    })).filter(r => r.text);
    try {
      const r = await API.shiftSetCustomRows({ ward: SS.wardTitle, year: SS.year, month: SS.month, rows });
      SS.sched.schedule.custom_rows = r.rows;
      if (typeof toast === 'function') toast('سطرها ذخیره شد');
      ssDraw();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  /* ---- واحدهای دلخواه (کارکنان پشتیبانی) ---- */
  global.ssToggleUnits = function () { SS.showUnits = !SS.showUnits; ssDraw(); };
  function ssUnitsHtml() {
    const custom = SS.wards.filter(w => w.custom);
    return `<div class="panel g" style="margin-bottom:16px;background:var(--bg)">
      <div class="pbody">
        <div class="sub" style="margin-bottom:8px">برنامه‌ی شیفت فقط برای بخش‌های پرستاری نیست — واحدهای پشتیبانی (خدمات، تأسیسات، نگهبانی، آشپزخانه و…) را این‌جا تعریف کنید.</div>
        ${custom.length ? `<div class="tbl-wrap"><table><thead><tr><th>نام واحد</th><th>نوع</th><th style="width:90px"></th></tr></thead><tbody>
          ${custom.map(u => `<tr><td>${e(u.title)}</td><td>${e(u.kind || 'پشتیبانی')}</td>
            <td><button class="btn btn-o btn-sm" onclick="ssDeleteUnit('${u.id}')">${I('trash')}</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">هنوز واحد دلخواهی تعریف نشده</div>'}
        <div class="docgrid" style="margin-top:10px">
          <div class="fg"><label>نام واحد تازه</label><input id="ss_unit_title" placeholder="مثلاً واحد خدمات"></div>
          <div class="fg"><label>نوع</label><input id="ss_unit_kind" value="پشتیبانی"></div>
        </div>
        <button class="btn btn-g btn-sm" onclick="ssAddUnit()">${I('plus')} افزودن واحد</button>
      </div>
    </div>`;
  }
  global.ssAddUnit = async function () {
    const title = document.getElementById('ss_unit_title').value.trim();
    const kind = document.getElementById('ss_unit_kind').value.trim();
    if (!title) return;
    try {
      await API.shiftUnitAdd({ title, kind });
      SS.wards = await loadWards();
      if (typeof toast === 'function') toast('واحد اضافه شد');
      ssDraw();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };
  global.ssDeleteUnit = async function (id) {
    if (!await BTN.confirmDanger('این واحد حذف شود؟')) return;
    try {
      await API.shiftUnitDelete(id);
      SS.wards = await loadWards();
      if (SS.wardTitle && !SS.wards.some(w => w.title === SS.wardTitle)) SS.wardTitle = SS.wards[0] && SS.wards[0].title;
      await ssLoadAll();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  };

  global.ssSaveNote = async function (v) {
    try {
      await API.shiftSetNote({ ward: SS.wardTitle, year: SS.year, month: SS.month, note: v });
      SS.sched.schedule.note = v;
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); }
  };

  global.ssSaveDescription = async function (v) {
    try {
      await API.shiftSetNote({ ward: SS.wardTitle, year: SS.year, month: SS.month,
        note: SS.sched.schedule.note, description: v });
      SS.sched.schedule.description = v;
      if (typeof toast === 'function') toast('توضیحات ذخیره شد');
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); }
  };

  global.ssToggleHoliday = async function (day) {
    if (!SS.canEdit) return;
    const official = ssOfficialHolidayMap(SS.year, SS.month);
    if (official[day]) return toast('این روز تعطیل رسمی است: ' + official[day], true);
    if (weekdayOf(SS.year, SS.month, day) === 5) return toast('جمعه‌ها خودکار تعطیل‌اند', true);
    const holidays = new Set(SS.sched.schedule.holidays || []);
    if (holidays.has(day)) holidays.delete(day); else holidays.add(day);
    try {
      await API.shiftSetNote({ ward: SS.wardTitle, year: SS.year, month: SS.month, note: SS.sched.schedule.note, holidays: [...holidays] });
      await ssLoadAll();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); }
  };

  /* ---- ویرایشِ درجا (سمت / شیفت ثابت / سابقه / وضعیت استخدام) ----
     هر تغییر همان لحظه با PUT پرسنل ذخیره می‌شود؛ بعد از ذخیره گرید دوباره
     خوانده می‌شود تا اگر سمت از «کمک‌پرستار» به «پرستار» تغییر کرد، شخص
     خودکار به گروه درست برود. */
  global.ssBeginInline = function (staffId, field) {
    if (!SS.canEdit) return;
    const st = (SS.sched.staff || []).find(x => x.id === staffId);
    if (!st) return;
    const row = document.querySelector(`tr[data-staff-id="${staffId}"]`);
    const cell = row && row.querySelector(`[data-field="${field}"]`);
    if (!cell || cell.querySelector('select,input')) return;
    const current = field === 'years_experience'
      ? (st.years_experience == null ? '' : String(st.years_experience))
      : String(st[field] || '');
    let html = '';
    if (field === 'position') {
      const opts = (SS.positions || []).slice();
      if (st.position && !opts.includes(st.position)) opts.push(st.position);
      html = `<select class="ss-inline-input">${opts.map(x => `<option value="${e(x)}" ${x === current ? 'selected' : ''}>${e(x)}</option>`).join('')}</select>`;
    } else if (field === 'fixed_shift') {
      html = `<select class="ss-inline-input">
        <option value="" ${current ? '' : 'selected'}>چرخشی</option>
        ${['M', 'E', 'N', 'ME', 'EN'].map(x => `<option value="${x}" ${current === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>`;
    } else if (field === 'employment_status') {
      const opts = ['قراردادی', 'ساعتی'];
      if (current && !opts.includes(current)) opts.push(current);
      html = `<select class="ss-inline-input">${opts.map(x => `<option value="${e(x)}" ${x === current ? 'selected' : ''}>${e(x)}</option>`).join('')}</select>`;
    } else {
      html = `<input class="ss-inline-input" type="number" min="0" max="60" value="${e(current)}">`;
    }
    cell.innerHTML = html;
    const ctrl = cell.firstElementChild;
    ctrl.focus();
    if (ctrl.select) { try { ctrl.select(); } catch (e2) { /* بی‌صدا */ } }
    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const val = ctrl.value;
      try { await ssSaveInline(staffId, field, val); }
      catch (err) { done = false; if (typeof toast === 'function') toast(err.message, true); }
    };
    ctrl.addEventListener('change', commit);
    ctrl.addEventListener('blur', () => setTimeout(commit, 90));
    ctrl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      else if (ev.key === 'Escape') { done = true; ssDraw(); }
    });
  };
  async function ssSaveInline(staffId, field, value) {
    const st = (SS.sched.staff || []).find(x => x.id === staffId);
    if (!st) return;
    const body = {
      ward: SS.wardTitle,
      first_name: st.first_name,
      last_name: st.last_name,
      gender: st.gender,
      personnel_code: st.personnel_code || '',
      position: st.position || '',
      employment_status: st.employment_status || 'قراردادی',
      fixed_shift: st.fixed_shift || '',
      hire_date: st.hire_date || '',
      monthly_hour_quota: st.monthly_hour_quota,
      years_experience: st.years_experience,
    };
    body[field] = field === 'years_experience'
      ? (value === '' ? null : Number(value))
      : value;
    await API.shiftStaffUpdate(staffId, body);
    if (typeof toast === 'function') toast('در پروفایل ذخیره شد');
    await ssLoadAll();
  }

  /* ---- جابه‌جایی نام‌ها با کشیدن (و فلش‌های بالا/پایین) ---- */
  global.ssDragStart = function (ev, staffId) {
    SS.dragStaffId = staffId;
    try {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', staffId);
    } catch (e2) { /* بی‌صدا */ }
    const row = document.querySelector(`tr[data-staff-id="${staffId}"]`);
    if (row) row.classList.add('ss-dragging');
  };
  global.ssDragEnd = function () {
    document.querySelectorAll('tr.ss-dragging,tr.ss-drop-target').forEach(el => el.classList.remove('ss-dragging', 'ss-drop-target'));
    SS.dragStaffId = null;
  };
  global.ssDragOverRow = function (ev, tr) {
    if (!SS.dragStaffId || !tr || tr.dataset.staffId === SS.dragStaffId) return;
    const src = document.querySelector(`tr[data-staff-id="${SS.dragStaffId}"]`);
    if (!src || src.dataset.group !== tr.dataset.group) return;
    ev.preventDefault();
    tr.classList.add('ss-drop-target');
  };
  global.ssDragLeaveRow = function (ev, tr) {
    if (tr) tr.classList.remove('ss-drop-target');
  };
  global.ssDropRow = async function (ev, tr) {
    if (!SS.dragStaffId || !tr) return;
    ev.preventDefault();
    const src = document.querySelector(`tr[data-staff-id="${SS.dragStaffId}"]`);
    if (!src || src.dataset.group !== tr.dataset.group) {
      toast('برای جابه‌جایی بین گروه‌ها، سمتِ شخص را تغییر دهید', true);
      ssDragEnd();
      return;
    }
    const group = tr.dataset.group;
    const rows = [...document.querySelectorAll(`tr[data-staff-id][data-group="${group}"]`)];
    const ids = rows.map(r => r.dataset.staffId);
    const from = ids.indexOf(SS.dragStaffId);
    if (from < 0 || SS.dragStaffId === tr.dataset.staffId) { ssDragEnd(); return; }
    ids.splice(from, 1);
    let to = ids.indexOf(tr.dataset.staffId);
    const after = ev.clientY > (tr.getBoundingClientRect().top + tr.offsetHeight / 2);
    if (to < 0) to = ids.length;
    if (after) to++;
    ids.splice(to, 0, SS.dragStaffId);
    ssDragEnd();
    try {
      await API.shiftSetStaffOrder({ ward: SS.wardTitle, ids });
      toast('ترتیب ذخیره شد');
      await ssLoadAll();
    } catch (err) { toast(err.message, true); }
  };
  global.ssMoveStaff = async function (staffId, dir) {
    const row = document.querySelector(`tr[data-staff-id="${staffId}"]`);
    if (!row) return;
    const group = row.dataset.group;
    const rows = [...document.querySelectorAll(`tr[data-staff-id][data-group="${group}"]`)];
    const ids = rows.map(r => r.dataset.staffId);
    const i = ids.indexOf(staffId), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await API.shiftSetStaffOrder({ ward: SS.wardTitle, ids });
      await ssLoadAll();
    } catch (err) { toast(err.message, true); }
  };

  global.ssEditCell = function (staffId, day, current, isLead) {
    const letters = ['M', 'E', 'N', 'H'];
    const chosen = new Set(current.split('').filter(c => letters.includes(c)));
    const box = document.createElement('div');
    box.className = 'ss-popover';
    box.innerHTML = `<div class="ss-pop-inner">
      <div style="font-size:12px;color:var(--td);margin-bottom:8px">روز ${fa ? fa(day) : day}</div>
      <div class="ss-pop-presets">
        ${SHIFT_PRESETS.map(p => `<button type="button" class="btn btn-o btn-sm" data-preset="${p.k}">${e(p.label)}<i>${
          F(p.hours(SS.settings))} ساعت</i></button>`).join('')}
      </div>
      <div style="height:1px;background:var(--bd);margin:8px 0"></div>
      ${letters.map(l => `<label class="ss-pop-opt"><input type="checkbox" data-l="${l}" ${chosen.has(l) ? 'checked' : ''}> ${
        { M: 'M — صبح', E: 'E — عصر', N: 'N — شب', H: 'H — مرخصی' }[l]}</label>`).join('')}
      <label class="ss-pop-opt ss-pop-lead"><input type="checkbox" id="ssPopLead" ${isLead ? 'checked' : ''}> ★ مسئول شیفتِ این روز (روی برگه ستاره می‌خورد)</label>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn btn-g btn-sm" id="ssPopSave">ذخیره</button>
        <button class="btn btn-o btn-sm" id="ssPopClear">پاک‌کردن</button>
        <button class="btn btn-o btn-sm" id="ssPopCancel">بستن</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.querySelector('#ssPopCancel').onclick = close;
    box.addEventListener('click', ev => { if (ev.target === box) close(); });
    box.querySelectorAll('[data-preset]').forEach(btn => {
      btn.onclick = () => {
        const want = new Set(btn.dataset.preset.split(''));
        letters.forEach(l => { box.querySelector(`input[data-l="${l}"]`).checked = want.has(l); });
      };
    });
    box.querySelector('#ssPopClear').onclick = async () => { await ssSubmitCell(staffId, day, '', false); close(); };
    box.querySelector('#ssPopSave').onclick = async () => {
      const codes = [...box.querySelectorAll('input[data-l]:checked')].map(i => i.dataset.l).join('');
      const lead = box.querySelector('#ssPopLead').checked;
      await ssSubmitCell(staffId, day, codes, lead); close();
    };
  };

  async function ssSubmitCell(staffId, day, codes, lead) {
    try {
      await API.shiftSetCell({ ward: SS.wardTitle, year: SS.year, month: SS.month, staff_id: staffId, day, codes, lead: !!lead });
      await ssLoadAll();
    } catch (err) { if (typeof toast === 'function') toast(err.message, true); else BTN.alert(err.message); }
  }

  /* ---- بررسی همگنی آقا/خانم برای همین بخش ----
     تعریف: «همگن» یعنی همهٔ افرادی که آن روز در یک شیفت (صبح/عصر/شب) هستند، یک
     جنسیت داشته باشند. خانه‌های قرمز یعنی آن شیفتِ آن روز هم آقا دارد هم خانم —
     همین چیزی که کارفرما خواست بتواند برای هر بخش بررسی کند. این پنجره فقط
     بخشِ انتخاب‌شده را می‌بیند؛ برای بخش دیگر، از بالای صفحه بخش را عوض کنید. */
  global.ssGenderCheck = function () {
    if (!SS.sched) return;
    const days = SS.sched.schedule.days;
    const staff = SS.sched.staff || [];
    const rows = [];
    const month = { M: { m: 0, f: 0 }, E: { m: 0, f: 0 }, N: { m: 0, f: 0 } };
    let mixedCount = 0;
    for (let d = 1; d <= days; d++) {
      const per = { M: { m: 0, f: 0 }, E: { m: 0, f: 0 }, N: { m: 0, f: 0 } };
      staff.forEach(s => {
        const c = (s.cells && s.cells[d]) || '';
        ['M', 'E', 'N'].forEach(k => {
          if (c.includes(k)) {
            const gk = s.gender === 'مرد' ? 'm' : 'f';
            per[k][gk]++; month[k][gk]++;
          }
        });
      });
      const mixed = ['M', 'E', 'N'].filter(k => per[k].m > 0 && per[k].f > 0);
      if (mixed.length) mixedCount++;
      rows.push({ d, per, mixed });
    }
    const fmt = o => `${F(o.f)} زن / ${F(o.m)} مرد`;
    const lbl = { M: 'صبح', E: 'عصر', N: 'شب' };
    const dayTable = list => `<div class="tbl-wrap"><table><thead><tr><th>روز</th><th>هفته</th><th>صبح (M)</th><th>عصر (E)</th><th>شب (N)</th></tr></thead><tbody>
      ${list.map(r => `<tr>
        <td>${F(r.d)}</td><td>${WEEKDAY_FA[weekdayOf(SS.year, SS.month, r.d)] || ''}</td>
        ${['M', 'E', 'N'].map(k => `<td class="${r.mixed.includes(k) ? 'ss-gc-bad' : ''}">${fmt(r.per[k])}</td>`).join('')}
      </tr>`).join('')}
    </tbody></table></div>`;
    const html = `<div class="ss-gc-modal" id="ssGcModal">
      <div class="ss-gc-box">
        <button type="button" class="ss-gc-x" aria-label="بستن" onclick="document.getElementById('ssGcModal').remove()">×</button>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-inline-start:34px">
          <b style="font-size:14px">بررسی همگنی آقا/خانم — بخش «${e(SS.wardTitle)}»، ${JM[SS.month - 1]} ${F(SS.year)}</b>
          <button class="btn btn-o btn-sm" style="margin-inline-start:auto" onclick="document.getElementById('ssGcModal').remove()">بستن</button>
        </div>
        <div class="sub" style="margin-bottom:8px">«همگن» یعنی همهٔ افرادِ آن شیفت در آن روز یک جنسیت داشته باشند. خانه‌های قرمز = شیفتِ مختلط (هم آقا و هم خانم).</div>
        <div class="docgrid" style="margin-bottom:8px">
          ${['M', 'E', 'N'].map(k => `<div class="fg"><label>جمع ماهِ شیفت ${lbl[k]} (${k})</label>
            <div style="padding:6px 8px">${fmt(month[k])}</div></div>`).join('')}
          <div class="fg"><label>روزهای دارای شیفت مختلط</label>
            <div style="padding:6px 8px" class="${mixedCount ? 'ss-gc-bad' : 'ss-gc-ok'}">${mixedCount ? F(mixedCount) + ' روز' : 'هیچ — همه همگن'}</div></div>
        </div>
        ${mixedCount ? dayTable(rows.filter(r => r.mixed.length)) : ''}
        <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--gdl)">نمایشِ همهٔ روزهای ماه</summary>
          <div style="margin-top:8px">${dayTable(rows)}</div>
        </details>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('ssGcModal');
    if (!modal) return;
    const close = () => {
      modal.remove();
      document.removeEventListener('keydown', onEsc);
    };
    const onEsc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    // کلیک بیرونِ جعبه (روی پس‌زمینه) هم پنجره را می‌بندد.
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
  };

  /* ---- پایان نوشتن برنامه: همگنی جنسیت + هشدار شیفت بدون نفر ----
     خروجی این پنجره همان چیزی است که دکمهٔ «پایان نوشتن برنامه» باید نشان
     دهد: روزهای ناهمگن (هم آقا و هم خانم در یک شیفت) و شیفت‌های خالی.
     ثبت نهایی هم روی سرور انجام و زمان/کاربرش ذخیره می‌شود. */
  function ssAuditData() {
    const days = (SS.sched && SS.sched.schedule.days) || 0;
    const staff = (SS.sched && SS.sched.staff) || [];
    const labels = { M: 'صبح', E: 'عصر', N: 'شب' };
    const mixed = [], zero = [];
    for (let d = 1; d <= days; d++) {
      for (const k of ['M', 'E', 'N']) {
        let male = 0, female = 0;
        for (const s of staff) {
          const c = (s.cells && s.cells[d]) || '';
          if (!c.includes(k)) continue;
          if (s.gender === 'مرد') male++; else female++;
        }
        if (male && female) mixed.push({ day: d, shift: k, label: labels[k], male, female });
        if (!male && !female) zero.push({ day: d, shift: k, label: labels[k] });
      }
    }
    const mixedDays = [...new Set(mixed.map(x => x.day))];
    return { days, mixed, zero, mixedDays };
  }
  global.ssFinalize = function () {
    if (!SS.canEdit || !SS.sched) return;
    const a = ssAuditData();
    const sc = SS.sched.schedule;
    const issues = a.mixed.length + a.zero.length;
    const issueRows = [
      ...a.mixed.map(x => `<tr><td>${F(x.day)}</td><td>${WEEKDAY_FA[weekdayOf(SS.year, SS.month, x.day)] || ''}</td>
        <td>${x.label} (${x.shift})</td><td>${F(x.female)} زن</td><td>${F(x.male)} مرد</td>
        <td class="ss-gc-bad">ناهمگن</td></tr>`),
      ...a.zero.map(x => `<tr><td>${F(x.day)}</td><td>${WEEKDAY_FA[weekdayOf(SS.year, SS.month, x.day)] || ''}</td>
        <td>${x.label} (${x.shift})</td><td>—</td><td>—</td><td class="ss-gc-bad">بدون نفر</td></tr>`),
    ].sort((x, y) => {
      const dx = Number(x.match(/<td>([^<]+)<\/td>/)[1].replace(/[۰-۹]/g, ch => '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
      const dy = Number(y.match(/<td>([^<]+)<\/td>/)[1].replace(/[۰-۹]/g, ch => '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
      return dx - dy;
    }).join('');
    const status = sc.finalized_at
      ? `<div class="ss-finalized-box">آخرین ثبت نهایی: <b>${e(sc.finalized_at)}</b>${sc.finalized_by_name ? ' — ' + e(sc.finalized_by_name) : ''}</div>`
      : '';
    const html = `<div class="ss-gc-modal" id="ssFinalizeModal">
      <div class="ss-gc-box">
        <button type="button" class="ss-gc-x" aria-label="بستن" onclick="document.getElementById('ssFinalizeModal').remove()">×</button>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-inline-start:34px;flex-wrap:wrap">
          <b style="font-size:14px">پایان نوشتن برنامه — بخش «${e(SS.wardTitle)}»، ${JM[SS.month - 1]} ${F(SS.year)}</b>
        </div>
        <div class="sub" style="margin-bottom:10px">بررسی خودکار: هر شیفت باید همهٔ افرادش هم‌جنس باشند و حداقل یک نفر داشته باشد. این گزارش قبل از ثبت نهایی نمایش داده می‌شود.</div>
        ${status}
        <div class="docgrid" style="margin-bottom:10px">
          <div class="fg"><label>روزهای ناهمگن</label><div class="ss-audit-num ${a.mixedDays.length ? 'ss-gc-bad' : 'ss-gc-ok'}">${a.mixedDays.length ? F(a.mixedDays.length) + ' روز' : 'هیچ'}</div></div>
          <div class="fg"><label>شیفت‌های مختلط</label><div class="ss-audit-num ${a.mixed.length ? 'ss-gc-bad' : 'ss-gc-ok'}">${a.mixed.length ? F(a.mixed.length) + ' مورد' : 'هیچ'}</div></div>
          <div class="fg"><label>شیفت‌های بدون نفر</label><div class="ss-audit-num ${a.zero.length ? 'ss-gc-bad' : 'ss-gc-ok'}">${a.zero.length ? F(a.zero.length) + ' مورد' : 'هیچ'}</div></div>
        </div>
        ${issues ? `<div class="tbl-wrap" style="max-height:50vh;overflow:auto"><table><thead><tr>
          <th>روز</th><th>هفته</th><th>شیفت</th><th>خانم</th><th>آقا</th><th>وضعیت</th>
        </tr></thead><tbody>${issueRows}</tbody></table></div>` : `<div class="ss-audit-ok">همهٔ شیفت‌ها همگن‌اند و هیچ شیفت بدون نفری وجود ندارد.</div>`}
        <div class="ss-audit-warn">${issues ? 'با وجود هشدارها می‌توانید برنامه را ثبت نهایی کنید؛ اما بهتر است اول موارد بالا را اصلاح کنید.' : 'برنامه آمادهٔ ثبت نهایی است.'}</div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button type="button" class="btn btn-g btn-sm" id="ssFinalizeGo" onclick="ssDoFinalize(this)">
            ${issues ? 'ثبت نهایی با وجود هشدار' : 'ثبت نهایی برنامه'}
          </button>
          <button type="button" class="btn btn-o btn-sm" onclick="document.getElementById('ssFinalizeModal').remove()">بستن</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('ssFinalizeModal');
    if (!modal) return;
    const close = () => { modal.remove(); document.removeEventListener('keydown', onEsc); };
    const onEsc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
  };
  global.ssDoFinalize = async function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'در حال ثبت…'; }
    try {
      const r = await API.shiftFinalize({ ward: SS.wardTitle, year: SS.year, month: SS.month });
      const modal = document.getElementById('ssFinalizeModal');
      if (modal) modal.remove();
      toast(r && r.finalized_at ? 'برنامه ثبت نهایی شد: ' + r.finalized_at : 'برنامه ثبت نهایی شد');
      await ssLoadAll();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'تلاش دوباره برای ثبت نهایی'; }
      toast(err.message, true);
    }
  };

  /* ------------------------------------------------------------------
     چاپِ یک‌صفحه‌ای A4 افقی
     ---------------------------------------------------------------------
     ترفند: محتوا با اندازه‌ی طبیعی‌اش رندر می‌شود، بعد با اندازه‌گیریِ واقعیِ
     مرورگر (نه یک عدد ثابتِ حدسی) نسبت به فضای واقعیِ چاپِ A4 افقی مقیاس
     می‌گیرد — همان کاری که برای فلوچارت (fcsheet) با بودجه‌ی ثابت انجام شد،
     ولی این‌جا چون تعداد پرسنل هر بخش متفاوت است، بودجه‌ی ثابت جواب نمی‌داد؛
     پس مقیاس در لحظه، از رویِ اندازه‌ی واقعیِ رندرشده، حساب می‌شود.
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     چاپ فرم A4 افقی — همان برگهٔ کاغذی بیمارستان
     ---------------------------------------------------------------------
     برگه عمداً از داخل یک iframe چاپ می‌شود تا استایل‌های صفحهٔ برنامه و
     اسکرول/تم تاریک روی خروجی اثر نگذارند. HTML و CSS چاپ در
     public/css/shift-print.css نگه‌داری می‌شوند.
     ------------------------------------------------------------------ */
  function ssPrintClockRange(clock) {
    const m = String(clock || '').match(/(\d{1,2})(?::\d{2})?\s*[-–]\s*(\d{1,2})(?::\d{2})?/);
    if (!m) return '';
    return F(String(Number(m[1]))) + '-' + F(String(Number(m[2])));
  }

  function ssPrintHolidays(days) {
    // جمعه‌ها + تعطیلات دستی + تعطیلات رسمیِ ثبت‌شده برای همین سال/ماه.
    const map = ssMonthHolidayMap();
    const out = new Set();
    for (let d = 1; d <= days; d++) if (map.has(d)) out.add(d);
    return out;
  }
  function ssIsNonProfessional(s) {
    return /کمک|بهیار/.test((s && s.position) || '');
  }

  function ssPrintHeadName(staff) {
    const head = (staff || []).find(s => /سرپرستار/.test(s.position || ''));
    if (head) return ((head.first_name || '') + ' ' + (head.last_name || '')).trim();
    if (S.user && /head_nurse/.test(S.user.role_code || '')) return S.user.full_name || '';
    return '';
  }

  function ssPrintLevelsHtml(cfg) {
    const c = cfg || {};
    const val = (arr, i) => {
      const v = Array.isArray(arr) ? arr[i] : null;
      return (v == null || v === '') ? '' : F(v);
    };
    const levels = [1, 2, 3, 4, 5].map(n => `<th>سطح ${F(n)}</th>`).join('');
    const avg = [0, 1, 2, 3, 4].map(i => `<td>${val(c.level_avg, i)}</td>`).join('');
    const hrs = [0, 1, 2, 3, 4].map(i => `<td>${val(c.level_hours, i)}</td>`).join('');
    return `<table class="levels">
      <tr><th class="levels-title">سطوح بیماران</th>${levels}</tr>
      <tr><td>میانگین بیماران ماه قبل</td>${avg}</tr>
      <tr><td>میزان ساعات مراقبت مورد نیاز</td>${hrs}</tr>
    </table>`;
  }

  function ssPrintLegendHtml() {
    const st = SS.settings || {};
    return `<div class="legend">
      <div class="legend-col">
        <div>شیفت صبح: <b>M</b> (${ssPrintClockRange(st.clock_m) || F('7-14')})</div>
        <div>شیفت عصر: <b>E</b> (${ssPrintClockRange(st.clock_e) || F('13-19')})</div>
        <div>شیفت شب: <b>N</b> (${ssPrintClockRange(st.clock_n) || F('19-7')})</div>
      </div>
      <div class="legend-col">
        <div>مرخصی استحقاقی: <b>H</b></div>
        <div>مرخصی استعلاجی: <b>S</b></div>
        <div>کلاس: <b>C</b></div>
      </div>
    </div>`;
  }

  function ssPrintHeaderHtml(cfg, ward, beds) {
    const monthLabel = JM[SS.month - 1] + ' ' + F(SS.year);
    const hosp = (S.user && S.user.hospital_name) || '';
    return `<div class="top">
      <div class="top-main">
        <img class="logo" src="/api/hospital/logo" alt="">
        <div class="title-wrap">
          <div class="hosp">${e(hosp)}</div>
          <div class="form-title">${e(cfg.title || ('برنامه درمانی ماهانه بخش ' + ward))}</div>
          <div class="head-meta">
            <div class="month-big">ماه: <b>${monthLabel}</b></div>
            <div class="beds">از تاریخ <bdi dir="ltr">${ssFaYmd(1, SS.month, SS.year)}</bdi> تا تاریخ <bdi dir="ltr">${ssFaYmd((SS.sched && SS.sched.schedule && SS.sched.schedule.days) || 30, SS.month, SS.year)}</bdi></div>
            <div class="beds">تعداد تخت: <b>${F(beds)}</b></div>
          </div>
        </div>
      </div>
      <div class="top-side">
        ${ssPrintLegendHtml()}
        ${ssPrintLevelsHtml(cfg)}
      </div>
    </div>
    <div class="head-strip">
      <div>ساعت موظفی قراردادی: <b>${F(cfg.contract_hours != null ? cfg.contract_hours : 158)}</b></div>
      <div>کد فرم: <b dir="ltr">${e(cfg.form_code || '')}</b></div>
      <div>تعداد تخت فعال: <b>${F(beds)}</b></div>
      <div>روش کار: <b>${e(cfg.care_method || 'Case Method')}</b></div>
    </div>`;
  }

  function ssPrintSummaryHtml(dayCols, holidays) {
    // پایین برگه، عیناً ساختار فرم کاغذی: ۶ ردیف برای صبح/عصر/شب؛ در هر شیفت
    // یک ردیف «حرفه‌ای» و یک ردیف «غیرحرفه‌ای» (کمک‌پرستار/بهیار). مقدار هر
    // روز از همان سلول‌های برنامه شمرده می‌شود، نه دستی.
    const staff = (SS.sched && SS.sched.staff) || [];
    const counts = {};
    dayCols.forEach(d => { counts[d] = { M: { pro: 0, non: 0 }, E: { pro: 0, non: 0 }, N: { pro: 0, non: 0 } }; });
    staff.forEach(s => {
      const kind = ssIsNonProfessional(s) ? 'non' : 'pro';
      dayCols.forEach(d => {
        const c = (s.cells && s.cells[d]) || '';
        ['M', 'E', 'N'].forEach(k => { if (c.includes(k)) counts[d][k][kind]++; });
      });
    });
    const shifts = [{ k: 'M', label: 'صبح' }, { k: 'E', label: 'عصر' }, { k: 'N', label: 'شب' }];
    const kinds = [{ k: 'pro', label: 'تعداد حرفه‌ای' }, { k: 'non', label: 'تعداد غیرحرفه‌ای' }];
    const rows = [];
    shifts.forEach((sh, si) => {
      kinds.forEach((kd, ki) => {
        const cells = dayCols.map(d => `<td class="sum-count${holidays.has(d) ? ' holiday' : ''}">${F(counts[d][sh.k][kd.k])}</td>`).join('');
        const head = ki === 0
          ? `<td class="sum-shift" rowspan="2">${sh.label}</td><td class="sum-kind" colspan="5">${kd.label}</td>`
          : `<td class="sum-kind" colspan="5">${kd.label}</td>`;
        rows.push(`<tr class="sum-row sum-${kd.k}${si === 0 && ki === 0 ? ' sum-first' : ''}">${head}${cells}<td class="sum-ot"></td></tr>`);
      });
    });
    return rows.join('');
  }

  function ssPrintTableHtml(pageStaff, rowOffset, ward, fit) {
    const sc = SS.sched.schedule;
    const days = sc.days;
    const holidays = ssPrintHolidays(days);
    const dayCols = Array.from({ length: days }, (_, i) => i + 1);
    const weekdayRow = dayCols.map(d =>
      `<th class="wd">${WEEKDAY_SHORT[weekdayOf(SS.year, SS.month, d)] || ''}</th>`).join('');
    const dayRow = dayCols.map(d =>
      `<th class="daynum${holidays.has(d) ? ' holiday' : ''}">${F(d)}</th>`).join('');
    const rows = [];
    pageStaff.forEach((s, i) => {
      const cells = dayCols.map(d => {
        const code = (s.cells && s.cells[d]) || '';
        const lead = !!(s.leads && s.leads[d]);
        const cls = [code ? 'code-' + code : '', holidays.has(d) ? 'holiday' : ''].filter(Boolean).join(' ');
        return `<td class="${cls}">${e(code)}${lead ? '<span class="lead">★</span>' : ''}</td>`;
      }).join('');
      // اضافه/کسری‌کار بعد از آخرین ستونِ روز؛ مثبت با + و کسری با -.
      const ot = Number(s.overtime) || 0;
      const otCls = ot > 0 ? 'ot-pos' : (ot < 0 ? 'ot-neg' : '');
      const otText = (ot > 0 ? '+' : '') + F(ot);
      rows.push(`<tr class="staff-row">
        <td class="num">${F(rowOffset + i + 1)}</td>
        <td class="name">${e(((s.first_name || '') + ' ' + (s.last_name || '')).trim())}</td>
        <td class="pos">${e(s.position || '')}</td>
        <td class="fixed">${e(s.fixed_shift || '')}</td>
        <td class="exp">${s.years_experience == null ? '' : F(s.years_experience)}</td>
        <td class="emp">${e(s.employment_status || '')}</td>
        ${cells}
        <td class="ot ${otCls}">${otText}</td>
      </tr>`);
    });
    // نام و نام‌خانوادگی یک‌خطی چیده می‌شود (خواستهٔ کارفرما)؛ ستون نام کمی
    // پهن‌تر و قلمش کمی ریزتر است تا با ۳۱ ستون روز در یک صفحه جا شود.
    const blanks = Math.max(0, 20 - pageStaff.length);
    for (let i = 0; i < blanks; i++) {
      const n = rowOffset + pageStaff.length + i + 1;
      rows.push(`<tr class="staff-row empty">
        <td class="num">${F(n)}</td><td class="name"></td><td class="pos">—</td><td class="fixed"></td><td class="exp"></td><td class="emp"></td>
        ${dayCols.map(d => `<td class="${holidays.has(d) ? 'holiday' : ''}"></td>`).join('')}
        <td class="ot"></td>
      </tr>`);
    }
    const summary = ssPrintSummaryHtml(dayCols, holidays);
    const rowH = fit && fit.rowH ? fit.rowH : 5.3;
    const tableFont = fit && fit.tableFont ? fit.tableFont : 6.8;
    return `<table class="form-table" style="--row-h:${rowH}mm;--table-font:${tableFont}pt">
      <colgroup>
        <col class="c-num"><col class="c-name"><col class="c-pos"><col class="c-fixed"><col class="c-exp"><col class="c-emp">
        ${dayCols.map(() => '<col class="c-day">').join('')}
        <col class="c-ot">
      </colgroup>
      <thead>
        <tr class="head1">
          <th rowspan="2" class="num">ردیف</th>
          <th rowspan="2" class="name">نام و نام خانوادگی</th>
          <th rowspan="2" class="pos">سمت</th>
          <th rowspan="2" class="fixed">شیفت ثابت</th>
          <th rowspan="2" class="exp">سابقه</th>
          <th rowspan="2" class="emp">وضعیت استخدام</th>
          ${weekdayRow}
          <th rowspan="2" class="ot">اضافه کار</th>
        </tr>
        <tr class="head2">${dayRow}</tr>
      </thead>
      <tbody>${rows.join('')}${summary}</tbody>
    </table>`;
  }

  // نام سرپرستار همان بخشي که چاپ می‌شود (نه نام ثابتِ تنظیمات).
  function ssWardHeadName() {
    const staff = (SS.sched && SS.sched.staff) || [];
    const h = staff.find(s => /سرپرستار/.test(s.position || ''));
    return h ? ((h.first_name || '') + ' ' + (h.last_name || '')).trim() : '';
  }

  function ssPrintSignHtml(cfg, ward, headName) {
    const c = cfg || {};
    const training = c.training_title || 'افراد معرفی شده به کلاس‌های آموزشی:';
    const cell = (label, name) => `<div class="sign-cell">
      <div class="sign-label">${e(label)}</div>
      <div class="sign-name">${e(name)}</div>
    </div>`;
    // اگر امضاها از تنظیمات فرم بیاید (قابل ویرایش/افزودن)، همان چاپ می‌شود —
    // فقط ردیف «سرپرستار» با نامِ سرپرستارِ همین بخش و عنوان خودش جایگزین می‌شود.
    const list = (Array.isArray(c.signs) && c.signs.length ? c.signs : [
      { label: 'نام و نام خانوادگی سرپرستار ' + ward + ':', name: headName },
      { label: 'نام و نام خانوادگی سوپروایزر بالینی:', name: c.clinical_supervisor_name || '' },
      { label: 'مدیریت پرستاری بیمارستان:', name: c.nursing_manager_name || '' },
      { label: 'ریاست بیمارستان:', name: c.hospital_president_name || '' },
    ]).map(s => {
      const label = String(s.label || '');
      if (!/سرپرستار/.test(label)) return s;
      const wardHead = ssWardHeadName() || headName || '';
      return { label: label.replace(/سرپرستار[^:]*:?/, 'سرپرستار ' + ward + ':'), name: wardHead };
    });
    return `<div class="sign">
      <div class="sign-title">${e(training)}</div>
      <div class="sign-grid">${list.map(s => cell(s.label || '', s.name || '')).join('')}</div>
    </div>`;
  }

  function ssPrintPageHtml(cfg, pageStaff, rowOffset, ward, headName, fit) {
    const w = (SS.wards || []).find(x => x.title === ward);
    const beds = (cfg && cfg.beds != null) ? cfg.beds
      : (w && w.bed_count != null ? w.bed_count : (SS.wardBedCount != null ? SS.wardBedCount : 4));
    return `<section class="sheet">
      <div class="sheet-inner">
        ${ssPrintHeaderHtml(cfg, ward, beds)}
        <div class="grid-wrap">${ssPrintTableHtml(pageStaff, rowOffset, ward, fit)}</div>
        ${ssPrintSignHtml(cfg, ward, headName)}
      </div>
    </section>`;
  }

  function ssBuildPrintHtml(cfg) {
    const c = cfg || {};
    const sc = SS.sched.schedule;
    const ward = sc.ward || SS.wardTitle;
    const staff = SS.sched.staff || [];
    const headName = ssPrintHeadName(staff);
    // همهٔ پرسنل + ۶ ردیف جمع در یک برگه؛ ارتفاع سطر و اندازهٔ قلم بر اساس
    // تعداد نفرات کوچک می‌شود تا هر تعداد اسمی که باشد به صفحهٔ دوم نرود.
    const rowCount = Math.max(staff.length, 20) + 6;
    // بودجهٔ ارتفاعِ واقعیِ بدنهٔ جدول در A4 افقی (سربرگ + نوار + امضاها +
    // سرستون‌ها کم شده است). با ۲۰ ردیف اسم (۹ نفر واقعی + ۱۱ خالی) و ۶ ردیف
    // جمع، ردیف‌ها حدود ۴٫۷mm می‌شوند که برای دو خط نام کافی است.
    const rowH = Math.max(1.7, Math.min(5.2, 122 / rowCount));
    const tableFont = Math.max(2.8, Math.min(6.6, rowH * 1.34));
    const body = ssPrintPageHtml(c, staff, 0, ward, headName, { rowH, tableFont });
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
      <base href="${e((typeof location !== 'undefined' && location.origin) ? location.origin + '/' : '/')}">
      <title>برنامه درمانی ماهانه بخش ${e(ward)}</title>
      <link rel="stylesheet" href="/css/shift-print.css">
      </head><body>
      <div class="print-toolbar noprint" dir="rtl">
        <button type="button" id="ssPrintNow">چاپ</button>
        <button type="button" id="ssPrintClose">بستن</button>
      </div>
      ${body}</body></html>`;
  }
  // برای تست/پیش‌نمایش بدون باز کردن پنجرهٔ چاپ
  global.ssBuildPrintHtml = function (cfg) { return ssBuildPrintHtml(cfg || SS.printCfg || {}); };

  global.ssPrint = async function () {
    if (!SS.sched) return;
    // پنجره را پیش از هر await باز می‌کنیم؛ مرورگرهای موبایل popup بعد از await
    // را جزو ژست کاربر نمی‌دانند و بلاک می‌کنند. اگر بلاک شد، iframe پایین می‌آید.
    let win = null;
    try { win = window.open('', '_blank'); } catch (e2) { win = null; }
    if (!SS.printCfg) {
      try { SS.printCfg = (await API.shiftGetPrintConfig()).config; } catch (e2) { SS.printCfg = {}; }
    }
    const html = ssBuildPrintHtml(SS.printCfg || {});

    // 1) Top-level print window: works on desktop and mobile, unlike a hidden iframe.
    if (win) {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
        const run = () => {
          try {
            const go = () => {
              try {
                win.focus();
                win.print();
              } catch (e2) {
                if (typeof toast === 'function') toast('خطا در چاپ: ' + e2.message, true);
              }
            };
            if (win.document.fonts && win.document.fonts.ready) win.document.fonts.ready.then(() => setTimeout(go, 180));
            else setTimeout(go, 350);
          } catch (e2) { /* پنجره بسته شده */ }
        };
        // Toolbar buttons are for the case where the browser suppresses auto-print.
        setTimeout(() => {
          try {
            const b = win.document.getElementById('ssPrintNow');
            if (b) b.onclick = () => { win.focus(); win.print(); };
            const c = win.document.getElementById('ssPrintClose');
            if (c) c.onclick = () => win.close();
            win.addEventListener('afterprint', () => setTimeout(() => { try { win.close(); } catch (e2) { /* بی‌صدا */ } }, 250), { once: true });
          } catch (e2) { /* بی‌صدا */ }
        }, 60);
        if (win.document.readyState === 'complete') run();
        else win.addEventListener('load', run, { once: true });
        setTimeout(run, 1500); // safety net if load never fires
        return;
      } catch (e2) {
        try { win.close(); } catch (e3) { /* بی‌صدا */ }
      }
    }

    // 2) Fallback: the old offscreen iframe for popup-blocked desktop browsers.
    let frame = document.getElementById('ssPrintFrame');
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.id = 'ssPrintFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:297mm;height:210mm;border:0;';
    document.body.appendChild(frame);
    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; try { frame.remove(); } catch (e2) { /* بی‌صدا */ } };
    frame.onload = () => {
      const w = frame.contentWindow;
      const go = () => setTimeout(() => {
        try {
          if (!w) throw new Error('پنجرهٔ چاپ باز نشد');
          w.addEventListener('afterprint', () => setTimeout(cleanup, 150), { once: true });
          w.focus();
          w.print();
          setTimeout(cleanup, 90000);
        } catch (e2) {
          if (typeof toast === 'function') toast('خطا در چاپ: ' + e2.message, true);
          cleanup();
        }
      }, 220);
      try {
        if (w.document.fonts && w.document.fonts.ready) w.document.fonts.ready.then(go);
        else go();
      } catch (e2) { go(); }
    };
    frame.srcdoc = html;
  };

  /* ------------------------------------------------------------------
     فرم‌های کد ۵۵ / ۹۹ + فرم اورژانس بحران — فقط مدیر پرستاری
     ---------------------------------------------------------------------
     سه فرم کاغذی بیمارستان که تا امروز در سامانه نبودند. دادهٔ کد ۵۵/۹۹ از
     گرید شیفت بخش درنمی‌آید (نقش‌های تیم احیا شامل پزشک و سوپروایزر هم می‌شود)،
     پس هر خانه دستی پر و در shift_code_entries ذخیره می‌شود. فرم «اورژانس
     بحران» همان برگهٔ ماهانهٔ بخش است، فقط با کد فرمِ خودش.
     هیچ‌کدام از توابع چاپ/گرید فعلی تغییر نکرده — این بخش کاملاً جدا است.
     ------------------------------------------------------------------ */
  const CODE_ROLES = [
    { no: 1, label: 'پزشک طب اورژانس', tag: '1' },
    { no: 2, label: 'سوپروایزر', tag: '2' },
    { no: 3, label: 'تکنسین بیهوشی', tag: 'A-3' },
    { no: 4, label: 'پرستار', tag: 'B-4' },
    { no: 5, label: 'پرستار', tag: 'C-5' },
    { no: 6, label: 'پرستار', tag: 'D-6' },
  ];
  const CODE_META = {
    '55': {
      title: 'برنامه کد احیاء مامایی (کد ۵۵)',
      form_code: 'MFH-MN-FR-00/22',
      note: 'در صورت نیاز با آنکال زنان تماس گرفته شود',
      footer_note: 'شرح وظايف اعضاء: ۱- مسئول هماهنگي تيم، ۲- ناظر تيم، ۳- مسئول باز نگه‌داشتن راه هوايي، ۴- برقراري تنفس، ۵- مسئول برقراري گردش خون و ماساژ قلب، ۶- مسئول دارويي',
      signs: [
        { label: 'سوپروایزر آموزشی', name: 'فرشته ساعدی' },
        { label: 'مدیریت پرستاری', name: 'سلیمه احتسابی' },
        { label: 'ریاست بیمارستان', name: 'دکتر فرزاد سالاری' },
      ],
    },
    '99': {
      title: 'برنامه کد احیاء قلبی تنفسی (کد ۹۹)',
      form_code: 'MFH-MN-FR-00/22',
      note: '',
      footer_note: 'شرح وظايف اعضاء: ۱- مسئول هماهنگي تيم، ۲- ناظر تيم، ۳- مسئول باز نگه‌داشتن راه هوايي، ۴- برقراري تنفس، ۵- مسئول برقراري گردش خون و ماساژ قلب، ۶- مسئول دارويي',
      signs: [
        { label: 'سوپروایزر آموزشی', name: 'فرشته ساعدی' },
        { label: 'مدیریت پرستاری', name: 'سلیمه احتسابی' },
        { label: 'ریاست بیمارستان', name: 'دکتر فرزاد سالاری' },
      ],
    },
    crisis: {
      title: 'برنامه درمانی ماهانه بخش اورژانس بحران',
      form_code: 'MFH-HM-FR-00/17',
      beds: 4,
      method: 'Case Method',
      contract_hours: 158,
      level_avg: [50, 120, 550, 90, null],
      level_hours: [4, 6, 5, 5, null],
      training_title: 'افراد معرفی شده به کلاس‌های آموزشی:',
      footer_note: '',
      signs: [
        { label: 'نام و نام خانوادگی سرپرستار اورژانس', name: 'مریم بهنامی نژاد' },
        { label: 'نام و نام خانوادگی سوپروایزر بالینی', name: 'سودابه جهانگیری' },
        { label: 'مدیریت پرستاری بیمارستان', name: 'سلیمه احتسابی' },
        { label: 'ریاست بیمارستان', name: 'دکتر فرزاد سالاری' },
      ],
    },
  };
  const CODE_SHIFTS = [{ k: 'M', label: 'صبح' }, { k: 'E', label: 'عصر' }, { k: 'N', label: 'شب' }];
  // پیشنهاد نام هر نقش فقط از هم‌تخصص همان نقش — برای «پزشک» فقط پزشک‌ها.
  const CODE_ROLE_MATCH = {
    1: p => /پزشک|دکتر/.test(p),
    2: p => /سوپروایزر|سرپرستار|مسئول/.test(p),
    3: p => /بیهوشی/.test(p),
    4: p => /پرستار/.test(p) && !/کمک|بهیار/.test(p),
    5: p => /پرستار/.test(p) && !/کمک|بهیار/.test(p),
    6: p => /پرستار|بهیار|کمک/.test(p),
  };
  const CODE_WEEKDAYS = ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const CODE_ROLE_TEXT = 'شرح وظايف اعضاء: ۱- مسئول هماهنگي تيم، ۲- ناظر تيم، ۳- مسئول باز نگه‌داشتن راه هوايي، ۴- برقراري تنفس، ۵- مسئول برقراري گردش خون و ماساژ قلب، ۶- مسئول دارويي';

  SS.codeType = '99';
  SS.codeShift = 'M';
  SS.codes = null;

  // فرم‌های کاغذی بیمارستان همیشه ۳۱ ستون دارند (خواستهٔ صریح کارفرما) — چه
  // ماه ۳۰ روزه باشد چه ۲۹ روزه. گرید، چاپ و فرم‌های کد همه از همین تابع می‌خوانند.
  // تقویم واقعی برای نام روز و تعطیلات استفاده می‌شود، نه برای تعداد ستون.
  function ssJalaliDays(jy, jm) {
    // تعداد روز دقیقاً از تقویم ایران (۳۰/۳۱/۲۹)
    if (typeof toGregorian !== 'function') return jm <= 6 ? 31 : (jm <= 11 ? 30 : 29);
    const a = toGregorian(jy, jm, 1);
    const b = (jm === 12) ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1);
    const t1 = Date.UTC(a.gy, a.gm - 1, a.gd);
    const t2 = Date.UTC(b.gy, b.gm - 1, b.gd);
    return Math.round((t2 - t1) / 86400000);
  }
  function ssCodeDays() { return ssJalaliDays(SS.year, SS.month); }
  function ssPad2(n) { return String(n).padStart(2, '0'); }
  // تاریخ شمسی با رقم فارسی — دقیقاً مثل برگهٔ کاغذی
  function ssFaDate(day, month, year) { return String(year) + '/' + ssPad2(month) + '/' + ssPad2(day); }
  // قالب برگهٔ بحران: سال/ماه/روز (۱۴۰۵/۰۸/۱) — دقیقاً مثل فایل ورد
  function ssFaYmd(day, month, year) { return String(year) + '/' + ssPad2(month) + '/' + ssPad2(day); }

  // درخواست مستقیم به همان API (بدون تغییر در لایهٔ API موجود)
  async function ssCodesRequest(path, opts) {
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts || {}, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {}),
    }));
    let data = {};
    try { data = await res.json(); } catch (e2) { data = {}; }
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  function ssCodeMeta(type) {
    if (!SS.codeMeta) SS.codeMeta = {};
    return Object.assign({}, CODE_META[type] || {}, SS.codeMeta[type] || {});
  }

  async function ssLoadCodes() {
    const type = SS.codeType || '99';
    if (!SS.codeMeta) SS.codeMeta = {};
    const metaP = ssCodesRequest('/api/shift/codes/meta?type=' + encodeURIComponent(type))
      .then(r => { SS.codeMeta[type] = r.meta || {}; })
      .catch(() => { SS.codeMeta[type] = SS.codeMeta[type] || {}; });
    if (type === 'crisis') {
      await metaP;
      SS.codes = { type, year: SS.year, month: SS.month, map: {}, people: [] };
      SS.doctors = SS.doctors || [];
      return;
    }
    const res = await ssCodesRequest('/api/shift/codes?type=' + encodeURIComponent(type) +
      '&year=' + SS.year + '&month=' + SS.month);
    await metaP;
    const map = {};
    (res.entries || []).forEach(row => { map[row.day + '|' + row.shift + '|' + row.role_no] = row.person_name; });
    SS.codes = { type, year: SS.year, month: SS.month, map, people: res.people || [] };
    SS.doctors = res.doctors || SS.doctors || [];
  }

  global.ssSelectCodeType = async function (t) {
    if (!CODE_META[t] || SS.codeType === t) return;
    SS.codeType = t;
    SS.codes = null;
    ssDraw();
    try { await ssLoadCodes(); } catch (err) { if (typeof toast === 'function') toast('خطا در بارگذاری فرم: ' + err.message, true); }
    ssDraw();
  };
  global.ssSelectCodeShift = function (k) {
    if (SS.codeShift === k) return;
    SS.codeShift = k;
    ssDraw();
  };

  // ویرایش داخل خود خانه: کلیک → input با پیشنهاد نام پرسنل موجود → Enter/blur ذخیره.
  global.ssEditCodeCell = function (el, day, role) {
    if (!SS.codes || !el || el.querySelector('input')) return;
    const shift = SS.codeShift;
    const key = day + '|' + shift + '|' + role;
    const before = SS.codes.map[key] || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = before;
    input.setAttribute('list', 'ssCodePeopleList-' + role);
    input.className = 'ss-code-input';
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();
    let closed = false;
    const finish = async (save) => {
      if (closed) return;
      closed = true;
      const val = input.value.trim().slice(0, 80);
      if (!save || val === before) { ssDraw(); return; }
      try {
        await ssCodesRequest('/api/shift/codes/entry', {
          method: 'PUT',
          body: JSON.stringify({ type: SS.codeType, year: SS.year, month: SS.month, day, shift, role: role, name: val }),
        });
        if (val) SS.codes.map[key] = val; else delete SS.codes.map[key];
        // نام تازهٔ پزشک را همان‌جا به فهرست پزشکان هم اضافه کن (سرور هم این کار را می‌کند).
        if (role === 1 && val && !(SS.doctors || []).some(d => d.full_name === val)) {
          try {
            const dr = await ssCodesRequest('/api/shift/doctors');
            SS.doctors = dr.doctors || SS.doctors;
          } catch (e2) { /* فهرست بعداً بارگذاری می‌شود */ }
        }
      } catch (err) {
        if (typeof toast === 'function') toast('ذخیره نشد: ' + err.message, true);
      }
      ssDraw();
    };
    input.onblur = () => { finish(true); };
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closed = true; ssDraw(); }
    };
  };

  function ssCodesBlockHtml(from, to) {
    const map = (SS.codes && SS.codes.map) || {};
    const holidays = ssMonthHolidayMap();
    const shift = SS.codeShift;
    const days = [];
    for (let d = from; d <= to; d++) days.push(d);
    const head = days.map(d => {
      const wd = CODE_WEEKDAYS[weekdayOf(SS.year, SS.month, d)] || '';
      return `<th class="cd-day${holidays.has(d) ? ' holiday' : ''}"><div class="cd-wd">${e(wd.slice(0, 1))}</div><div>${F(d)}</div></th>`;
    }).join('');
    const rows = CODE_ROLES.map(r => {
      const cells = days.map(d => {
        const name = map[d + '|' + shift + '|' + r.no] || '';
        return `<td class="cd-cell${holidays.has(d) ? ' holiday' : ''}" onclick="ssEditCodeCell(this, ${d}, ${r.no})">${name ? e(name) : '<span class="cd-plus">+</span>'}</td>`;
      }).join('');
      const roleCell = r.no === 1
        ? `<td class="cd-role cd-role-doc" style="cursor:pointer" onclick="ssToggleDoctors(true)" title="نمایش و ویرایش فهرست پزشکان"><div>${e(r.label)}</div><div class="cd-tag">${e(r.tag)}</div></td>`
        : `<td class="cd-role"><div>${e(r.label)}</div><div class="cd-tag">${e(r.tag)}</div></td>`;
      return `<tr>${roleCell}${cells}</tr>`;
    }).join('');
    return `<div class="ss-cd-wrap">
      <table class="ss-cd-grid">
        <thead><tr><th class="cd-role">نقش</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // مثل برگهٔ چاپی: بلوک ۱–۱۵ و بلوک ۱۶ تا آخر ماه (۳۱ روزه = ۱۶ روز)
  function ssCodesGridHtml() {
    const days = ssCodeDays();    const first = ssCodesBlockHtml(1, Math.min(15, days));
    const second = days > 15 ? ssCodesBlockHtml(16, days) : '';
    return `<div class="ss-cd-blocks">${first}${second}</div>`;
  }

  /* ---------- فهرست پزشکان (جدا از پرسنل بخش‌ها) ---------- */
  function ssDoctorsPanelHtml() {
    const list = SS.doctors || [];
    return `<div class="panel g" style="margin:10px 0 14px">
      <div class="phd">${I('users', 'lg')}<div style="flex:1"><h3>فهرست پزشکان</h3>
        <div class="sub">جدا از پرسنل بخش‌ها؛ همین نام‌ها در خانه‌های نقش «پزشک طب اورژانس» پیشنهاد می‌شوند و هر نام تازه خودکار این‌جا می‌آید.</div></div>
        <button type="button" class="btn btn-o btn-sm" onclick="ssToggleDoctors(false)">بستن</button></div>
      <div class="pbody">
        <div class="docgrid">
          <div class="fg"><label for="ssDocNewName">نام پزشک</label><input id="ssDocNewName" placeholder="مثلاً د.رضایی"></div>
          <div class="fg"><label for="ssDocNewSpec">تخصص</label><input id="ssDocNewSpec" placeholder="پزشک طب اورژانس"></div>
          <div class="fg" style="align-self:end"><button type="button" class="btn btn-g btn-sm" onclick="ssAddDoctor()">${I('plus')} افزودن به فهرست</button></div>
        </div>
        ${!list.length ? '<div class="empty" style="margin-top:10px">هنوز پزشکی ثبت نشده — نام را بنویسید و «افزودن» را بزنید.</div>' : `
        <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr>
          <th>نام و نام خانوادگی</th><th>تخصص</th><th style="width:130px"></th>
        </tr></thead><tbody>
        ${list.map(d => `<tr>
          <td><input class="ss-doc-in" id="ssDocName-${e(d.id)}" value="${e(d.full_name)}"></td>
          <td><input class="ss-doc-in" id="ssDocSpec-${e(d.id)}" value="${e(d.specialty || '')}"></td>
          <td style="white-space:nowrap">
            <button type="button" class="btn btn-o btn-sm" onclick="ssSaveDoctor('${e(d.id)}')" title="ذخیره">${I('check')}</button>
            <button type="button" class="btn btn-o btn-sm" onclick="ssDeleteDoctor('${e(d.id)}')" title="حذف">${I('trash')}</button>
          </td></tr>`).join('')}
        </tbody></table></div>`}
      </div></div>`;
  }

  global.ssToggleDoctors = function (force) {
    SS.showDoctors = typeof force === 'boolean' ? force : !SS.showDoctors;
    ssDraw();
  };
  global.ssAddDoctor = async function () {
    const nameEl = $('ssDocNewName'), specEl = $('ssDocNewSpec');
    const full_name = ((nameEl && nameEl.value) || '').trim();
    if (full_name.length < 2) return toast('نام پزشک را بنویسید', true);
    try {
      const r = await ssCodesRequest('/api/shift/doctors', {
        method: 'POST',
        body: JSON.stringify({ full_name, specialty: ((specEl && specEl.value) || '').trim() }),
      });
      SS.doctors = r.doctors || SS.doctors;
      toast('پزشک به فهرست اضافه شد');
      ssDraw();
    } catch (err) { toast('اضافه نشد: ' + err.message, true); }
  };
  global.ssSaveDoctor = async function (id) {
    const nameEl = $('ssDocName-' + id), specEl = $('ssDocSpec-' + id);
    try {
      const r = await ssCodesRequest('/api/shift/doctors/' + encodeURIComponent(id), {
        method: 'PUT',
        body: JSON.stringify({ full_name: ((nameEl && nameEl.value) || '').trim(), specialty: ((specEl && specEl.value) || '').trim() }),
      });
      SS.doctors = r.doctors || SS.doctors;
      toast('نام پزشک ذخیره شد');
      ssDraw();
    } catch (err) { toast('ذخیره نشد: ' + err.message, true); }
  };
  global.ssDeleteDoctor = async function (id) {
    if (!await BTN.confirmDanger('این پزشک از فهرست حذف شود؟')) return;
    try {
      const r = await ssCodesRequest('/api/shift/doctors/' + encodeURIComponent(id), { method: 'DELETE' });
      SS.doctors = r.doctors || [];
      toast('از فهرست حذف شد');
      ssDraw();
    } catch (err) { toast('حذف نشد: ' + err.message, true); }
  };

  function ssCollectMeta() {
    const out = {};
    document.querySelectorAll('[data-meta]').forEach(el => {
      const parts = el.dataset.meta.split('.');
      let cur = out;
      parts.forEach((k, i) => {
        if (i === parts.length - 1) { cur[k] = el.value; return; }
        const nextIsIdx = /^\d+$/.test(parts[i + 1]);
        if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = nextIsIdx ? [] : {};
        cur = cur[k];
      });
    });
    return out;
  }

  global.ssSaveCodeMeta = async function () {
    if (!SS.isManager) return;
    const type = SS.codeType;
    try {
      const res = await ssCodesRequest('/api/shift/codes/meta', {
        method: 'PUT',
        body: JSON.stringify({ type, meta: ssCollectMeta() }),
      });
      if (!SS.codeMeta) SS.codeMeta = {};
      SS.codeMeta[type] = res.meta || {};
      if (typeof toast === 'function') toast('تنظیمات سربرگ/پاورقی ذخیره شد');
      ssDraw();
    } catch (err) {
      if (typeof toast === 'function') toast('ذخیره نشد: ' + err.message, true);
    }
  };

  global.ssAddSign = function () {
    if (!SS.isManager) return;
    const type = SS.codeType;
    const cur = ssCodeMeta(type);
    cur.signs = (cur.signs || []).concat([{ label: 'امضای تازه', name: '' }]);
    if (!SS.codeMeta) SS.codeMeta = {};
    SS.codeMeta[type] = cur;
    ssDraw();
  };
  global.ssRemoveSign = function (i) {
    if (!SS.isManager) return;
    const type = SS.codeType;
    const cur = ssCodeMeta(type);
    cur.signs = (cur.signs || []).filter((_, idx) => idx !== i);
    if (!SS.codeMeta) SS.codeMeta = {};
    SS.codeMeta[type] = cur;
    ssDraw();
  };

  // پیش‌نمایش فرم بحران از دادهٔ همان ماه (همان چیزی که چاپ می‌شود)
  function ssCrisisPreviewHtml() {
    const sc = SS.sched && SS.sched.schedule;
    if (!sc) return '<div class="empty">اول بخش و ماه را انتخاب کنید</div>';
    const days = sc.days || 31;
    const staff = (SS.sched.staff || []);
    const head = [];
    for (let d = 1; d <= days; d++) head.push(`<th class="cd-day">${F(d)}</th>`);
    const rows = staff.map(s => {
      const cells = [];
      for (let d = 1; d <= days; d++) {
        const code = (s.cells && s.cells[d]) || '';
        const lead = !!(s.leads && s.leads[d]);
        cells.push(`<td class="cd-cell" style="cursor:default">${e(code)}${lead ? '★' : ''}</td>`);
      }
      return `<tr><td class="cd-role"><div>${e(((s.first_name || '') + ' ' + (s.last_name || '')).trim())}</div><div class="cd-tag">${e(s.position || '')}</div></td>${cells.join('')}</tr>`;
    }).join('');
    return `<div class="ss-cd-wrap"><table class="ss-cd-grid"><thead><tr><th class="cd-role">نام و نام خانوادگی</th>${head.join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function ssCodesHtml() {
    if (!SS.isManager) {
      return `<div class="panel g noprint"><div class="empty">این فرم‌ها فقط در دسترس مدیر پرستاری است.</div></div>`;
    }
    const m = ssCodeMeta(SS.codeType);
    const isCrisis = SS.codeType === 'crisis';
    const people = (SS.codes && SS.codes.people) || [];
    const roleLists = (() => {
      const map = (SS.codes && SS.codes.map) || {};
      const lists = {};
      [1, 2, 3, 4, 5, 6].forEach(role => {
        const used = Object.keys(map).filter(k => +k.split('|')[2] === role).map(k => map[k]).filter(Boolean);
        const matched = people.filter(p => (CODE_ROLE_MATCH[role] || (() => false))(p.position || '')).map(p => p.name);
        // هر ردیف فقط هم‌سمتِ خودش را پیشنهاد می‌دهد:
        // - ردیف پزشک: فقط فهرست پزشکان (هیچ نام دیگری).
        // - ردیف‌های دیگر: پرسنل با سمتِ متناظر + نام‌های موجودِ همان ردیف، ولی
        //   پزشکان (د.) هرگز در ردیف‌های پرستاری/سوپروایزر پیشنهاد نمی‌شوند.
        const docs = role === 1 ? (SS.doctors || []).map(d => d.full_name) : [];
        const doctSet = new Set((SS.doctors || []).map(d => d.full_name));
        const extra = role === 1
          ? []
          : used.filter(n => !doctSet.has(n) && !/^\s*د\./.test(n));
        lists[role] = [...new Set(docs.concat(matched, extra))];
      });
      return lists;
    })();
    const roleDatalists = [1, 2, 3, 4, 5, 6].map(role => `<datalist id="ssCodePeopleList-${role}">${(roleLists[role] || []).map(n => `<option value="${e(n)}"></option>`).join('')}</datalist>`).join('');
    const typeBtn = (t, label) => `<button class="btn ${SS.codeType === t ? 'btn-g' : 'btn-o'} btn-sm" onclick="ssSelectCodeType('${t}')">${e(label)}</button>`;
    const shiftBtn = (s) => `<button class="btn ${SS.codeShift === s.k ? 'btn-g' : 'btn-o'} btn-sm" onclick="ssSelectCodeShift('${s.k}')">${e(s.label)}</button>`;
    const field = (label, path, val, kind) => {
      const v = val == null ? '' : String(val);
      const control = kind === 'area'
        ? `<textarea data-meta="${path}" rows="2">${e(v)}</textarea>`
        : `<input data-meta="${path}" type="${kind || 'text'}" value="${e(v)}"${kind === 'number' ? ' step="1"' : ''}>`;
      return `<label class="ss-mf"><span>${e(label)}</span>${control}</label>`;
    };
    const signFields = (m.signs || []).map((s, i) => `<div class="ss-sign-row">
        ${field('عنوان امضای ' + F(i + 1), 'signs.' + i + '.label', s.label)}
        ${field('نام امضای ' + F(i + 1), 'signs.' + i + '.name', s.name)}
        <button type="button" class="btn btn-o btn-sm ss-sign-del" onclick="ssRemoveSign(${i})" title="حذف این امضا">حذف</button>
      </div>`).join('')
      + `<div class="ss-meta-actions"><button type="button" class="btn btn-o btn-sm" onclick="ssAddSign()">${I('plus')} افزودن امضا</button></div>`;
    const metaFields = (isCrisis
      ? [
        field('عنوان فرم', 'title', m.title),
        field('کد فرم', 'form_code', m.form_code),
        field('تعداد تخت', 'beds', m.beds, 'number'),
        field('روش کار', 'method', m.method),
        field('ساعت موظفی قراردادی', 'contract_hours', m.contract_hours, 'number'),
        field('عنوان کلاس‌های آموزشی', 'training_title', m.training_title),
        [0, 1, 2, 3, 4].map(i => field('میانگین بیمار سطح ' + F(i + 1), 'level_avg.' + i, (m.level_avg || [])[i], 'number')).join(''),
        [0, 1, 2, 3, 4].map(i => field('ساعت مراقبت سطح ' + F(i + 1), 'level_hours.' + i, (m.level_hours || [])[i], 'number')).join(''),
        signFields,
      ].join('')
      : [
        field('عنوان فرم', 'title', m.title),
        field('کد فرم', 'form_code', m.form_code),
        field('یادداشت پاورقی', 'note', m.note, 'area'),
        field('شرح وظایف (پاورقی)', 'footer_note', m.footer_note, 'area'),
        signFields,
      ].join(''));

    return `<style>
      .ss-cd-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,.10); border-radius: 10px; }
      .ss-cd-blocks { display: flex; flex-direction: column; gap: 14px; }
      .ss-cd-grid { width: 100%; border-collapse: collapse; font-size: 11px; min-width: 920px; }
      .ss-cd-grid th, .ss-cd-grid td { border: 1px solid rgba(255,255,255,.08); padding: 2px 3px; text-align: center; }
      .ss-cd-grid thead th { position: sticky; top: 0; background: rgba(255,255,255,.06); font-weight: 600; }
      .ss-cd-grid td.cd-role { text-align: right; white-space: nowrap; min-width: 108px; font-size: 11px; }
      .ss-cd-grid td.cd-role .cd-tag { opacity: .6; font-size: 10px; }
      .ss-cd-grid td.cd-cell { cursor: pointer; min-width: 56px; height: 26px; }
      .ss-cd-grid td.cd-cell:hover { background: rgba(200,162,74,.18); }
      .ss-cd-grid td.cd-cell.holiday { background: rgba(255,90,90,.08); }
      .ss-cd-grid .cd-plus { opacity: .35; }
      .ss-cd-grid .cd-wd { opacity: .55; font-size: 10px; }
      .ss-cd-grid input.ss-code-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 11px;
        background: #0f172a; color: #fff; border: 1px solid #c8a24a; border-radius: 4px; padding: 2px; text-align: center; }
      .ss-meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; margin-top: 10px; }
      .ss-mf { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--td); }
      .ss-mf input, .ss-mf textarea { font-family: inherit; font-size: 12px; color: var(--tm); background: rgba(15,23,42,.5);
        border: 1px solid rgba(148,163,184,.25); border-radius: 8px; padding: 7px 9px; }
      .ss-mf textarea { resize: vertical; }
      .ss-meta-actions { display: flex; gap: 8px; margin-top: 12px; }
      .ss-sign-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; margin-top: 8px; }
      .ss-sign-del { height: 38px; }
      .ss-crisis-note { margin: 10px 0 0; font-size: 12px; color: var(--td); line-height: 1.9; }
      .ss-doc-in { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 12px; color: var(--tm);
        background: rgba(15,23,42,.5); border: 1px solid rgba(148,163,184,.25); border-radius: 8px; padding: 6px 8px; }
      .ss-cd-grid td.cd-role-doc:hover { background: rgba(200,162,74,.16); }
    </style>
    <div class="panel g noprint">
      <div class="phd">${I('print', 'lg')}<div style="flex:1"><h3>فرم‌های کد — مخصوص مدیر پرستاری</h3>
        <div class="sub">کد ۹۹ (احیا قلبی‌تنفسی)، کد ۵۵ (احیا مامایی) و فرم اورژانس بحران؛ سربرگ و پاورقی هر فرم قابل ویرایش است.</div></div></div>
      <div class="pbody" style="display:flex;gap:8px;flex-wrap:wrap">
        ${typeBtn('99', 'کد ۹۹ — احیاء قلبی تنفسی')}
        ${typeBtn('55', 'کد ۵۵ — احیاء مامایی')}
      </div>
      <div class="pbody" style="padding-top:0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${isCrisis ? '' : CODE_SHIFTS.map(shiftBtn).join('')}
        <span style="flex:1"></span>
        ${isCrisis ? '' : `<button type="button" class="btn btn-o btn-sm" onclick="ssToggleDoctors()">${I('users')} پزشکان</button>`}
        <button class="btn btn-g btn-sm" onclick="${isCrisis ? "ssPrintCrisis()" : `ssPrintCode('${SS.codeType}')`}">${I('print')} چاپ ${e(m.title)}</button>
      </div>
      <div class="pbody" style="padding-top:0">
        ${ssMonthTabsHtml()}
        ${isCrisis ? '' : `<div class="sub" style="margin:8px 0 0">روی هر خانه بزنید و نام را بنویسید؛ Enter ذخیره می‌کند و Esc لغو. هر خانه = روز + شیفت انتخابی + نقش.</div>
             <div class="sub" style="margin:8px 0 0">روی هر خانه بزنید و نام را بنویسید؛ پیشنهادها فقط از هم‌تخصص همان نقش می‌آید. Enter ذخیره می‌کند و Esc لغو.</div>
             ${roleDatalists}`}
      </div>
      ${!isCrisis && SS.showDoctors ? ssDoctorsPanelHtml() : ''}
      ${isCrisis ? `<div class="pbody" style="padding-top:0">${ssCrisisPreviewHtml()}</div>` : `<div class="pbody" style="padding-top:0">${SS.codes ? ssCodesGridHtml() : '<div class="empty">در حال بارگذاری…</div>'}</div>`}
      <div class="pbody" style="padding-top:0">
        <details class="ss-meta-box">
          <summary>تنظیمات سربرگ، پاورقی و امضاهای این فرم</summary>
          <div class="ss-meta-grid">${metaFields}</div>
          <div class="ss-meta-actions">
            <button class="btn btn-g btn-sm" onclick="ssSaveCodeMeta()">${I('check')} ذخیرهٔ تنظیمات فرم</button>
          </div>
        </details>
      </div>
    </div>`;
  }

  function ssOpenPrintWindow(html) {
    let win = null;
    try { win = window.open('', '_blank'); } catch (e2) { win = null; }
    if (win) {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
        const go = () => { try { win.focus(); win.print(); } catch (e2) { if (typeof toast === 'function') toast('خطا در چاپ: ' + e2.message, true); } };
        const arm = () => {
          try {
            const b = win.document.getElementById('ssPrintNow');
            if (b) b.onclick = go;
            const c = win.document.getElementById('ssPrintClose');
            if (c) c.onclick = () => win.close();
            win.addEventListener('afterprint', () => setTimeout(() => { try { win.close(); } catch (e2) { /* بی‌صدا */ } }, 250), { once: true });
          } catch (e2) { /* بی‌صدا */ }
        };
        const run = () => {
          arm();
          if (win.document.fonts && win.document.fonts.ready) win.document.fonts.ready.then(() => setTimeout(go, 180));
          else setTimeout(go, 350);
        };
        if (win.document.readyState === 'complete') run();
        else win.addEventListener('load', run, { once: true });
        setTimeout(run, 1500);
        return;
      } catch (e2) { try { win.close(); } catch (e3) { /* بی‌صدا */ } }
    }
    let frame = document.getElementById('ssCodePrintFrame');
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.id = 'ssCodePrintFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:297mm;height:210mm;border:0;';
    document.body.appendChild(frame);
    const cleanup = () => { try { frame.remove(); } catch (e2) { /* بی‌صدا */ } };
    frame.onload = () => {
      const w = frame.contentWindow;
      setTimeout(() => {
        try {
          if (!w) throw new Error('پنجرهٔ چاپ باز نشد');
          w.focus();
          w.print();
          setTimeout(cleanup, 90000);
        } catch (e2) { if (typeof toast === 'function') toast('خطا در چاپ: ' + e2.message, true); cleanup(); }
      }, 220);
    };
    frame.srcdoc = html;
  }

  function ssCodeSignHtml(signs) {
    const list = (Array.isArray(signs) && signs.length) ? signs : (CODE_META['99'].signs || []);
    return `<div class="cd-sign">${list.map(s => `<div><div class="lbl">${e((s && s.label) || '')}:</div><div class="nm">${e((s && s.name) || '')}</div></div>`).join('')}</div>`;
  }

  function ssBuildCodePrintHtml(type) {
    const meta = ssCodeMeta(type);
    const cfg = SS.printCfg || {};
    const hosp = (S.user && S.user.hospital_name) || '';
    const days = ssCodeDays();
    const month = SS.month, year = SS.year;
    const map = (SS.codes && SS.codes.type === type && SS.codes.map) || {};
    const monthLabel = JM[month - 1] + ' ' + F(year);
    const blocks = [[1, Math.min(15, days)]];
    if (days > 15) blocks.push([16, days]);
    const sheets = blocks.map(([from, to]) => {
      const cols = [];
      for (let d = from; d <= to; d++) cols.push(d);
      const wdRow = cols.map(d => `<th>${e(CODE_WEEKDAYS[weekdayOf(year, month, d)] || '')}</th>`).join('');
      const dateRow = cols.map(d => `<th><span class="cd-date" dir="ltr">${ssFaDate(d, month, year)}</span></th>`).join('');
      const body = CODE_SHIFTS.map(sh => CODE_ROLES.map((r, i) => {
        const cells = cols.map(d => `<td class="cd-day">${e(map[d + '|' + sh.k + '|' + r.no] || '')}</td>`).join('');
        return `<tr>${i === 0 ? `<td class="cd-shift" rowspan="6">${e(sh.label)}</td>` : ''}
          <td class="cd-role">${e(r.label)} <span class="tag">${e(r.tag)}</span></td>${cells}</tr>`;
      }).join('')).join('');
      return `<section class="cd-sheet">
        <div class="cd-top">
          <div class="cd-logo"><img src="/api/hospital/logo" alt=""></div>
          <div class="cd-head">
            <div class="hosp">${e(hosp)}</div>
            <div class="title">${e(meta.title)}</div>
            <div class="sub">ماه: <b>${e(monthLabel)}</b></div>
            <div class="sub">از تاریخ <span class="cd-date" dir="ltr">${ssFaDate(from, month, year)}</span> تا تاریخ <span class="cd-date" dir="ltr">${ssFaDate(to, month, year)}</span></div>
          </div>
          <div class="cd-code">كد فرم<br><b dir="ltr">${e(meta.form_code)}</b></div>
        </div>
        <table class="cd-table">
          <colgroup><col style="width:18mm"><col style="width:28mm">${cols.map(() => '<col>').join('')}</colgroup>
          <thead>
            <tr><th rowspan="2">شیفت</th><th>ایام هفته</th>${wdRow}</tr>
            <tr><th>مورخه / اعضاء</th>${dateRow}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <div class="cd-roles-note">${e(meta.footer_note || CODE_ROLE_TEXT)}${meta.note ? '<br>' + e(meta.note) : ''}</div>
        ${ssCodeSignHtml(meta.signs)}
      </section>`;
    }).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
      <base href="${e((typeof location !== 'undefined' && location.origin) ? location.origin + '/' : '/')}">
      <title>${e(meta.title)}</title>
      <link rel="stylesheet" href="/css/code-print.css">
      </head><body>
      <div class="print-toolbar noprint" dir="rtl">
        <button type="button" id="ssPrintNow">چاپ</button>
        <button type="button" id="ssPrintClose">بستن</button>
      </div>
      ${sheets}</body></html>`;
  }
  global.ssBuildCodePrintHtml = function (type) { return ssBuildCodePrintHtml(type || SS.codeType); };

  global.ssPrintCode = async function (type) {
    if (!SS.isManager) return;
    const wanted = CODE_META[type] ? type : SS.codeType;
    if (!SS.codes || SS.codes.type !== wanted || SS.codes.year !== SS.year || SS.codes.month !== SS.month) {
      SS.codeType = wanted;
      try { await ssLoadCodes(); } catch (err) { if (typeof toast === 'function') toast('خطا در بارگذاری فرم: ' + err.message, true); return; }
    }
    if (!SS.printCfg) { try { SS.printCfg = (await API.shiftGetPrintConfig()).config; } catch (e2) { SS.printCfg = {}; } }
    ssOpenPrintWindow(ssBuildCodePrintHtml(wanted));
  };

  function ssSignAt(signs, i) {
    return (Array.isArray(signs) && signs[i] && signs[i].name) ? signs[i].name : '';
  }

  // فرم اورژانس بحران = همان برگهٔ ماهانهٔ بخش با سربرگ/سطوح/امضای قابل ویرایش.
  global.ssPrintCrisis = async function () {
    if (!SS.isManager) return;
    if (!SS.sched) { if (typeof toast === 'function') toast('اول برنامهٔ ماه را باز کنید', true); return; }
    if (!SS.codeMeta || !SS.codeMeta.crisis) {
      try { await ssLoadCodes(); } catch (e2) { /* با پیش‌فرض‌ها چاپ می‌شود */ }
    }
    if (!SS.printCfg) { try { SS.printCfg = (await API.shiftGetPrintConfig()).config; } catch (e2) { SS.printCfg = {}; } }
    const m = ssCodeMeta('crisis');
    const cfg = Object.assign({}, SS.printCfg || {}, {
      title: m.title,
      form_code: m.form_code,
      beds: m.beds,
      contract_hours: m.contract_hours,
      care_method: m.method,
      level_avg: m.level_avg,
      level_hours: m.level_hours,
      training_title: m.training_title,
      signs: m.signs,
      clinical_supervisor_name: ssSignAt(m.signs, 1),
      nursing_manager_name: ssSignAt(m.signs, 2),
      hospital_president_name: ssSignAt(m.signs, 3),
    });
    ssOpenPrintWindow(ssBuildPrintHtml(cfg));
  };

})(window);
