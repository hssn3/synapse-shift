/**
 * Migration + Seed: تنظیمات سراسری پلتفرم — فعلاً فقط «پسورد اجباری برای ورود سریع با کلیک روی سمت».
 *
 * قاعده‌ی این تنظیم، به‌خواستِ صریح مالک سامانه:
 *
 *   ۱) روی نصب تازه پیش‌فرض **خاموش** است — هیچ سمتی رمز نمی‌خواهد.
 *   ۲) به‌محض اینکه سوپرادمین از پنل خودش روشن/خاموشش کرد، همان انتخاب می‌ماند و
 *      این اسکریپت **هرگز** آن را بازنویسی نمی‌کند.
 *
 * نکته‌ی مهم درباره‌ی REQUIRE_PASSWORD: این متغیر فقط پیش‌فرضِ نصبِ تازه را تعیین
 * می‌کند، نه بیشتر. پیش‌تر این‌طور نوشته شده بود که در هر بوت مقدار ذخیره‌شده را
 * بازنویسی کند؛ نتیجه‌اش این می‌شد که اگر سوپرادمین رمز را روشن می‌کرد، اولین
 * ری‌استارت بی‌صدا خاموشش می‌کرد. تنظیمی که کاربر خودش انتخاب کرده متعلق به اوست.
 *
 * Run: idempotent است و روی هر boot امن اجرا می‌شود.
 */
const { db } = require('../src/config/database-sqlite');

// پیش‌فرضِ نصب تازه. خاموش، مگر اینکه استقرار صریحاً REQUIRE_PASSWORD=1 بدهد.
function defaultRequirePassword() {
  return process.env.REQUIRE_PASSWORD === '1' ? '1' : '0';
}

function runMigration() {
  console.log('[Seed Platform Settings] Starting...');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    const get = key => db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key);
    const set = (key, value) => db.prepare(
      'INSERT INTO platform_settings (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value);

    // فقط اگر کلید اصلاً وجود نداشته باشد مقدار می‌گیرد. وجود داشته باشد یعنی
    // یا قبلاً همین‌جا ساخته شده یا سوپرادمین تغییرش داده — در هر دو حالت دست‌نخورده می‌ماند.
    const row = get('require_password');
    if (!row) {
      const def = defaultRequirePassword();
      set('require_password', def);
      console.log(`[Seed Platform Settings] require_password روی پیش‌فرض «${def}» تنظیم شد`);
    } else {
      console.log(`[Seed Platform Settings] require_password = «${row.value}» (انتخاب سوپرادمین، دست‌نخورده)`);
    }

    // تمِ روشن — خواسته‌ی صریح مالک سامانه: «کلاً تم روشن غیرفعال باشه مگر سوپرادمین
    // فعالش کنه، همیشه تم تیره باشه». همان قاعده‌ی require_password: روی نصب تازه
    // خاموش، و به‌محض تغییر توسط سوپرادمین برای همیشه دست‌نخورده می‌ماند.
    const lt = get('light_theme_enabled');
    if (!lt) {
      set('light_theme_enabled', '0');
      console.log('[Seed Platform Settings] light_theme_enabled روی پیش‌فرض «0» (خاموش) تنظیم شد');
    } else {
      console.log(`[Seed Platform Settings] light_theme_enabled = «${lt.value}» (انتخاب سوپرادمین، دست‌نخورده)`);
    }

    console.log('[Seed Platform Settings] ✅ platform_settings ready');
  } catch (err) {
    console.error('[Seed Platform Settings] ❌ Failed:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigration();
  process.exit(0);
}

module.exports = { runMigration };
