/**
 * Query helpers for service requests, shared by the requests controller and
 * the reports/export controller so filtering behaves identically everywhere.
 */
const db = require('../db');
const { ROLES, REQUESTER_ROLES } = require('../constants');

/** Restricts a query to the requests the given user is allowed to see. */
function applyVisibility(query, user) {
  if (REQUESTER_ROLES.includes(user.role)) {
    query.where('sr.requester_id', user.id);
  } else if (user.role === ROLES.OFFICER) {
    query.whereExists(
      db('assignments as va')
        .whereRaw('va.request_id = sr.id')
        .where({ 'va.officer_id': user.id, 'va.is_active': true }),
    );
  }
  // ADMIN sees everything.
  return query;
}

/** Applies search / filter options from the validated query string. */
function applyFilters(query, f = {}) {
  if (f.q) {
    const term = `%${f.q}%`;
    query.where((w) => w
      .whereILike('sr.title', term)
      .orWhereILike('sr.description', term)
      .orWhereILike('sr.reference', term)
      .orWhereILike('sr.location', term)
      .orWhereILike('requester.full_name', term));
  }
  if (f.status && f.status.length) query.whereIn('sr.status', f.status);
  if (f.categoryId) query.where('sr.category_id', f.categoryId);
  if (f.priority) query.where('sr.priority', f.priority);
  if (f.officerId) query.where('cur.officer_id', f.officerId);
  if (f.from) query.where('sr.created_at', '>=', f.from);
  if (f.to) {
    const end = new Date(f.to);
    end.setHours(23, 59, 59, 999);
    query.where('sr.created_at', '<=', end);
  }
  return query;
}

/** Base list query with the joins every listing needs. */
function baseListQuery() {
  return db('service_requests as sr')
    .join('categories as c', 'c.id', 'sr.category_id')
    .join('users as requester', 'requester.id', 'sr.requester_id')
    .leftJoin('assignments as cur', function joinActive() {
      this.on('cur.request_id', '=', 'sr.id').andOn('cur.is_active', '=', db.raw('true'));
    })
    .leftJoin('users as officer', 'officer.id', 'cur.officer_id');
}

const LIST_COLUMNS = [
  'sr.id', 'sr.reference', 'sr.title', 'sr.location', 'sr.room', 'sr.priority', 'sr.status',
  'sr.created_at', 'sr.updated_at', 'sr.completed_at', 'sr.closed_at', 'sr.rating',
  'c.id as category_id', 'c.name as category_name', 'c.icon as category_icon',
  'requester.id as requester_id', 'requester.full_name as requester_name',
  'officer.id as officer_id', 'officer.full_name as officer_name',
];

const PRIORITY_ORDER = db.raw(
  "CASE sr.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END",
);

function applySort(query, sort) {
  switch (sort) {
    case 'oldest': return query.orderBy('sr.created_at', 'asc');
    case 'priority': return query.orderBy(PRIORITY_ORDER).orderBy('sr.created_at', 'desc');
    case 'updated': return query.orderBy('sr.updated_at', 'desc');
    default: return query.orderBy('sr.created_at', 'desc');
  }
}

module.exports = {
  applyVisibility, applyFilters, baseListQuery, applySort, LIST_COLUMNS,
};
