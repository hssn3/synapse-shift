/**
 * منبع واحد حقیقت برای دسترسی نقش‌ها به محورهای اعتباربخشی.
 *
 * پیش از این، این نگاشت فقط در public/js/app.js (سمت کلاینت) وجود داشت و بک‌اند
 * کل درخت ۵۲۰ سنجه‌ای را برمی‌گرداند و کلاینت صرفاً ردیف‌ها را پنهان می‌کرد.
 * یعنی فیلتر دسترسی قابل دور زدن بود. اکنون بک‌اند نیز با همین نگاشت فیلتر می‌کند.
 *
 * اصل حاکم: فهرست محورهای هر نقش باید دربرگیرنده‌ی همه‌ی محورهایی باشد که سنجه‌های
 * آن‌ها در ستون accreditation_sections.responsible_role به همان نقش نسبت داده شده‌اند.
 * (responsible_role فقط برای نمایش ستون «مسئول» است؛ کنترل دسترسی در سطح محور انجام می‌شود.)
 */
const ROLE_AXES = {
  // نقش‌های با دید کامل (دارای مجوز view_all_dashboards)
  admin: "*",
  hospital_admin: "*",
  quality_manager: "*",
  quality_control_manager: "*",
  hospital_president: "*",
  accreditation_manager: "*",

  // پست‌های تخصصی و مدیریتی سازمانی — منطبق بر کتاب سنجه‌های ملی
  technical_officer: ["الف-6", "الف-7", "ب-1", "ب-3", "ب-6", "ب-7", "ب-8"],
  hr_manager: ["الف-3"],
  occupational_health_officer: ["الف-2", "الف-3"],
  environmental_health_officer: ["الف-6", "ج-1"],
  nutrition_manager: ["ب-1"],
  financial_manager: ["الف-1"],
  accounting_manager: ["الف-1"],

  // کادر عالی و سرپرستی پرستاری
  nursing_director: ["الف-1", "الف-3", "الف-4", "ب-1", "ب-2", "ب-3", "ب-4", "ب-5", "ب-10", "ج-1", "ج-2"],
  education_supervisor: ["الف-1", "الف-3", "الف-4", "ب-1"],
  clinical_supervisor: ["ب-1", "ب-2", "ب-3", "ب-9", "ب-10"],
  infection_control_supervisor: ["الف-6", "ب-1", "ب-5"],
  infection_supervisor: ["الف-6", "ب-1", "ب-5"],
  head_nurse: ["ب-1", "ب-2", "الف-4"],
  breastfeeding_specialist: ["ب-4"],
  breastfeeding: ["ب-4"],

  // سایر نقش‌های پشتیبان
  safety_officer: ["الف-1", "الف-8", "ب-1"],
  env_health: ["الف-6", "ج-1"],
  equipment: ["الف-7"],
  pharmacist: ["ب-6"],
  lab_manager: ["ب-8"],
  imaging_manager: ["ب-7"],
  blood_bank: ["ب-9"],
  social_worker: ["ج-1", "ج-2"],
  him_officer: ["الف-5"],
  disaster_officer: ["الف-2"],
  hr_officer: ["الف-3"],

  // کادر بالینی پایه و گزارش‌دهنده
  staff_nurse: ["ب-1", "ب-5"],
  anonymous_reporter: [],
};

/**
 * دامنه‌ی محورهای یک کاربر. پیش‌فرض «رد» است، نه «همه»:
 * نقشی که در نگاشت نیست فقط در صورت داشتن مجوز view_all_dashboards دید کامل می‌گیرد.
 * @returns {'*'|string[]}
 */
function scopeFor(roleCode, permissions) {
  const sc = ROLE_AXES[roleCode];
  if (sc !== undefined) return sc;
  return (permissions || []).includes('view_all_dashboards') ? '*' : [];
}

/** کد محور را از کد سنجه استخراج می‌کند: «الف-4-1-3» -> «الف-4» */
function axisCodeOf(code) {
  const p = String(code || '').split('-');
  return p.length >= 2 ? p[0] + '-' + p[1] : null;
}

/**
 * آیا کاربر به یک سنجه‌ی مشخص دسترسی دارد؟ لایه‌ی دوم (دسترسی موردی) روی لایه‌ی نقش/محور.
 * قاعده: grant موردی همیشه اجازه می‌دهد؛ deny موردی همیشه رد می‌کند و بر دسترسی نقش می‌چربد.
 * @param {'*'|string[]} scope دامنه‌ی محورهای نقش
 * @param {{code:string,id:string}} measure
 * @param {{grants:Set<string>,denies:Set<string>}} ov
 */
function measureAllowed(scope, measure, ov) {
  if (ov && ov.grants && ov.grants.has(measure.id)) return true;
  if (ov && ov.denies && ov.denies.has(measure.id)) return false;
  return scope === '*' || scope.includes(axisCodeOf(measure.code));
}

module.exports = { ROLE_AXES, scopeFor, axisCodeOf, measureAllowed };
