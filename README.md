# سیناپس — نسخه‌ی سبک: پرسنل و برنامه‌ی ماهانه‌ی شیفت

این پوشه یک **برشِ مستقل** از پروژه‌ی «سیناپس» است که فقط و فقط ماژول
**«پرسنل و برنامه‌ی ماهانه‌ی شیفت»** را در خود دارد. بقیه‌ی ماژول‌ها
(اعتباربخشی، اسناد، کمیته‌ها، آموزش، شاخص‌ها، حضور شیفتی، سرپرستار و …)
به‌طور کامل حذف شده‌اند.

دو راه اجرا دارد:

1. **نسخه‌ی Node** (همین پوشه): `npm start` روی پورت ۳۰۰۰.
2. **نسخه‌ی Cloudflare Workers**: پوشه‌ی `cloudflare/` + فایل `wrangler.toml`
   (راهنمای کامل: [`cloudflare/README.md`](cloudflare/README.md)).

## وضعیت بسته و دسترسی سریع

- **نسخه‌ی آنلاین:** <https://synapse-shift.hcode016.workers.dev/?v=2#staffshift>
- **آخرین نسخه‌ی Worker:** `9a96f42b-adc2-4df5-b457-b9530eb74f96`
- **پرسنل ثبت‌شده:** ۱۱۴ نفر در ۱۳ بخش/واحد — فهرست کامل: [`docs/PERSONNEL-ROSTER-FA.md`](docs/PERSONNEL-ROSTER-FA.md)
- **ورود مدیر/سرپرستار نمونه:** `nursing_manager` (مدیر پرستاری) یا `emergency_head` (سرپرستار اورژانس) / رمز `0000`
- **توکن و مشخصات Cloudflare:** [`cloudflare/credentials.env`](cloudflare/credentials.env)
- **راهنمای کامل تحویل:** [`docs/COMPLETE-GUIDE-FA.md`](docs/COMPLETE-GUIDE-FA.md)
- **گزارش تست:** [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md)

> ⚠️ فایل `cloudflare/credentials.env` شامل توکن فعال Cloudflare است. آن را عمومی نکنید و در گیت قرار ندهید. اگر بسته را به شخص دیگری تحویل می‌دهید، توکن را از داشبورد Cloudflare باطل/جایگزین کنید.

### نصب سریع

```bash
npm install
npm start
```

سپس: <http://localhost:3000/?v=2#staffshift>

> فهرست ۱۱۴ نفره از قبل داخل `database/hospital.db` است. اگر خواستید همان فهرست را
> دوباره روی دیتابیس فعلی اعمال/همگام کنید (idempotent):

```bash
npm run import-personnel
```

## اجرا (نسخه‌ی Node)

```bash
npm start
```

سپس در مرورگر:

```
http://localhost:3000
```

- این نسخه فقط **یک بیمارستان** دارد: «بیمارستان موقوفه فاضل عراقی»؛ لوگو و سربرگ چاپ از همان لوگوی ثابت می‌آید.
- ورود کاشی‌ای: کارت «مدیر پرستاری» و کارت هر بخش. مدیر پرستاری با رمز خودش و هر بخش با رمز ورودی که مدیر پرستاری هنگام ساخت بخش تعیین کرده وارد می‌شود.
- اگر مدیر پرستاری رمزش را فراموش کرد، مالک با **مستر پسورد** (که فقط به‌صورت هش در `platform_settings` نگهداری می‌شود) وارد می‌شود و از «تغییر رمز» رمز تازه می‌گذارد.
- فقط مدیر پرستاری دکمه‌ی «افزودن بخش» را می‌بیند؛ سرپرستار هر بخش فقط بخش خودش را می‌بیند و می‌تواند پرسنل و شیفت تعریف کند.
- صفحه‌ی اصلی همان «پرسنل و برنامه‌ی شیفت» است.

## قابلیت‌های ماژول

### تب پرسنل
- افزودن/ویرایش/حذف کارکنان هر بخش: نام و نام‌خانوادگی، جنسیت، کد پرسنلی، سمت،
  **شیفت کاری ثابت (M/E/N/ME/EN یا چرخشی)**، **تاریخ شروع همکاری (شمسی)**، سابقه،
  سقف ساعت ماهانه و «اطلاعات بیشتر» اختیاری.
  - `M` صبح، `E` عصر، `N` شب
  - `ME` صبح + عصر، `EN` عصر + شب
  - تغییر شیفت ثابت از فرم یا داخل گرید، در پروفایل همان فرد ذخیره می‌شود.
- شماره‌ی موبایل از رابط کاربری حذف شده است (ستون دیتابیس دست‌نخورده مانده).
- گروه‌بندی کنار جدول: **مدیریت و سرپرستی → پرستاران → کمک‌پرستاران و بهیاران → سایر**
  (با چیپ فیلتر «نمایش گروه»؛ وقتی فیلتر فعال باشد، ردیف‌های «تعداد نفرات» فقط همان گروه را می‌شمارند).

### تب برنامه‌ی شیفت
- **چاپ فرم A4 افقی** دقیقاً با چیدمان برگه‌ی کاغذی بیمارستان: سربرگ لوگو/نام بیمارستان، جدول ۱۲ ردیفی، ستون‌های روز، سطرهای جمع، و امضاها. چاپ از یک پنجره‌ی بالادستی انجام می‌شود (نه iframe مخفی) تا روی موبایل هم دکمه‌ی چاپ کار کند.
- **ستون «اضافه کار»** بعد از آخرین روز ماه در چاپ: مقدار مثبت با `+` (سبز)، کسری با `-` (قرمز) و مقدار صفر خالی. فرمول: `مجموع ساعت شیفت‌ها − سقف ساعت ماهانه`.
- خروجی چاپ در تست اولیه با ۳۰ روز، ۹ پرسنل و ۱۵۰ خانه دقیقاً **یک صفحه A4 افقی** بود؛ ردیف‌های جمع و خالی هم ستون OT هم‌تراز دارند. ارتفاع ردیف‌ها بر اساس `max(تعداد پرسنل، ۲۰)` مقیاس می‌خورد، بنابراین افزودن پرسنل تازه تا سقف ۲۰ نفر چیدمان یک‌صفحه‌ای را حفظ می‌کند.
- گرید ماهانه (شمسی) با کدهای M/E/N و **H (مرخصی)**، تعطیلات دستی، یادداشت و
  سطرهای دلخواه سربرگ/پاورقی، تنظیم ساعت هر شیفت به‌ازای هر بخش، و
  واحدهای دلخواه (مثل «دفتر پرستاری»).
- **★ مسئول شیفتِ هر روز**: در پنجره‌ی ویرایش هر خانه، تیک «مسئول شیفتِ این روز»
  را می‌زنید؛ در هر روز فقط یک نفر مسئول است (با ست‌کردن نفر بعدی، ستاره‌ی قبلی
  خودکار برداشته می‌شود). ستاره در گرید و روی برگه‌ی چاپی دیده می‌شود.
- **ردیف‌های «تعداد نفرات» (headcount)**: برای هر روز، تعداد نفرات هر شیفت
  (M/E/N/H) هم از سرور محاسبه می‌شود و هم کلاینت بازشماری می‌کند؛ عددِ نمایش‌داده‌شده
  همیشه با گرید هم‌خوان است.
- **بررسی همگنی آقا/خانم**: دکمه‌ی اختصاصی، به‌ازای هر روز و هر شیفت (صبح/عصر/شب)
  تعداد آقا/خانم را می‌شمارد و شیفت‌های مختلط را قرمز نشان می‌دهد. فقط گزارش است
  (جلوی ذخیره‌ی برنامه را نمی‌گیرد) و کل بخش را می‌بیند.
- **چاپ شبیه برگه‌ی فرم کاغذی**: سربرگ با لوگو و کد فرم، عنوان، سطرهای راهنما،
  جدول با ستون‌های «ردیف، نام و نام‌خانوادگی، سمت، شیفت ثابت، تاریخ شروع همکاری»
  و ستون‌های روزها با سرردیف نام روز هفته، راهنمای M/E/N/H، سطر امضاها (۱ تا ۶ مورد)
  و مقیاس‌شدن خودکارِ برگه تا کاغذ A4 افقی.
- **ثبت به‌عنوان فرم کنترل‌شده**: دکمه‌ی «ثبت فرم» سند را در
  `controlled_documents` با کد فرمِ استاندارد می‌سازد و در قالب چاپ ذخیره می‌کند.

## فرم‌های کد (فقط مدیر پرستاری)

سه خروجی تازه کنار چاپ فعلی: **اورژانس بحران**، **کد ۵۵** و **کد ۹۹**.
از تب «فرم‌های کد» باز می‌شوند — تبی که فقط برای مدیر پرستاری رندر می‌شود و
سرور هم برای هر درخواست مجوز `manage_nursing_hierarchy` می‌خواهد (سرپرستار بخش ۴۰۳ می‌گیرد).

- کد ۵۵/۹۹: سه شیفت (M/E/N) × شش نقش × روزهای ماه؛ هر خانه دستی پر می‌شود و در
  `shift_code_entries` می‌ماند. پیشنهاد نام از پرسنل همان بیمارستان می‌آید.
- فرم اورژانس بحران: همان برگهٔ ماهانهٔ بخش با کد فرم `MFH-HM-FR-00/17`.
- چاپ A4 افقی؛ کد ۵۵/۹۹ دو برگ (روزهای ۱–۱۵ و ۱۶–۳۰) با سربرگ، شرح وظایف و سه امضا.

## ساختار

```
src/
  app.js                      ← سرور سبک (بوت، امنیت، استاتیک، مونت مسیرها)
  config/                     ← app / database-sqlite / jalali / paths / role-axes
  middleware/                 ← auth (JWT) / audit / security
  routes/
    auth.js                   ← session / logout / …
    entry.js                  ← ورود کاشی‌ای (انتخاب مرکز و سمت)
    site.js                   ← بیمارستان‌های عمومی، لوگو، ساعت سرور
  modules/
    common.js                 ← هلپرهای مشترک (سبک‌شده)
    clinical/
      shift-staff.routes.js       ← پرسنل شیفت + واحدها
      shift-schedule.routes.js    ← برنامه‌ی ماهانه، تنظیمات، چاپ، فرم ثبت
      shift-wards.routes.js       ← دو مسیر لازم برای فهرست بخش‌ها
cloudflare/                   ← نسخه‌ی Cloudflare Workers (ورکر تک‌فایل + D1)
  worker.js                   ← کل API روی D1 (JWT با WebCrypto، bcryptjs)
  schema.sql / seed.sql       ← اسکیمای D1 و داده (تولید با dump-sql.cjs)
  personnel-import.sql        ← افزودن افزایشی ۱۳ بخش و ۱۱۴ پرسنل به D1 موجود
  dump-sql.cjs                ← تولید schema.sql/seed.sql از دیتابیس محلی
  dev-harness.mjs             ← تست خودکار ورکر روی شیم D1 (۵۵ تست)
  dev-server.mjs              ← اجرای محلی ورکر برای تست در مرورگر
  dev-shims.mjs               ← شیم D1/ASSETS برای اجرا بدون wrangler
  README.md                   ← راهنمای دیپلوی
wrangler.toml                 ← کانفیگ Worker + D1 + assets (پوشه‌ی public)
docs/                         ← راهنمای کامل، مرجع API، گزارش تست، تغییرات
  COMPLETE-GUIDE-FA.md
  API-REFERENCE.md
  TEST-REPORT.md
  CHANGELOG.md
  PERSONNEL-ROSTER-FA.md      ← فهرست ۱۱۴ نفره بر اساس بخش و سمت
cloudflare/credentials.env    ← ⚠️ توکن فعال Cloudflare (محرمانه)
database/
  hospital.db                 ← دیتابیس SQLite (داده‌های موجود حفظ شده)
  migrate-sqlite.js           ← ساخت جداول پایه (فقط برای دیتابیس خالی)
  seed.js                     ← بیمارستان/نقش/کاربر اولیه (فقط دیتابیس خالی)
  migrate-multi-tenant.js
  migrate-roles.js
  seed-platform-settings.js
  seed-library.js
  seed-nursing-hierarchy.js   ← بخش‌های پرستاری (سرپرستار/جانشین)
  seed-shift-schedule.js      ← جداول ward_staff / shift_schedules / shift_entries (+ fixed_shift و is_lead)
  seed-shift-sample.js        ← داده‌ی نمونه‌ی برنامه (idempotent)
  import-personnel.js         ← ورود/همگام‌سازی فهرست ۱۱۴ نفره بر اساس بخش و سمت
public/
  index.html                  ← پوسته‌ی سبک (فقط همین صفحه)
  js/shell.js                 ← ورود/خروج + هلپرها + API
  js/shift-schedule.js        ← خودِ ماژول
  js/icons.js
  css/ … fonts/ … img/ …       ← img/hospital-logo.webp لوگوی ثابتِ نسخه‌ی Workers
uploads/                      ← لوگو و فایل‌های آپلودی (نسخه‌ی Node)
```

## API اصلی

- `GET /api/auth/session` و `POST /api/auth/logout`
- `GET /api/public/hospitals` و `GET /api/entry/hospital/:id/roles` و `POST /api/entry/role-login`
- `GET/POST/PUT/DELETE /api/shift/staff` و `/api/shift/units`
- `GET /api/shift/schedule` و `PUT /api/shift/schedule/note|cell|custom-rows`
- `GET/PUT /api/shift/settings` و `GET/PUT /api/shift/print-config`
- `POST /api/shift/register-form`
- `GET /api/nursing/hierarchy` و `GET /api/nursing/head/my-wards`
- `GET /api/hospital/logo` و `GET /healthz`

> توجه: پروژه‌ی اصلی («سیناپس» روی دسکتاپ) دست‌نخورده است؛ همه‌ی تغییرات فقط
> در همین پوشه انجام شده.

## اجرا روی Cloudflare (خلاصه)

```bash
npx wrangler d1 create synapse-shift          # id را در wrangler.toml بگذارید
npx wrangler d1 execute synapse-shift --local  --file=cloudflare/schema.sql
npx wrangler d1 execute synapse-shift --local  --file=cloudflare/seed.sql
npx wrangler dev                               # تست محلی
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/schema.sql
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/seed.sql
npx wrangler secret put JWT_SECRET             # یک رشته‌ی تصادفی ≥ ۳۲ کاراکتری
npx wrangler deploy
```

بدون wrangler/اینترنت هم می‌توانید ورکر را محلی تست کنید:

```bash
node cloudflare/dev-harness.mjs     # باتری تست API روی کپیِ دیتابیس
node cloudflare/dev-server.mjs 8787 # سرور محلی؛ http://localhost:8787
```
