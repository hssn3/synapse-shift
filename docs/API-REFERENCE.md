# مرجع API

این سند خلاصهٔ مسیرهای API است. پیاده‌سازی مرجع:

- Node: `src/modules/clinical/*.routes.js`
- Cloudflare: `cloudflare/worker.js`

احراز هویت با کوکی نشست (`sid`) انجام می‌شود. برای تست با `curl` از `-c` و `-b` استفاده کنید.

---

## ورود و نشست

### `GET /api/entry/require-password`

بررسی اینکه رمز کارت‌ها لازم است یا نه.

### `GET /api/entry/hospital/:id/roles`

فهرست نقش‌ها/کاشی‌های قابل ورود برای بیمارستان.

### `POST /api/entry/role-login`

```json
{
  "user_id": "e2f7a3b9-6f0d-4c2e-9a51-8d3f5b1c7a90",
  "password": "0000"
}
```

### `GET /api/auth/session`

بررسی نشست فعلی.

### `POST /api/auth/logout`

خروج و پاک‌کردن کوکی.

### `POST /api/auth/change-password`

```json
{
  "current_password": "0000",
  "new_password": "رمز-جدید"
}
```

---

## پرسنل

### `GET /api/shift/staff?ward=اورژانس`

خروجی شامل آرایهٔ `staff` است. فیلدهای مهم:

- `id`
- `first_name`, `last_name`
- `gender`
- `position`
- `employment_status`
- `years_experience`
- `monthly_hour_quota`
- `fixed_shift` — یکی از `M/E/N/ME/EN` یا خالی
- `sort_order`

### `POST /api/shift/staff`

```json
{
  "ward": "اورژانس",
  "first_name": "نام",
  "last_name": "نام خانوادگی",
  "gender": "زن",
  "position": "پرستار",
  "employment_status": "قراردادی",
  "years_experience": 5,
  "monthly_hour_quota": 158,
  "fixed_shift": "ME"
}
```

### `PUT /api/shift/staff/:id`

مانند ساخت، همراه با فیلدهای قابل ویرایش. برای تغییر فقط شیفت ثابت هم باید بدنهٔ کامل پرسنل فرستاده شود.

### `DELETE /api/shift/staff/:id`

حذف پرسنل.

### `GET /api/shift/positions`

فهرست سمت‌های قابل انتخاب (پیش‌فرض ۱۴ سمت، شامل کارشناس بیهوشی، کمک بهیار CSSD، انباردار، مسئول بخش و کارشناس اتاق عمل).

### `PUT /api/shift/positions`

```json
{
  "positions": ["سرپرستار", "پرستار", "کمک بهیار", "کارشناس اتاق عمل"]
}
```

فقط مدیر پرستاری.

### `PUT /api/shift/staff-order`

```json
{ "ward": "اورژانس", "ids": ["id-1", "id-2", "id-3"] }
```

### واحدها

```http
GET    /api/shift/units?ward=اورژانس
POST   /api/shift/units
DELETE /api/shift/units/:id
```

---

## برنامهٔ شیفت

### `GET /api/shift/schedule?ward=اورژانس&year=1405&month=8`

پاسخ:

```json
{
  "schedule": {
    "ward": "اورژانس",
    "jalali_year": 1405,
    "jalali_month": 8,
    "days": 30,
    "note": "...",
    "holidays": [],
    "custom_rows": [],
    "finalized_at": "...",
    "finalized_by": "...",
    "finalized_by_name": "...",
    "audit": {}
  },
  "settings": {
    "hour_m": 7,
    "hour_e": 6,
    "hour_n": 12,
    "hour_h": 7
  },
  "staff": [
    {
      "id": "...",
      "first_name": "...",
      "last_name": "...",
      "fixed_shift": "ME",
      "total_hours": 210,
      "monthly_hour_quota": 158,
      "overtime": 52,
      "cells": { "1": "M", "2": "M" },
      "leads": { "1": true }
    }
  ],
  "headcount": {
    "1": { "M": 2, "E": 2, "N": 1, "H": 0 }
  },
  "can_edit": true
}
```

### `PUT /api/shift/schedule/cell`

```json
{
  "ward": "اورژانس",
  "year": 1405,
  "month": 8,
  "staff_id": "...",
  "day": 1,
  "code": "M",
  "is_lead": false
}
```

`code` می‌تواند `M/E/N/H` یا خالی باشد.

### `PUT /api/shift/schedule/note`

```json
{ "ward": "اورژانس", "year": 1405, "month": 8, "note": "یادداشت" }
```

### `PUT /api/shift/schedule/custom-rows`

ویرایش سطرهای دلخواه سربرگ/پاورقی.

### `POST /api/shift/finalize`

ثبت نهایی فرم همراه با audit.

---

## تنظیمات و چاپ

```http
GET /api/shift/settings?ward=اورژانس
PUT /api/shift/settings
GET /api/shift/print-config
PUT /api/shift/print-config
POST /api/shift/register-form
```

نمونهٔ تنظیمات:

```json
{
  "ward": "اورژانس",
  "hour_m": 7,
  "clock_m": "07:00-14:00",
  "hour_e": 6,
  "clock_e": "13:00-19:00",
  "hour_n": 12,
  "clock_n": "19:00-07:00",
  "hour_h": 7
}
```

---

## سایر

```http
GET /api/public/hospitals
GET /api/public/hospital/:id/logo
GET /api/hospital/logo
GET /api/server-time
GET /api/nursing/hierarchy
GET /api/nursing/head/my-wards
GET /healthz
```

---

## نمونهٔ curl

```bash
# ورود
curl -s -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"emergency_head","password":"0000"}' \
  http://127.0.0.1:3000/api/auth/login

# پرسنل
curl -s -b cookies.txt \
  'http://127.0.0.1:3000/api/shift/staff?ward=%D8%A7%D9%88%D8%B1%DA%98%D8%A7%D9%86%D8%B3'

# برنامهٔ آبان ۱۴۰۵
curl -s -b cookies.txt \
  'http://127.0.0.1:3000/api/shift/schedule?ward=%D8%A7%D9%88%D8%B1%DA%98%D8%A7%D9%86%D8%B3&year=1405&month=8'
```

> برای Worker، `POST /api/auth/login` را با `POST /api/entry/role-login` و `user_id` جایگزین کنید.
