/**
 * Utility functions for DB compatibility
 */
const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

function parseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return fallback;
  }
}

function safeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

module.exports = { uuid, parseJSON, safeArray };
