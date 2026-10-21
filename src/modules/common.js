/**
 * Common utilities — نسخه‌ی سبک‌شده برای فقط ماژول «پرسنل و برنامه‌ی ماهانه‌ی شیفت»
 * (Project 313 — Slice)
 *
 * این فایل عمداً فقط چیزهایی را export می‌کند که ماژول شیفت به آن‌ها نیاز دارد؛
 * بقیه‌ی سرویس‌ها/ماژول‌ها از این پروژه حذف شده‌اند.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { query, db } = require('../config/database-sqlite');
const config = require('../config/app');
const {
  authRequired, requirePermission, requireAnyPermission, hospitalScope,
} = require('../middleware/auth');
const {
  jalaliYearRange, jalaliMonthRange, safeYear, toGregorian, toJalali,
  todayJalali, JMONTHS, tehranNow, tehranTodayStr, TEHRAN_OFFSET_MS,
} = require('../config/jalali');
const { logAction } = require('../middleware/audit');
const { uuid, parseJSON, safeArray } = require('../utils/db');

const docCodes = require('../services/doc-codes');

// Regex patterns
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- پرستاری ----------
function nrsCanManage(req) { return (req.user.permissions || []).includes('manage_nursing_hierarchy'); }
function nrsCanView(req) {
  const p = req.user.permissions || [];
  return p.includes('manage_nursing_hierarchy') || p.includes('view_nursing_hierarchy');
}

function headNurseWardsOf(hospitalId, userId) {
  return query(`SELECT id, title, icon, head_nurse_id, deputy1_id, deputy2_id FROM nursing_wards
    WHERE hospital_id = ? AND (head_nurse_id = ? OR deputy1_id = ? OR deputy2_id = ?)
    ORDER BY sort_order, created_at`, [hospitalId, userId, userId, userId]).rows;
}

function hnAccessWard(req, wardTitleOrId, byId) {
  const ward = byId
    ? query('SELECT * FROM nursing_wards WHERE id = ? AND hospital_id = ?', [wardTitleOrId, req.hospitalId]).rows[0]
    : query('SELECT * FROM nursing_wards WHERE title = ? AND hospital_id = ?', [wardTitleOrId, req.hospitalId]).rows[0];
  if (!ward) return { error: 'بخش یافت نشد', status: 404 };
  const uid_ = req.user.id;
  const isHead = ward.head_nurse_id === uid_;
  const isDeputy = ward.deputy1_id === uid_ || ward.deputy2_id === uid_;
  const isOverseer = nrsCanManage(req);
  if (!isHead && !isDeputy && !isOverseer) return { error: 'دسترسی ندارید', status: 403 };
  return { ward, isHead, isDeputy, isOverseer };
}

// ---------- شیفت ----------
const SHIFT_STAFF_ORDER = `CASE
    WHEN position LIKE '%مدیر پرستاری%' OR position LIKE '%مترون%' THEN 1
    WHEN position LIKE '%سوپروایزر بالینی%' THEN 2
    WHEN position LIKE '%کنترل عفونت%' THEN 3
    WHEN position LIKE '%آموزش%' THEN 4
    WHEN position LIKE '%سوپروایزر%' THEN 5
    WHEN position LIKE '%سرپرستار%' THEN 6
    WHEN position LIKE '%کمک%' OR position LIKE '%بهیار%' THEN 8
    WHEN position LIKE '%منشی%' THEN 9
    WHEN position LIKE '%پرستار%' THEN 7
    ELSE 10 END, COALESCE(sort_order, 9999), IFNULL(years_experience, -1) DESC, created_at`;

const SHIFT_STAFF_ORDER_W = SHIFT_STAFF_ORDER.replace(/\b(position|years_experience|created_at|sort_order)\b/g, 'w.$1');

const SHIFT_SETTINGS_DEFAULT = { hour_m: 7, clock_m: '07:00-14:00', hour_e: 6, clock_e: '13:00-19:00', hour_n: 12, clock_n: '19:00-07:00', hour_h: 7 };

function shiftClockHours(v) {
  const s = String(v || '').replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/[：]/g, ':');
  const m = s.match(/(\d{1,2})(?::(\d{1,2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{1,2}))?/);
  if (!m) return null;
  const start = Number(m[1]) + (Number(m[2] || 0) / 60);
  let end = Number(m[3]) + (Number(m[4] || 0) / 60);
  if (end <= start) end += 24;
  return Math.round((end - start) * 10) / 10;
}

function shiftCellHours(codes, hrs) {
  hrs = hrs || SHIFT_SETTINGS_DEFAULT;
  if (!codes) return 0;
  // مرخصی (H) معادل شیفت صبح است و در کارکرد کل جمع می‌شود.
  if (codes.includes('H')) return hrs.hour_m;
  let h = 0;
  if (codes.includes('M')) h += hrs.hour_m;
  if (codes.includes('E')) h += hrs.hour_e;
  if (codes.includes('N')) h += hrs.hour_n;
  return h;
}

function daysInJalaliMonth(jy, jm) {
  const r = jalaliMonthRange(jy, jm);
  return Math.round((new Date(r.end) - new Date(r.start)) / 86400000);
}

function shiftAccessUnit(req, title) {
  const asWard = hnAccessWard(req, title, false);
  if (!asWard.error) return asWard;
  if (asWard.status === 403 && nrsCanView(req)) {
    const w = query('SELECT id, title, icon FROM nursing_wards WHERE hospital_id = ? AND title = ?',
      [req.hospitalId, title]).rows[0];
    if (w) return { ward: w, isHead: false, isDeputy: false, isOverseer: false, isViewer: true };
  }
  const unit = query('SELECT * FROM shift_units WHERE hospital_id = ? AND title = ?',
    [req.hospitalId, title]).rows[0];
  if (!unit) return { error: 'بخش/واحد یافت نشد', status: 404 };
  if (!nrsCanManage(req)) return { error: 'دسترسی ندارید', status: 403 };
  return { ward: { id: unit.id, title: unit.title, icon: null }, isHead: false, isDeputy: false, isOverseer: true, isCustomUnit: true };
}

function getWardShiftSettings(hospitalId, ward) {
  const row = query('SELECT * FROM shift_ward_settings WHERE hospital_id = ? AND ward = ?', [hospitalId, ward]).rows[0];
  return row ? {
    hour_m: row.hour_m, clock_m: row.clock_m, hour_e: row.hour_e, clock_e: row.clock_e,
    hour_n: row.hour_n, clock_n: row.clock_n, hour_h: row.hour_h
  } : { ...SHIFT_SETTINGS_DEFAULT };
}

function parseHolidays(csv) {
  return String(csv || '').split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= 31);
}

// CRUD mount — در این برش استفاده نمی‌شود؛ فقط برای سازگاری امضای ماژول‌ها نگه داشته شده
function mountCrud() { throw new Error('mountCrud در این نسخه‌ی سبک حذف شده است'); }

module.exports = {
  express, query, db, path, fs, bcrypt, config,
  authRequired, requirePermission, requireAnyPermission, hospitalScope,
  jalaliYearRange, jalaliMonthRange, safeYear, toGregorian, toJalali, todayJalali, JMONTHS,
  tehranNow, tehranTodayStr, TEHRAN_OFFSET_MS,
  logAction, uuid, parseJSON, safeArray,
  TIME_RE, DATE_RE,
  docCodes,
  nrsCanManage, nrsCanView, headNurseWardsOf, hnAccessWard,
  SHIFT_STAFF_ORDER, SHIFT_STAFF_ORDER_W, SHIFT_SETTINGS_DEFAULT, shiftCellHours, shiftClockHours, daysInJalaliMonth,
  shiftAccessUnit, getWardShiftSettings, parseHolidays,
  mountCrud,
};
