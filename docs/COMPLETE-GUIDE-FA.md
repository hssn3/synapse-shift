# راهنمای کامل پروژه — سیناپس / برنامهٔ شیفت

> **نسخهٔ بسته:** ۱.۰.۰  
> **تاریخ بسته‌بندی:** ۲۸ مهر ۱۴۰۵ (۲۰۲۶-۱۰-۲۰)  
> **وضعیت:** آمادهٔ اجرا و تحویل؛ نسخهٔ آنلاین هم مستقر و تست شده است.

این سند راهنمای کامل تحویل پروژه است: معرفی، اجرا، ورود، امکانات، ساختار، API، دیتابیس، استقرار Cloudflare، تست‌ها، پشتیبان‌گیری، امنیت و رفع اشکال.

---

## ۱) این پروژه چیست؟

یک برش مستقل از سامانهٔ «سیناپس» است که فقط ماژول **پرسنل و برنامهٔ ماهانهٔ شیفت** را دارد. دو پیاده‌سازی مستقل اما هم‌رفتار دارد:

| نسخه | فناوری | محل اجرا | دیتابیس |
|---|---|---|---|
| Node | Node.js 22 + Express | سرور محلی/اختصاصی، پورت ۳۰۰۰ | SQLite (`database/hospital.db`) |
| Cloudflare | Cloudflare Worker تک‌فایلی | شبکهٔ Edge کلادفلر | D1 (`synapse-shift`) |

رابط کاربری، فایل‌های CSS/JS، فونت و لوگو بین دو نسخه مشترک است. منطق بک‌اند در دو فایل جدا پیاده‌سازی شده و باید در تغییرات بعدی **هر دو** به‌روزرسانی شوند:

- `src/modules/clinical/shift-staff.routes.js`
- `src/modules/clinical/shift-schedule.routes.js`
- `cloudflare/worker.js`

---

## ۲) دسترسی‌های فعلی

### نسخهٔ آنلاین (Cloudflare)

```
https://synapse-shift.hcode016.workers.dev/?v=2#staffshift
```

- Worker: `synapse-shift`
- Account ID: `05432ddda449c57cb3a4fc575c89b008`
- D1: `synapse-shift` — `fb81da92-42c0-47ac-ab4d-f0e33dc25527`
- آخرین نسخهٔ مستقرشده: `9a96f42b-adc2-4df5-b457-b9530eb74f96`
- فهرست پرسنل ثبت‌شده: **۱۱۴ نفر در ۱۳ بخش/واحد** (جزئیات: [`PERSONNEL-ROSTER-FA.md`](PERSONNEL-ROSTER-FA.md)).
- دادهٔ نمونه برنامه: آبان ۱۴۰۵، بخش اورژانس، ۹ نفرِ دارای شیفت، ۱۵۰ خانهٔ شیفت، فرم نهایی‌شده. نفر دهم اورژانس («محدثه محمدی») به فهرست پرسنل اضافه شده و در این برنامهٔ نمونه شیفتی ندارد.

### نسخهٔ محلی

```
http://127.0.0.1:3000/?v=2#staffshift
```

در زمان تحویل، سرور محلی روی پورت ۳۰۰۰ در حال اجرا بود.

### ورود

- کاربر مدیر/سرپرستار نمونه: `emergency_head`
- رمز نمونه: `0000`
- کارت «مدیر پرستاری»: کاربر `nursing_manager` با رمز `0000`
- کارت بخش «اورژانس»: سرپرستار `emergency_head` با رمز `0000`

> اگر رمز کارت‌ها در آینده عوض شد، از همان رمز جدید استفاده کنید. تغییر رمز از مسیر «تغییر رمز» در خود برنامه انجام می‌شود.

شناسه‌های کاربران نمونه (برای فراخوانی مستقیم API):

| نقش | User ID | Username |
|---|---|---|
| مدیر پرستاری | `4ee9de45-dca3-4c1d-921a-e1c631c2967c` | `nursing_manager` |
| سرپرستار اورژانس | `e2f7a3b9-6f0d-4c2e-9a51-8d3f5b1c7a90` | `emergency_head` |

---

## ۳) توکن و فایل اعتبارنامه‌ها

فایل زیر داخل همین بسته قرار دارد:

```
cloudflare/credentials.env
```

محتوای آن شامل این کلیدهاست:

```env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_D1_DATABASE_ID=...
CLOUDFLARE_D1_DATABASE_NAME=synapse-shift
CLOUDFLARE_WORKER_NAME=synapse-shift
CLOUDFLARE_WORKERS_URL=https://synapse-shift.hcode016.workers.dev
```

- توکن در زمان بسته‌بندی با endpoint رسمی `user/tokens/verify` بررسی شد و وضعیت آن **active** بود.
- شناسهٔ توکن: `325bf03294a3f588ebc5db3ae3eefb0c`
- توکن برای deploy و مدیریت Worker/D1 استفاده شده است.

> ⚠️ **هشدار امنیتی:** این توکن یک کلید فعال است. فایل `credentials.env` را در گیت‌هاب، پیام‌رسان عمومی، ایمیل گروهی یا سرور عمومی قرار ندهید. اگر بسته را به شخص دیگری می‌دهید، مطمئن شوید که قابل اعتماد است. در صورت لو رفتن، توکن را از این مسیر باطل کنید:
>
> `https://dash.cloudflare.com/profile/api-tokens`
>
> سپس توکن جدید بسازید و مقدار `CLOUDFLARE_API_TOKEN` را عوض کنید.

فایل `.env` محلی هم در بسته هست و شامل تنظیمات اجرای Node و `JWT_SECRET` محلی است. این مقدار فقط برای همان نسخهٔ محلی است؛ Secret محیط تولید Cloudflare جداست و داخل این بسته نیست.

---

## ۴) اجرای نسخهٔ Node

### پیش‌نیاز

- Node.js نسخهٔ ۲۲ یا بالاتر
- npm
- Linux/macOS یا Windows با Node سازگار

`node_modules` عمداً داخل زیپ نیست؛ چون بعضی وابستگی‌ها (مثل `better-sqlite3`) فایل باینری مخصوص سیستم‌عامل دارند. با نصب مجدد، نسخهٔ درست برای سیستم شما ساخته می‌شود.

### نصب و اجرا

```bash
cd synapse-shift-complete
npm install
npm start
```

سپس باز کنید:

```
http://localhost:3000/?v=2#staffshift
```

### تنظیمات محلی

فایل `.env`:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=...
JWT_EXPIRES_IN=...
BASE_URL=http://localhost:3000
REQUIRE_PASSWORD=1
```

اگر پورت ۳۰۰۰ اشغال است، `PORT` را در `.env` عوض کنید.

### بازسازی دیتابیس از صفر (اختیاری)

دیتابیس آمادهٔ `database/hospital.db` در بسته هست. اگر خواستید نصب تازه بسازید:

```bash
npm run init-db
npm run seed-platform-settings
npm run seed-nursing-hierarchy
npm run seed-shift-schedule
npm run seed-shift-sample
```

> `hospital.db` موجود را قبل از اجرای این دستورها بکاپ بگیرید.

---

## ۵) امکانات و رفتار فعلی

### تب پرسنل

- افزودن، ویرایش و حذف پرسنل هر بخش.
- فیلدهای نام، نام خانوادگی، جنسیت، کد پرسنلی، سمت، سابقه، سقف ساعت ماهانه، وضعیت استخدام و اطلاعات بیشتر.
- **شیفت ثابت** با گزینه‌های:
  - `M` — صبح
  - `E` — عصر
  - `N` — شب
  - `ME` — صبح + عصر
  - `EN` — عصر + شب
  - چرخشی/بدون شیفت ثابت
- تغییر شیفت ثابت از فرم ویرایش یا از سلول داخل گرید، در پروفایل همان فرد ذخیره می‌شود.
- گروه‌بندی و فیلتر گروه‌های شغلی.
- مرتب‌سازی پرسنل با drag & drop و ذخیرهٔ ترتیب در دیتابیس.

### تب برنامهٔ شیفت

- گرید ماهانهٔ شمسی با تب ماه‌ها؛ دادهٔ نمونه روی **آبان ۱۴۰۵** است.
- تعطیلات رسمی و جمعه‌ها با رنگ متمایز.
- کدهای شیفت:
  - `M` صبح
  - `E` عصر
  - `N` شب
  - `H` مرخصی
- ویرایش مستقیم خانه‌ها (inline) و انتخاب مسئول شیفت با ستاره.
- تنظیم ساعت هر شیفت برای هر بخش:
  - صبح: ۷ ساعت (۰۷:۰۰–۱۴:۰۰)
  - عصر: ۶ ساعت (۱۳:۰۰–۱۹:۰۰)
  - شب: ۱۲ ساعت (۱۹:۰۰–۰۷:۰۰)
  - مرخصی: ۷ ساعت
- محاسبهٔ تعداد نفرات هر شیفت در هر روز (M/E/N/H) و نمایش در گرید و چاپ.
- ثبت نهایی فرم با ثبت زمان، کاربر و خلاصهٔ audit.
- چاپ فرم A4 افقی در یک صفحه، با سربرگ، لوگو، جدول روزها، جمعیت شیفت‌ها و امضاها.
- نام‌ها در ستون نام به‌صورت دو خطی و وسط‌چین چاپ می‌شوند.

### ستون اضافه کار / کسری کار (آخرین تغییر)

بعد از آخرین ستون روز ماه، ستون **«اضافه کار»** اضافه شده است.

- در چیدمان راست‌به‌چپ، این ستون در سمت چپِ برگه (بعد از روز ۳۰) دیده می‌شود.
- مقدار مثبت با علامت `+` و رنگ سبز؛ مقدار منفی با `-` و رنگ قرمز.
- مقدار صفر خالی/بدون علامت نمایش داده می‌شود.
- فرمول:

```text
اضافه/کسری = مجموع ساعت‌های شیفت‌های ثبت‌شده − سقف ساعت ماهانه
```

- سقف ساعت نمونه: `۱۵۸` ساعت.
- نمونهٔ تست‌شده:
  - مریم بهنامی‌نژاد: `۲۱۰ − ۱۵۸ = +۵۲`
  - نغمه صادقی: `۱۴۰ − ۱۵۸ = −۱۸`
- ردیف‌های جمع/سربرگ، ستون اضافه‌کار خالی دارند تا تراز ستون‌ها حفظ شود.
- این ستون در خروجی پرینت هم دیده می‌شود و در تست، خروجی دقیقاً **یک صفحه A4 افقی** بود.

---

## ۶) ساختار فایل‌ها

```text
.
├── src/                         # بک‌اند Node/Express
│   ├── app.js
│   ├── config/
│   ├── middleware/
│   ├── modules/clinical/
│   │   ├── shift-staff.routes.js
│   │   ├── shift-schedule.routes.js
│   │   └── shift-wards.routes.js
│   ├── routes/
│   ├── services/
│   └── utils/
├── public/                      # رابط کاربری مشترک Node و Worker
│   ├── index.html
│   ├── js/
│   │   ├── shell.js
│   │   ├── shift-schedule.js
│   │   └── icons.js
│   ├── css/                     # از جمله shift-print.css
│   ├── fonts/
│   └── img/
├── cloudflare/                  # نسخهٔ Worker + D1
│   ├── worker.js
│   ├── schema.sql
│   ├── seed.sql
│   ├── credentials.env          # ⚠️ توکن واقعی Cloudflare
│   ├── README.md
│   ├── dev-harness.mjs
│   ├── dev-server.mjs
│   ├── dev-shims.mjs
│   ├── personnel-import.sql    # افزودن افزایشی پرسنل به D1
│   └── dump-sql.cjs
├── database/
│   ├── hospital.db              # دیتابیس SQLite محلی (snapshot)
│   ├── import-personnel.js      # ورود/همگام‌سازی فهرست ۱۱۴ نفره
│   ├── migrate-*.js
│   └── seed-*.js
├── docs/
│   ├── COMPLETE-GUIDE-FA.md     # همین راهنما
│   ├── API-REFERENCE.md
│   ├── PERSONNEL-ROSTER-FA.md   # فهرست پرسنل بر اساس بخش و سمت
│   ├── TEST-REPORT.md
│   └── CHANGELOG.md
├── uploads/
├── sample-shift-schedule.pdf    # نمونهٔ چاپ نهایی (یک صفحه A4 افقی)
├── .env                         # تنظیمات محلی Node
├── package.json
├── package-lock.json
├── wrangler.toml
└── README.md
```

---

## ۷) API اصلی

همهٔ مسیرهای محافظت‌شده با کوکی نشست کار می‌کنند. برای نسخهٔ Node می‌توان با `emergency_head / 0000` وارد شد؛ برای Worker از `role-login` استفاده کنید.

### ورود

```http
POST /api/entry/role-login
Content-Type: application/json

{ "user_id": "e2f7a3b9-6f0d-4c2e-9a51-8d3f5b1c7a90", "password": "0000" }
```

### پرسنل

```http
GET    /api/shift/staff?ward=اورژانس
POST   /api/shift/staff
PUT    /api/shift/staff/:id
DELETE /api/shift/staff/:id
PUT    /api/shift/staff-order
GET    /api/shift/units
POST   /api/shift/units
DELETE /api/shift/units/:id
```

فیلد `fixed_shift` در `PUT /api/shift/staff/:id` یکی از `M/E/N/ME/EN` یا خالی است.

### برنامهٔ شیفت

```http
GET  /api/shift/schedule?ward=اورژانس&year=1405&month=8
PUT  /api/shift/schedule/note
PUT  /api/shift/schedule/cell
PUT  /api/shift/schedule/custom-rows
POST /api/shift/finalize
```

پاسخ `GET /api/shift/schedule` شامل `schedule`، `settings`، `staff`، `headcount` و `can_edit` است. هر ردیف پرسنل `total_hours` و `overtime` هم دارد.

### تنظیمات و چاپ

```http
GET /api/shift/settings
PUT /api/shift/settings
GET /api/shift/print-config
PUT /api/shift/print-config
POST /api/shift/register-form
```

### سایر

```http
GET  /api/public/hospitals
GET  /api/entry/hospital/:id/roles
GET  /api/nursing/hierarchy
GET  /api/nursing/head/my-wards
GET  /healthz
```

جزئیات بیشتر در `src/modules/clinical/*.routes.js` و `cloudflare/worker.js` قابل مشاهده است.

---

## ۸) استقرار روی Cloudflare

### فایل‌های اصلی

- `wrangler.toml` — نام Worker، مسیر assets، اتصال D1
- `cloudflare/worker.js` — کل API
- `cloudflare/schema.sql` — اسکیمای D1
- `cloudflare/seed.sql` — دادهٔ نمونه/انتقالی
- `cloudflare/credentials.env` — توکن و شناسه‌ها

### دستور deploy با توکن داخل بسته

در Linux/macOS:

```bash
set -a
. cloudflare/credentials.env
set +a
npx wrangler deploy
```

در PowerShell:

```powershell
Get-Content cloudflare/credentials.env | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
npx wrangler deploy
```

### دستور deploy با ورود معمولی Wrangler

```bash
npx wrangler login
npx wrangler deploy
```

### به‌روزرسانی D1

```bash
# فقط اسکیما (بدون دست‌زدن به داده)
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/schema.sql

# هشدار: seed.sql داده‌ها را پاک و از نو می‌ریزد
npx wrangler d1 execute synapse-shift --remote --file=cloudflare/seed.sql
```

> `seed.sql` برای انتقال داده است و هر جدول را `DELETE` و دوباره پر می‌کند. روی محیط تولیدی که دادهٔ واقعی دارد، بدون بکاپ اجرا نکنید.

### به‌روزرسانی فایل‌های UI

بعد از تغییر در `public/` فقط کافی است دوباره deploy کنید؛ به‌خاطر `[assets]`، فایل‌ها به‌صورت خودکار آپلود می‌شوند:

```bash
npx wrangler deploy
```

### Secret تولید

`JWT_SECRET` محیط تولید یک Secret جدا در Cloudflare است و با deploy عوض نمی‌شود. اگر Worker جدیدی ساختید:

```bash
npx wrangler secret put JWT_SECRET
```

یک رشتهٔ تصادفی حداقل ۳۲ کاراکتری وارد کنید.

---

## ۹) دیتابیس محلی

- فایل اصلی: `database/hospital.db`
- نسخهٔ داخل زیپ با روش backup سازگار با WAL تهیه شده است.
- بیمارستان نمونه: «بیمارستان موقوفه فاضل عراقی»
- بخش‌ها/واحدها: ۱۳ واحد (اورژانس، کارشناسان بیهوشی، کمک اتاق عمل، CSSD، انبار، منشی اتاق عمل، کمک اورژانس، جراحی، کمک جراحی، ICU 2، ICU 1، کمک ICU، کارشناسان اتاق عمل)
- پرسنل: ۱۱۴ نفر
- برنامه‌ها:
  - شهریور ۱۴۰۵: خالی
  - آبان ۱۴۰۵: ۱۵۰ خانهٔ شیفت، نهایی‌شده (۹ نفر دارای شیفت؛ نفر دهم اورژانس بدون شیفت)
- تنظیم ساعت: M=7، E=6، N=12، H=7
- سقف ساعت: 158

### بکاپ

```bash
cp database/hospital.db database/hospital.db.backup-$(date +%F)
```

اگر سرور در حال اجراست، برای بکاپ سازگار بهتر است از SQLite backup استفاده شود:

```bash
node -e "const D=require('better-sqlite3');const d=new D('database/hospital.db',{readonly:true});d.backup('database/hospital.backup.db').then(()=>d.close())"
```

### اجرای دوبارهٔ فهرست پرسنل

```bash
npm run import-personnel
```

اسکریپت idempotent است؛ بخش‌ها/پرسنل موجود را دوباره نمی‌سازد و شیفت ثابت،
سابقه و خانه‌های شیفت را تغییر نمی‌دهد. فهرست کامل در
[`PERSONNEL-ROSTER-FA.md`](PERSONNEL-ROSTER-FA.md) آمده است.

### بازسازی schema/seed کلادفلر از دیتابیس محلی

```bash
node cloudflare/dump-sql.cjs
```

این دستور `cloudflare/schema.sql` و `cloudflare/seed.sql` را از دادهٔ فعلی می‌سازد. سپس در صورت نیاز روی D1 اجرا کنید.

---

## ۱۰) تست‌ها و نتیجهٔ اعتبارسنجی

### تست سریع سینتکس

```bash
node --check public/js/shift-schedule.js
```

### تست خودکار Worker

```bash
node cloudflare/dev-harness.mjs
```

### تست دستی نسخهٔ محلی

```bash
curl -s -c /tmp/cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"emergency_head","password":"0000"}' \
  http://127.0.0.1:3000/api/auth/login
```

### نتایج تست این نسخه

- سینتکس `shift-schedule.js`: سالم.
- ذخیرهٔ شیفت ثابت:
  - محلی: `EN → ME → EN` با کد ۲۰۰ و تأیید از `GET /api/shift/staff`.
  - تولید: `EN → ME → EN` با کد ۲۰۰ و تأیید مجدد.
- چاپ محلی:
  - ۳۰ روز، ۹ نفر، ۱۵۰ خانه.
  - ستون «اضافه کار» موجود.
  - مقادیر مثبت: `+۵۲`, `+۲۲`, `+۲۲`.
  - مقادیر منفی: `-۱۸`, `-۱۰۲`, `-۶۸`, `-۱۳`, `-۱۰۹`, `-۶۸`.
  - ردیف‌های جمع: ۶ ستون خالی هم‌تراز.
  - خروجی PDF: **۱ صفحه**، اندازهٔ A4 افقی (`841.92 × 594.96 pt`).
- چاپ تولید:
  - همان ۳۰ روز، ۹ نفر و ۱۵۰ خانه.
  - ۳ ستون اضافه‌کار مثبت و ۶ ستون منفی.
  - ۶ ردیف جمع با ستون خالی.
  - ۱ صفحه A4 افقی.
  - فرم نهایی: `2026-10-20 03:12:01` — مریم بهنامی‌نژاد.
- بررسی asset تولید:
  - `js/shift-schedule.js` شامل گزینه‌های `ME` و `EN` است.
  - CSS چاپ شامل `.c-ot`, `.ot-pos`, `.ot-neg` است.
- Worker و D1 و صفحهٔ تولید با HTTP 200 پاسخ دادند.
- پس از ورود فهرست پرسنل:
  - محلی و تولید: **۱۳ بخش/واحد** و **۱۱۴ نفر**.
  - ۱۴ سمت در لیست `shift_positions` (شامل کارشناس بیهوشی، کمک بهیار CSSD، انباردار، مسئول بخش و کارشناس اتاق عمل).
  - `node cloudflare/dev-harness.mjs`: **۵۵ قبول، ۰ رد**.
  - برنامهٔ نمونهٔ آبان ۱۴۰۵ و ۱۵۰ خانهٔ شیفت دست‌نخورده ماند؛ فقط ردیف بدون شیفتِ «محدثه محمدی» به گرید اضافه شد.

جزئیات بیشتر: `docs/TEST-REPORT.md`.

---

## ۱۱) رفع اشکال

| مشکل | علت/راه‌حل |
|---|---|
| `better-sqlite3` نصب نمی‌شود | Node را ۲۲+ کنید و `npm install` را دوباره اجرا کنید. |
| پورت ۳۰۰۰ اشغال است | `PORT` را در `.env` عوض کنید. |
| صفحهٔ سفید یا خطای JS | کنسول مرورگر را ببینید؛ کش را با `Ctrl+F5` پاک کنید و آدرس را با `?v=2` باز کنید. |
| دادهٔ ماه جدید خالی است | دادهٔ نمونه برای آبان ۱۴۰۵ است؛ از تب ماه یا دکمهٔ ماه قبل/بعد استفاده کنید. |
| چاپ چند صفحه می‌شود | در دیالوگ چاپ، A4 افقی، مقیاس ۱۰۰٪ و حاشیهٔ پیش‌فرض/None را انتخاب کنید؛ تنظیمات CSS برای یک صفحه بهینه شده است. |
| ستون اضافه‌کار در چاپ نیست | مطمئن شوید فایل‌های `public/js/shift-schedule.js` و `public/css/shift-print.css` نسخهٔ جدید هستند و کش مرورگر پاک شده است. |
| `D1_ERROR: no such table` | `schema.sql` روی همان D1 اجرا نشده است. |
| `assets binding` یا خطای ۵۰۰ ساده | بخش `[assets]` در `wrangler.toml` باید `directory = "public"` و `binding = "ASSETS"` داشته باشد. |
| ورود با رمز کار نمی‌کند | `require_password` را در `platform_settings` بررسی کنید و رمز کارت را از مدیر پرستاری بگیرید. |
| پس از deploy تغییرات دیده نمی‌شود | نسخهٔ کش مرورگر یا Service Worker قدیمی؛ با `?v=3` یا پنجرهٔ ناشناس تست کنید. |

---

## ۱۲) نکات تحویل و نگهداری

1. قبل از هر تغییر، از `database/hospital.db` و D1 بکاپ بگیرید.
2. تغییرات مشترک UI را در `public/` انجام دهید؛ هر دو نسخه از آن استفاده می‌کنند.
3. تغییرات بک‌اند را در **هر دو** `src/modules/clinical/` و `cloudflare/worker.js` اعمال کنید.
4. پس از تغییر دادهٔ محلی، `node cloudflare/dump-sql.cjs` را اجرا کنید تا `schema.sql` و `seed.sql` هم‌گام شوند.
5. قبل از انتشار، `node --check` و تست چاپ را انجام دهید.
6. توکن Cloudflare را محرمانه نگه دارید؛ در صورت تحویل بسته به شخص دیگر، توکن را rotate کنید.
7. `node_modules` را دوباره با `npm install` بسازید؛ آن را داخل گیت قرار ندهید.

---

## ۱۳) تغییرات مهم این نسخه

- افزودن گزینه‌های شیفت ثابت `ME` (صبح + عصر) و `EN` (عصر + شب) به فرم پرسنل و ویرایشگر داخل جدول.
- ذخیره‌شدن شیفت ثابت در پروفایل پرسنل.
- افزودن ستون «اضافه کار» بعد از آخرین روز ماه در چاپ.
- نمایش مقدار مثبت با `+` و مقدار منفی با `-` و رنگ‌بندی تفکیک‌شده.
- حفظ تراز ستون‌ها در ردیف‌های جمع و ردیف‌های خالی.
- اصلاح ترتیب پرسنل در نسخهٔ Node (`COALESCE(sort_order, 9999)`).
- ورود فهرست ۱۱۴ نفرهٔ پرسنل در ۱۳ بخش/واحد، همراه با ۱۴ سمت و فایل افزایشی D1.
- تولید مجدد `sample-shift-schedule.pdf` (نمونهٔ پیش از افزودن فهرست کامل) و استقرار UI جدید روی Cloudflare.

---

**پایان راهنما**
