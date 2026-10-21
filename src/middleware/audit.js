/**
 * Audit log middleware - SQLite compatible
 */
const { query } = require('../config/database-sqlite');
const { uuid } = require('../utils/db');

async function logAction({ hospitalId, userId, action, targetTable = null, targetId = null, oldValue = null, newValue = null, ipAddress = null }) {
  try {
    query(
      `INSERT INTO audit_log (id, hospital_id, user_id, action, target_table, target_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), hospitalId, userId, action, targetTable, targetId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress]
    );
  } catch (err) {
    console.error('[Audit] Failed:', err.message);
  }
}

function auditLog(action) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
      if (res.statusCode < 400 && req.user) {
        logAction({ hospitalId: req.user.hospital_id, userId: (req.previewAdmin && req.previewAdmin.id) || req.user.id, action, ipAddress: req.ip }).catch(() => {});
      }
      originalSend.call(this, body);
    };
    next();
  };
}

module.exports = { logAction, auditLog };
