/**
 * Audit trail. Every security-relevant or data-changing action is recorded
 * with who did it, what changed, and from which IP address / browser.
 */
const db = require('../db');

async function logAudit(req, {
  action, entityType = null, entityId = null, details = null, actorId,
}, trx = db) {
  try {
    await trx('audit_logs').insert({
      actor_id: actorId !== undefined ? actorId : (req && req.user ? req.user.id : null),
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details: details ? JSON.stringify(details) : null,
      ip_address: req ? (req.ip || '').slice(0, 64) : null,
      user_agent: req ? (req.get('user-agent') || '').slice(0, 255) : null,
    });
  } catch (err) {
    // Auditing must never break the main operation.
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
