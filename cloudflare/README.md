# نسخه‌ی Cloudflare Workers — پرسنل و برنامه‌ی ماهانه‌ی شیفت

این پوشه همان ماژول «پرسنل و برنامه‌ی ماهانه‌ی شیفت» را به‌صورت یک
**ورکر تک‌فایلی** روی **Cloudflare Workers + D1** اجرا می‌کند؛ همان رابط
کاربری و همان APIِ نسخه‌ی Node — بدون Express، بدون better-sqlite3 و بدون
فایل‌سیستم.

## وضعیت استقرار فعلی

- URL: <https://synapse-shift.hcode016.workers.dev/?v=2#staffshift>
- Worker: `synapse-shift`
- Account ID: `05432ddda449c57cb3a4fc575c89b008`
- D1: `synapse-shift` — `fb81da92-42c0-47ac-ab4d-f0e33dc25527`
- آخرین نسخه: `9a96f42b-adc2-4df5-b457-b9530eb74f96`
- دادهٔ D1: ۱۳ بخش/واحد، ۱۱۴ پرسنل، ۳ برنامه، ۱۵۷ خانهٔ شیفت
- توکن و مشخصات اتصال: [`credentials.env`](credentials.env) — ⚠️ محرمانه

برای deploy سریع با توکن موجود:

```bash
set -a
. cloudflare/credentials.env
set +a
npx wrangler deploy
```

## این پوشه چه دارد؟

| فایل | کار |
|---|---|
| `worker.js` | کل بک‌اند: روتر، JWT (HS256 با WebCrypto)، D1 و همه‌ی مسیرهای `/api/*` |
| `schema.sql` | اسکیمای جداول روی D1 (تولیدشده از دیتابیسِ محلی — قیدها و ایندکس‌ها حفظ شده) |
| `seed.sql` | داده‌ی فعلی همان جداول (بیمارستان، نقش‌ها، کاربران، بخش‌ها، پرسنل، برنامه‌ها، سندهای کنترل‌شده) |
| `personnel-import.sql` | افزودن افزایشی ۱۱۴ پرسنل و ۱۳ بخش به D1ِ موجود، بدون پاک‌کردن برنامه‌های تولیدی |
| `dump-sql.cjs` | هر وقت داده‌ی نسخه‌ی Node عوض شد، دوباره `schema.sql`/`seed.sql` می‌سازد |
| `dev-shims.mjs` | شیم D1 (روی better-sqlite3) و ASSETS (روی پوشه‌ی `public/`) |
| `dev-harness.mjs` | باتری تست خودکار روی ورکر (ورود، نشست، پرسنل، برنامه، مسئول شیفت، تنظیمات، قالب چاپ، ثبت فرم، رمز) |
| `dev-server.mjs` | اجرای محلی ورکر روی `http://localhost:8787` برای تست در مرورگر |

فایل‌های ثابت (HTML/CSS/JS/فونت/لوگو) از پوشه‌ی `public/` خودِ پروژه سرو
می‌شوند (`wrangler.toml` بخش `[assets]`).

## فرم‌های کد ۵۵ / ۹۹ (فقط مدیر پرستاری)

- ورودی ورکر `worker-main.js` است: `worker.js` را دست‌نخورده صدا می‌زند و فقط
  مسیرهای `/api/shift/codes/*` را به `codes-api.js` می‌سپارد. اگر لازم نبود،
  مقدار `main` را در `wrangler.toml` به `cloudflare/worker.js` برگردانید.
- قبل از استفاده، مهاجرت را روی همان D1 اجرا کنید (بی‌خطر برای اجرای دوباره):

  ```bash
  npx wrangler d1 execute synapse-shift --remote --file=cloudflare/migration-shift-codes.sql
  ```

  روی محیط محلی، `node cloudflare/dev-server.mjs` خودش از `database/hospital.db`
  کپی می‌گیرد و جدول در boot نسخهٔ Node ساخته می‌شود.
- احراز هویت دوباره پیاده نشده: `codes-api.js` همان `/api/auth/session` خودِ ورکر را
  می‌پرسد و مجوز `manage_nursing_hierarchy` را چک می‌کند.

## پیش‌نیاز

- Node.js ۱۸ یا بالاتر (فقط برای نصب/اجرای wrangler و ابزارهای همین پوشه)
- حساب Cloudflare + `npx wrangler login`
- یک دیتابیس D1

## راه‌اندازی گام‌به‌گام

### ۱) ساخت D1 و گذاشتن شناسه در کانفیگ

```bash
npx wrangler d1 create synapse-shift
```

خروجی یک `database_id` می‌دهد؛ همان را در `wrangler.toml` جای
`REPLACE_WITH_YOUR_D1_DATABASE_ID` بگذارید.

### ۲) سوار کردن اسکیما و داده

روی D1 محلی (برای `wrangler dev`):

```bash
npx wrangler d1 execute synapse-shift --local  --file=cloudflare/schema.sql
npx wrangler d1 execute synapse-shift --local  --file=cloudflare/seed.sql
```

روی D1 واقعی (برای دیپلوی):

```bash
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/schema.sql
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/seed.sql
```

> `seed.sql` عمداً «بی‌خطر برای اجرای دوباره» نوشته شده: هر جدول را پاک و از
> نو پر می‌کند. روی D1 واقعی اگر داده‌ی تولیدی دارید، اول `schema.sql` را
> اجرا کنید و از `seed.sql` صرف‌نظر کنید (یا فقط برای بارگذاری اولیهٔ داده‌ی
> منتقل‌شده از نسخه‌ی Node استفاده کنید).

### ۳) رمز امضای نشست‌ها (اجباری برای محیط واقعی)

```bash
npx wrangler secret put JWT_SECRET
```

یک رشته‌ی تصادفی و طولانی (≥ ۳۲ کاراکتر) وارد کنید. مقدار داخل
`wrangler.toml` (بخش `[vars]`) فقط پیش‌فرضِ توسعه است و روی محیط واقعی باید
dump شود.

### ۴) تست محلی

- **با wrangler** (کامل، شامل D1 محلی):

  ```bash
  npx wrangler dev
  ```

- **بدون wrangler / بدون اینترنت** (با شیم‌ها؛ روی یک کپیِ موقت از
  `database/hospital.db` کار می‌کند و دیتابیس اصلی دست‌نخورده می‌ماند):

  ```bash
  node cloudflare/dev-harness.mjs             # ۵۵ تست API — همه باید PASS شوند
  node cloudflare/dev-server.mjs 8787         # سرور محلی: http://localhost:8787
  ```

  برای اجرای همین تست‌ها روی دیتابیسی که از `schema.sql`+`seed.sql` ساخته
  شده (شبیه‌سازی D1):

  ```bash
  node cloudflare/dev-harness.mjs --db <path-to-db>
  ```

  در مرورگر: `http://localhost:8787/?hospital=<شناسه‌ی‌بیمارستان>#staffshift`

### ۵) دیپلوی

```bash
npx wrangler deploy
```

آدرس `https://synapse-shift.<account>.workers.dev` را می‌دهد. اگر دامنه‌ی
اختصاصی می‌خواهید، بخش `routes` را در `wrangler.toml` اضافه کنید؛ مثلاً:

```toml
routes = [
  { pattern = "shift.example.com", custom_domain = true }
]
```

سپس مرورگر: `https://<آدرس‌شما>/?hospital=<شناسه‌ی‌بیمارستان>#staffshift`

## به‌روزرسانی داده بعد از تغییر در نسخه‌ی Node

هر وقت داده‌ی `database/hospital.db` عوض شد (پرسنل جدید، برنامه‌ی جدید، بخش جدید…):

```bash
node cloudflare/dump-sql.cjs
```

بعد دوباره `schema.sql` و `seed.sql` را روی D1 (محلی/ریموت) اجرا کنید.
اگر D1 تولیدی برنامه‌های ماهانه دارد و نمی‌خواهید پاک شوند، به‌جای `seed.sql`
فقط فایل افزایشی پرسنل را اجرا کنید:

```bash
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/personnel-import.sql
```

این فایل با `INSERT OR IGNORE` کار می‌کند و فقط بخش‌ها/پرسنل تازه را اضافه
می‌کند؛ برنامه‌ها و خانه‌های شیفت موجود دست‌نخورده می‌مانند.
اسکریپت هنگام تولید، وابستگی‌های FK را هم مرتب می‌کند:

- `hospitals.admin_user_id` و `hospitals.created_by_super_admin` و
  `users.supervisor_id` اول NULL درج می‌شوند و در پایانِ فایل با UPDATE
  مقدار واقعی می‌گیرند (چون ارجاعِ حلقه‌ای دارند).
- قیدِ `controlled_documents.section_id → accreditation_sections(id)` از
  اسکیمای D1 برداشته می‌شود چون جدولِ ماژول اعتباربخشی در این نسخه‌ی سبک
  وجود ندارد (مقدارِ ستون منتقل می‌شود، فقط قیدِ خارجی حذف است).

## لوگوی بیمارستان روی برگه‌ی چاپ

نسخه‌ی Workers پوشه‌ی `uploads/` ندارد؛ لوگو از فایل ثابت
`public/img/hospital-logo.webp` خوانده می‌شود.

- برای عوض‌کردن لوگو: همان فایل را با تصویر جدید (WebP) جایگزین کنید و
  دوباره `npx wrangler deploy` بزنید.
- اگر بیمارستان `logo_url` نداشته باشد (ستون در جدول `hospitals`)، هر دو
  مسیرِ لوگو ۴۰۴ می‌دهند و سربرگ چاپ بدون لوگو بالا می‌آید.

## تفاوت‌های عمدی با نسخه‌ی Node

- نشست‌ها استاتلس‌اند (JWT در کوکی `sid`): بلاک‌لیستِ logout و `audit_log`
  در ورکر لازم نیست؛ خروج یعنی پاک‌شدن کوکی.
- ورود با رمز (bcrypt) کار می‌کند (`bcryptjs` همراه باندل می‌شود و
  `nodejs_compat` در `wrangler.toml` روشن است). اگر
  `platform_settings.require_password` برابر `1` باشد، کاشی‌ها رمز می‌خواهند؛
  وگرنه مثل نسخه‌ی Node ورود سریع است.
- فایل آپلود (مثل پیوست سند) وجود ندارد؛ برای این ماژول هم لازم نیست.
- ساعت/تاریخ‌ها با منطقه‌ی زمانی تهران (+۰۳:۳۰) محاسبه می‌شوند تا با نسخه‌ی
  Node یکی باشند.

## رفع اشکال

| نشانه | علت و راه‌حل |
|---|---|
| `D1_ERROR: no such table` | `schema.sql` (و بعد `seed.sql`) روی همان D1 اجرا نشده. |
| `assets binding` یا صفحه‌ی ۵۰۰ ساده | بخش `[assets]` در `wrangler.toml` حذف/خراب شده؛ باید `directory = "public"` و `binding = "ASSETS"` باشد. |
| بوت‌شدن مداوم به صفحه‌ی ورود | کوکی روی `http` با پرچم `Secure` ذخیره نمی‌شود؛ در ورکر پرچم بر اساس پروتکل درخواست ست می‌شود. روی دامنه‌ی `https` مشکلی نیست. |
| `Invalid or unexpected token` هنگام deploy | ورکر را با `npx wrangler deploy` (نه با `node`) اجرا کنید؛ `worker.js` یک ماژول ES است. |
| داده‌ی ماه جدید خالی است | داده‌ی نمونه برای **شهریور ۱۴۰۵** است؛ ماه جاری (مهر ۱۴۰۵) طبعاً خالی است — با دکمه‌ی «ماه قبل» ببینید. |
