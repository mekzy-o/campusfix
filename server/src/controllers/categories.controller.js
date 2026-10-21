/** Request categories (electricity, plumbing, furniture, ...). */
const db = require('../db');
const HttpError = require('../utils/httpError');
const { logAudit } = require('../services/audit');
const { ROLES } = require('../constants');

async function list(req, res) {
  const includeInactive = req.user.role === ROLES.ADMIN && req.query.all === 'true';
  const rows = await db('categories as c')
    .modify((q) => { if (!includeInactive) q.where('c.is_active', true); })
    .select('c.*', db.raw('(SELECT count(*) FROM service_requests sr WHERE sr.category_id = c.id)::int AS request_count'))
    .orderBy('c.name');
  res.json({ data: rows });
}

async function create(req, res) {
  const b = req.body;
  const [row] = await db('categories').insert({
    name: b.name, description: b.description, icon: b.icon, default_priority: b.defaultPriority || 'MEDIUM',
  }).returning('*');
  await logAudit(req, { action: 'CATEGORY_CREATED', entityType: 'category', entityId: row.id, details: { name: row.name } });
  res.status(201).json({ message: `Category "${row.name}" created`, data: row });
}

async function update(req, res) {
  const b = req.body;
  const [row] = await db('categories').where({ id: req.params.id }).update({
    name: b.name,
    description: b.description,
    icon: b.icon,
    default_priority: b.defaultPriority,
    is_active: b.isActive,
    updated_at: db.fn.now(),
  }).returning('*');
  if (!row) throw HttpError.notFound('Category not found');
  await logAudit(req, { action: 'CATEGORY_UPDATED', entityType: 'category', entityId: row.id, details: b });
  res.json({ message: 'Category updated', data: row });
}

/** Categories that are in use are deactivated instead of deleted. */
async function remove(req, res) {
  const row = await db('categories').where({ id: req.params.id }).first();
  if (!row) throw HttpError.notFound('Category not found');
  const used = await db('service_requests').where({ category_id: row.id }).first('id');
  if (used) {
    await db('categories').where({ id: row.id }).update({ is_active: false, updated_at: db.fn.now() });
    await logAudit(req, { action: 'CATEGORY_DEACTIVATED', entityType: 'category', entityId: row.id });
    return res.json({ message: `"${row.name}" is used by existing requests, so it was deactivated instead` });
  }
  await db('categories').where({ id: row.id }).del();
  await logAudit(req, { action: 'CATEGORY_DELETED', entityType: 'category', entityId: row.id, details: { name: row.name } });
  return res.json({ message: `Category "${row.name}" deleted` });
}

module.exports = {
  list, create, update, remove,
};
