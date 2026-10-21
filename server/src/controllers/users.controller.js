/** User management (administrator only) and officer lookup for assignment. */
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const HttpError = require('../utils/httpError');
const { getPaging, paginationMeta } = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { loadPublicUser } = require('./auth.controller');
const { ROLES, FINAL_STATUSES, STATUSES } = require('../constants');

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;

async function attachOfficerCategories(users) {
  const officerIds = users.filter((u) => u.role === ROLES.OFFICER).map((u) => u.id);
  if (officerIds.length === 0) return users;
  const rows = await db('officer_categories as oc')
    .join('categories as c', 'c.id', 'oc.category_id')
    .whereIn('oc.officer_id', officerIds)
    .select('oc.officer_id', 'c.id', 'c.name');
  return users.map((u) => ({
    ...u,
    categories: rows.filter((r) => r.officer_id === u.id).map(({ id, name }) => ({ id, name })),
  }));
}

async function setOfficerData(trx, userId, { specialisation, availability, categoryIds }) {
  await trx('officer_profiles')
    .insert({ user_id: userId, specialisation, availability: availability || 'AVAILABLE' })
    .onConflict('user_id')
    .merge({
      ...(specialisation !== undefined ? { specialisation } : {}),
      ...(availability ? { availability } : {}),
      updated_at: trx.fn.now(),
    });
  if (categoryIds) {
    await trx('officer_categories').where({ officer_id: userId }).del();
    if (categoryIds.length) {
      await trx('officer_categories').insert(categoryIds.map((id) => ({ officer_id: userId, category_id: id })));
    }
  }
}

async function list(req, res) {
  const f = req.validQuery || {};
  const paging = getPaging(f);

  const base = db('users').join('roles', 'roles.id', 'users.role_id')
    .modify((q) => {
      if (f.q) {
        const term = `%${f.q}%`;
        q.where((w) => w.whereILike('users.full_name', term)
          .orWhereILike('users.email', term)
          .orWhereILike('users.department', term)
          .orWhereILike('users.id_number', term));
      }
      if (f.role) q.where('roles.name', f.role);
      if (f.isActive) q.where('users.is_active', f.isActive === 'true');
    });

  const [{ count }] = await base.clone().count('users.id as count');
  const rows = await base.clone()
    .select('users.id', 'users.full_name', 'users.email', 'users.phone', 'users.department', 'users.id_number',
      'users.is_active', 'users.last_login_at', 'users.created_at', 'roles.name as role', 'roles.label as role_label')
    .orderBy('users.created_at', 'desc')
    .limit(paging.limit)
    .offset(paging.offset);

  res.json({ data: await attachOfficerCategories(rows), pagination: paginationMeta(Number(count), paging) });
}

async function getOne(req, res) {
  const user = await loadPublicUser(req.params.id);
  if (!user) throw HttpError.notFound('User not found');
  const [withCats] = await attachOfficerCategories([user]);
  const stats = await db('service_requests').where({ requester_id: user.id }).count('id as submitted').first();
  res.json({ data: { ...withCats, submitted_requests: Number(stats.submitted) } });
}

async function create(req, res) {
  const b = req.body;
  const exists = await db('users').whereRaw('lower(email) = ?', [b.email]).first('id');
  if (exists) throw HttpError.conflict('An account with this email already exists');
  const role = await db('roles').where({ name: b.role }).first('id');

  const id = await db.transaction(async (trx) => {
    const [row] = await trx('users').insert({
      full_name: b.fullName,
      email: b.email,
      password_hash: await bcrypt.hash(b.password, BCRYPT_ROUNDS),
      phone: b.phone,
      department: b.department,
      id_number: b.idNumber,
      role_id: role.id,
    }).returning('id');
    if (b.role === ROLES.OFFICER) {
      await setOfficerData(trx, row.id, { specialisation: b.specialisation, categoryIds: b.categoryIds || [] });
    }
    await logAudit(req, {
      action: 'USER_CREATED', entityType: 'user', entityId: row.id, details: { email: b.email, role: b.role },
    }, trx);
    return row.id;
  });

  const [user] = await attachOfficerCategories([await loadPublicUser(id)]);
  res.status(201).json({ message: `${user.full_name} added as ${user.role_label}`, data: user });
}

async function update(req, res) {
  const b = req.body;
  const user = await loadPublicUser(req.params.id);
  if (!user) throw HttpError.notFound('User not found');

  if (user.id === req.user.id && (b.isActive === false || (b.role && b.role !== ROLES.ADMIN))) {
    throw HttpError.conflict('You cannot deactivate yourself or remove your own administrator role');
  }

  const newRole = b.role || user.role;
  if (user.role === ROLES.OFFICER && newRole !== ROLES.OFFICER) {
    const open = await db('assignments as a').join('service_requests as sr', 'sr.id', 'a.request_id')
      .where({ 'a.officer_id': user.id, 'a.is_active': true })
      .whereNotIn('sr.status', [...FINAL_STATUSES, STATUSES.COMPLETED])
      .count('a.id as n').first();
    if (Number(open.n) > 0) {
      throw HttpError.conflict(`This officer still has ${open.n} open job(s). Reassign them first.`);
    }
  }

  await db.transaction(async (trx) => {
    const patch = {
      full_name: b.fullName,
      phone: b.phone,
      department: b.department,
      id_number: b.idNumber,
      is_active: b.isActive,
      updated_at: trx.fn.now(),
    };
    if (b.role) patch.role_id = (await trx('roles').where({ name: b.role }).first('id')).id;
    if (b.password) patch.password_hash = await bcrypt.hash(b.password, BCRYPT_ROUNDS);
    await trx('users').where({ id: user.id }).update(patch);

    if (newRole === ROLES.OFFICER) {
      await setOfficerData(trx, user.id, b);
    }
    // Deactivating or resetting a password ends all of the user's sessions.
    if (b.isActive === false || b.password) {
      await trx('sessions').where({ user_id: user.id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now() });
    }
    const { password, ...safe } = b;
    await logAudit(req, {
      action: b.isActive === false ? 'USER_DEACTIVATED' : 'USER_UPDATED',
      entityType: 'user',
      entityId: user.id,
      details: { ...safe, ...(password ? { passwordReset: true } : {}) },
    }, trx);
  });

  const [updated] = await attachOfficerCategories([await loadPublicUser(user.id)]);
  res.json({ message: 'User updated', data: updated });
}

/** "Delete" deactivates the account so request history stays intact. */
async function deactivate(req, res) {
  if (req.params.id === req.user.id) throw HttpError.conflict('You cannot deactivate your own account');
  const user = await db('users').where({ id: req.params.id }).first('id', 'full_name');
  if (!user) throw HttpError.notFound('User not found');
  await db('users').where({ id: user.id }).update({ is_active: false, updated_at: db.fn.now() });
  await db('sessions').where({ user_id: user.id }).whereNull('revoked_at').update({ revoked_at: db.fn.now() });
  await logAudit(req, { action: 'USER_DEACTIVATED', entityType: 'user', entityId: user.id });
  res.json({ message: `${user.full_name} has been deactivated` });
}

/** Active officers with their current workload — used by the assignment dialog. */
async function officers(req, res) {
  const { categoryId } = req.validQuery || {};
  const rows = await db('users as u')
    .join('roles as r', 'r.id', 'u.role_id')
    .leftJoin('officer_profiles as op', 'op.user_id', 'u.id')
    .where({ 'r.name': ROLES.OFFICER, 'u.is_active': true })
    .select(
      'u.id', 'u.full_name', 'u.email', 'u.phone', 'op.specialisation', 'op.availability',
      db.raw(`(SELECT count(*) FROM assignments a JOIN service_requests sr ON sr.id = a.request_id
               WHERE a.officer_id = u.id AND a.is_active AND sr.status IN ('ASSIGNED','IN_PROGRESS','ON_HOLD'))::int AS open_jobs`),
      db.raw(`(SELECT count(*) FROM assignments a JOIN service_requests sr ON sr.id = a.request_id
               WHERE a.officer_id = u.id AND a.is_active AND sr.status IN ('COMPLETED','CLOSED'))::int AS completed_jobs`),
    )
    .orderBy('u.full_name');

  const withCats = await attachOfficerCategories(rows.map((r) => ({ ...r, role: ROLES.OFFICER })));
  const data = withCats.map((o) => ({
    ...o,
    matches_category: categoryId ? o.categories.some((c) => c.id === categoryId) : undefined,
  }));
  if (categoryId) data.sort((a, b) => Number(b.matches_category) - Number(a.matches_category) || a.open_jobs - b.open_jobs);
  res.json({ data });
}

async function roles(_req, res) {
  res.json({ data: await db('roles').orderBy('id').select('id', 'name', 'label', 'description') });
}

module.exports = {
  list, getOne, create, update, deactivate, officers, roles,
};
