/** Read-only access to the audit trail (administrators only). */
const db = require('../db');
const { getPaging, paginationMeta } = require('../utils/pagination');

async function list(req, res) {
  const f = req.validQuery || {};
  const paging = getPaging(f, { defaultLimit: 20 });

  const base = db('audit_logs as al')
    .leftJoin('users as u', 'u.id', 'al.actor_id')
    .leftJoin('roles as r', 'r.id', 'u.role_id')
    .modify((q) => {
      if (f.action) q.where('al.action', f.action);
      if (f.actorId) q.where('al.actor_id', f.actorId);
      if (f.entityType) q.where('al.entity_type', f.entityType);
      if (f.from) q.where('al.created_at', '>=', f.from);
      if (f.to) {
        const end = new Date(f.to);
        end.setHours(23, 59, 59, 999);
        q.where('al.created_at', '<=', end);
      }
    });

  const [{ count }] = await base.clone().count('al.id as count');
  const rows = await base.clone()
    .select('al.*', 'u.full_name as actor_name', 'u.email as actor_email', 'r.label as actor_role')
    .orderBy('al.created_at', 'desc')
    .limit(paging.limit)
    .offset(paging.offset);

  const actions = await db('audit_logs').distinct('action').orderBy('action').pluck('action');
  res.json({ data: rows, actions, pagination: paginationMeta(Number(count), paging) });
}

module.exports = { list };
