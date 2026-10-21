/**
 * Service requests: full CRUD, workflow (status changes), assignment to
 * maintenance officers, comments and evidence images.
 */
const db = require('../db');
const HttpError = require('../utils/httpError');
const { getPaging, paginationMeta } = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { notifyUsers, notifyAdmins } = require('../services/notify');
const { emitToUsers, emitToRole } = require('../realtime');
const {
  ROLES, REQUESTER_ROLES, STATUSES, FINAL_STATUSES, TRANSITIONS,
} = require('../constants');
const {
  applyVisibility, applyFilters, baseListQuery, applySort, LIST_COLUMNS,
} = require('../services/requestQueries');

const STATUS_LABELS = {
  PENDING: 'Pending', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', ON_HOLD: 'On hold',
  COMPLETED: 'Completed', CLOSED: 'Closed', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
};

const isRequester = (user) => REQUESTER_ROLES.includes(user.role);

/** Loads a request the user may see, or throws 404 (never reveals other users' requests). */
async function findVisibleRequest(id, user) {
  const query = baseListQuery()
    .where('sr.id', id)
    .first([...LIST_COLUMNS, 'sr.description', 'sr.feedback', 'cur.assigned_at', 'cur.note as assignment_note',
      'requester.email as requester_email', 'requester.phone as requester_phone',
      'requester.department as requester_department']);
  applyVisibility(query, user);
  const request = await query;
  if (!request) throw HttpError.notFound('Service request not found');
  return request;
}

/** Tells everyone involved in a request (and all admins) that it changed. */
function broadcastUpdate(request, extra = {}) {
  const payload = {
    id: request.id, reference: request.reference, status: request.status, ...extra,
  };
  emitToUsers([request.requester_id, request.officer_id], 'request:updated', payload);
  emitToRole(ROLES.ADMIN, 'request:updated', payload);
}

function saveAttachments(trx, requestId, files, userId, kind) {
  if (!files || files.length === 0) return Promise.resolve([]);
  return trx('attachments').insert(files.map((f) => ({
    request_id: requestId,
    uploaded_by: userId,
    kind,
    filename: f.originalname.slice(0, 200),
    mime_type: f.mimetype,
    size_bytes: f.size,
    data: f.buffer,
  }))).returning(['id', 'filename', 'mime_type', 'size_bytes', 'kind', 'created_at']);
}

// ---------------------------------------------------------------- READ

async function list(req, res) {
  const filters = req.validQuery || {};
  const paging = getPaging(filters);

  const base = applyFilters(applyVisibility(baseListQuery(), req.user), filters);
  const [{ count }] = await base.clone().clearSelect().count('sr.id as count');
  const rows = await applySort(base.clone().select(LIST_COLUMNS), filters.sort)
    .limit(paging.limit).offset(paging.offset);

  res.json({ data: rows, pagination: paginationMeta(Number(count), paging) });
}

async function getOne(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);

  const [statusLogs, assignments, attachments] = await Promise.all([
    db('status_logs as sl')
      .leftJoin('users as u', 'u.id', 'sl.changed_by')
      .leftJoin('roles as r', 'r.id', 'u.role_id')
      .where('sl.request_id', request.id)
      .orderBy('sl.created_at', 'asc')
      .select('sl.id', 'sl.from_status', 'sl.to_status', 'sl.comment', 'sl.created_at',
        'u.full_name as changed_by_name', 'r.label as changed_by_role'),
    db('assignments as a')
      .join('users as o', 'o.id', 'a.officer_id')
      .join('users as by', 'by.id', 'a.assigned_by')
      .where('a.request_id', request.id)
      .orderBy('a.assigned_at', 'desc')
      .select('a.id', 'a.is_active', 'a.note', 'a.assigned_at', 'a.unassigned_at',
        'o.id as officer_id', 'o.full_name as officer_name', 'by.full_name as assigned_by_name'),
    db('attachments').where({ request_id: request.id }).orderBy('created_at')
      .select('id', 'filename', 'mime_type', 'size_bytes', 'kind', 'created_at'),
  ]);

  res.json({
    data: {
      ...request, status_logs: statusLogs, assignments, attachments,
    },
  });
}

// ---------------------------------------------------------------- CREATE

async function create(req, res) {
  const {
    title, description, categoryId, location, room, priority,
  } = req.body;

  const category = await db('categories').where({ id: categoryId, is_active: true }).first();
  if (!category) throw HttpError.badRequest('Validation failed', [{ field: 'categoryId', message: 'Choose a valid category' }]);

  const created = await db.transaction(async (trx) => {
    const { rows: [{ seq }] } = await trx.raw("SELECT nextval('request_ref_seq') AS seq");
    const reference = `SR-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const [request] = await trx('service_requests').insert({
      reference,
      title,
      description,
      category_id: categoryId,
      requester_id: req.user.id,
      location,
      room,
      priority: priority || category.default_priority,
    }).returning('*');

    await trx('status_logs').insert({
      request_id: request.id, from_status: null, to_status: STATUSES.PENDING, changed_by: req.user.id, comment: 'Request submitted',
    });
    const attachments = await saveAttachments(trx, request.id, req.files, req.user.id, 'EVIDENCE');
    await logAudit(req, {
      action: 'REQUEST_CREATED',
      entityType: 'service_request',
      entityId: request.id,
      details: { reference, category: category.name, attachments: attachments.length },
    }, trx);
    return { ...request, attachments };
  });

  await notifyAdmins({
    type: 'REQUEST_CREATED',
    title: `New request ${created.reference}`,
    message: `${req.user.full_name} reported "${created.title}" at ${created.location} (${category.name}).`,
    requestId: created.id,
  });
  emitToRole(ROLES.ADMIN, 'request:updated', { id: created.id, reference: created.reference, status: created.status });

  res.status(201).json({ message: `Request ${created.reference} submitted successfully`, data: created });
}

// ---------------------------------------------------------------- UPDATE

async function update(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);
  const changes = req.body;

  if (req.user.role === ROLES.OFFICER) throw HttpError.forbidden('Officers update requests through status changes');
  if (isRequester(req.user) && request.status !== STATUSES.PENDING) {
    throw HttpError.conflict('You can only edit a request while it is still pending');
  }
  if (FINAL_STATUSES.includes(request.status)) throw HttpError.conflict('Closed or cancelled requests cannot be edited');
  if (Object.keys(changes).length === 0) throw HttpError.badRequest('No changes supplied');

  if (changes.categoryId) {
    const ok = await db('categories').where({ id: changes.categoryId, is_active: true }).first('id');
    if (!ok) throw HttpError.badRequest('Validation failed', [{ field: 'categoryId', message: 'Choose a valid category' }]);
  }

  const patch = {
    title: changes.title,
    description: changes.description,
    category_id: changes.categoryId,
    location: changes.location,
    room: changes.room,
    priority: changes.priority,
    updated_at: db.fn.now(),
  };
  await db('service_requests').where({ id: request.id }).update(patch);
  await logAudit(req, {
    action: 'REQUEST_UPDATED', entityType: 'service_request', entityId: request.id, details: { changes },
  });

  broadcastUpdate(request);
  const updated = await findVisibleRequest(request.id, req.user);
  res.json({ message: 'Request updated', data: updated });
}

// ---------------------------------------------------------------- DELETE

async function remove(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);

  if (req.user.role === ROLES.OFFICER) throw HttpError.forbidden();
  if (isRequester(req.user) && request.status !== STATUSES.PENDING) {
    throw HttpError.conflict('Only pending requests can be deleted. Cancel it instead.');
  }

  await db('service_requests').where({ id: request.id }).del();
  await logAudit(req, {
    action: 'REQUEST_DELETED',
    entityType: 'service_request',
    entityId: request.id,
    details: { reference: request.reference, title: request.title },
  });
  emitToRole(ROLES.ADMIN, 'request:updated', { id: request.id, deleted: true });
  res.json({ message: `Request ${request.reference} deleted` });
}

// ---------------------------------------------------------------- WORKFLOW

async function changeStatus(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);
  const {
    status: to, comment, rating, feedback,
  } = req.body;
  const from = request.status;

  let actor = 'ADMIN';
  if (isRequester(req.user)) actor = 'REQUESTER';
  else if (req.user.role === ROLES.OFFICER) actor = 'OFFICER';

  const allowed = (TRANSITIONS[actor][from] || []);
  if (!allowed.includes(to)) {
    throw HttpError.conflict(
      `Cannot change status from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}`,
      { allowed },
    );
  }
  if (to === STATUSES.REJECTED && !comment) {
    throw HttpError.badRequest('Validation failed', [{ field: 'comment', message: 'Give a reason for rejecting the request' }]);
  }
  if (from === STATUSES.COMPLETED && to === STATUSES.IN_PROGRESS && !comment) {
    throw HttpError.badRequest('Validation failed', [{ field: 'comment', message: 'Explain why the request is being reopened' }]);
  }

  const patch = { status: to, updated_at: db.fn.now() };
  if (to === STATUSES.COMPLETED) patch.completed_at = db.fn.now();
  if (to === STATUSES.CLOSED) {
    patch.closed_at = db.fn.now();
    if (actor === 'REQUESTER') {
      patch.rating = rating || null;
      patch.feedback = feedback || null;
    }
  }
  if (to === STATUSES.IN_PROGRESS && from === STATUSES.COMPLETED) patch.completed_at = null;

  await db.transaction(async (trx) => {
    await trx('service_requests').where({ id: request.id }).update(patch);
    await trx('status_logs').insert({
      request_id: request.id, from_status: from, to_status: to, changed_by: req.user.id, comment,
    });
    if (req.files && req.files.length) {
      await saveAttachments(trx, request.id, req.files, req.user.id, actor === 'OFFICER' ? 'COMPLETION' : 'EVIDENCE');
    }
    await logAudit(req, {
      action: 'REQUEST_STATUS_CHANGED',
      entityType: 'service_request',
      entityId: request.id,
      details: {
        reference: request.reference, from, to, comment, rating,
      },
    }, trx);
  });

  const message = `${request.reference} "${request.title}" is now ${STATUS_LABELS[to]}${comment ? `: ${comment}` : ''}`;
  const recipients = [request.requester_id, request.officer_id].filter((id) => id && id !== req.user.id);
  await notifyUsers(recipients, {
    type: 'STATUS_CHANGED', title: `Request ${STATUS_LABELS[to].toLowerCase()}`, message, requestId: request.id,
  });
  if (actor !== 'ADMIN' && ['COMPLETED', 'CLOSED', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD'].includes(to)) {
    await notifyAdmins({
      type: 'STATUS_CHANGED', title: `Request ${STATUS_LABELS[to].toLowerCase()}`, message, requestId: request.id,
    }, { exclude: req.user.id });
  }

  broadcastUpdate({ ...request, status: to });
  const updated = await findVisibleRequest(request.id, req.user);
  res.json({ message: `Status changed to ${STATUS_LABELS[to]}`, data: updated });
}

async function assign(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);
  const { officerId, note, priority } = req.body;

  if ([...FINAL_STATUSES, STATUSES.COMPLETED].includes(request.status)) {
    throw HttpError.conflict(`A ${STATUS_LABELS[request.status].toLowerCase()} request cannot be assigned`);
  }

  const officer = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'users.id': officerId, 'roles.name': ROLES.OFFICER, 'users.is_active': true })
    .first('users.id', 'users.full_name');
  if (!officer) throw HttpError.badRequest('Validation failed', [{ field: 'officerId', message: 'Choose an active maintenance officer' }]);
  if (request.officer_id === officer.id) throw HttpError.conflict(`Already assigned to ${officer.full_name}`);

  const isReassign = Boolean(request.officer_id);

  await db.transaction(async (trx) => {
    await trx('assignments').where({ request_id: request.id, is_active: true })
      .update({ is_active: false, unassigned_at: trx.fn.now() });
    await trx('assignments').insert({
      request_id: request.id, officer_id: officer.id, assigned_by: req.user.id, note,
    });
    await trx('service_requests').where({ id: request.id }).update({
      status: STATUSES.ASSIGNED, priority: priority || request.priority, updated_at: trx.fn.now(),
    });
    await trx('status_logs').insert({
      request_id: request.id,
      from_status: request.status,
      to_status: STATUSES.ASSIGNED,
      changed_by: req.user.id,
      comment: `${isReassign ? 'Reassigned' : 'Assigned'} to ${officer.full_name}${note ? ` — ${note}` : ''}`,
    });
    await logAudit(req, {
      action: isReassign ? 'REQUEST_REASSIGNED' : 'REQUEST_ASSIGNED',
      entityType: 'service_request',
      entityId: request.id,
      details: {
        reference: request.reference, officerId: officer.id, officer: officer.full_name, previousOfficerId: request.officer_id,
      },
    }, trx);
  });

  await notifyUsers([officer.id], {
    type: 'REQUEST_ASSIGNED',
    title: `New job: ${request.reference}`,
    message: `You have been assigned "${request.title}" at ${request.location}${note ? `. Note: ${note}` : ''}.`,
    requestId: request.id,
  });
  await notifyUsers([request.requester_id], {
    type: 'REQUEST_ASSIGNED',
    title: `Request ${request.reference} assigned`,
    message: `${officer.full_name} has been assigned to your request "${request.title}".`,
    requestId: request.id,
  });
  if (isReassign) {
    await notifyUsers([request.officer_id], {
      type: 'REQUEST_UNASSIGNED',
      title: `Job ${request.reference} reassigned`,
      message: `"${request.title}" has been reassigned to another officer.`,
      requestId: request.id,
    });
  }

  broadcastUpdate({ ...request, status: STATUSES.ASSIGNED });
  emitToUsers([officer.id, request.officer_id], 'request:updated', { id: request.id, status: STATUSES.ASSIGNED });
  const updated = await findVisibleRequest(request.id, req.user);
  res.json({ message: `Assigned to ${officer.full_name}`, data: updated });
}

async function addComment(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);
  if (FINAL_STATUSES.includes(request.status)) throw HttpError.conflict('This request is closed');

  const [log] = await db('status_logs').insert({
    request_id: request.id,
    from_status: request.status,
    to_status: request.status,
    changed_by: req.user.id,
    comment: req.body.comment,
  }).returning('*');
  await db('service_requests').where({ id: request.id }).update({ updated_at: db.fn.now() });

  const recipients = [request.requester_id, request.officer_id].filter((id) => id && id !== req.user.id);
  await notifyUsers(recipients, {
    type: 'COMMENT',
    title: `New comment on ${request.reference}`,
    message: `${req.user.full_name}: ${req.body.comment}`.slice(0, 500),
    requestId: request.id,
  });
  broadcastUpdate(request);
  res.status(201).json({ message: 'Comment added', data: log });
}

// ---------------------------------------------------------------- ATTACHMENTS

async function uploadAttachments(req, res) {
  const request = await findVisibleRequest(req.params.id, req.user);
  if (FINAL_STATUSES.includes(request.status)) throw HttpError.conflict('This request is closed');
  if (!req.files || req.files.length === 0) throw HttpError.badRequest('Select at least one image');

  const existing = await db('attachments').where({ request_id: request.id }).count('id as n').first();
  if (Number(existing.n) + req.files.length > 10) throw HttpError.badRequest('A request can have at most 10 images');

  const kind = req.user.role === ROLES.OFFICER ? 'COMPLETION' : 'EVIDENCE';
  const saved = await saveAttachments(db, request.id, req.files, req.user.id, kind);
  await logAudit(req, {
    action: 'ATTACHMENT_UPLOADED', entityType: 'service_request', entityId: request.id, details: { count: saved.length, kind },
  });
  broadcastUpdate(request);
  res.status(201).json({ message: `${saved.length} image(s) uploaded`, data: saved });
}

async function downloadAttachment(req, res) {
  const file = await db('attachments').where({ id: req.params.id }).first();
  if (!file) throw HttpError.notFound('File not found');
  await findVisibleRequest(file.request_id, req.user); // access check

  res.set({
    'Content-Type': file.mime_type,
    'Content-Length': file.size_bytes,
    'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
    'Cache-Control': 'private, max-age=3600',
  });
  res.send(file.data);
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  changeStatus,
  assign,
  addComment,
  uploadAttachments,
  downloadAttachment,
  findVisibleRequest,
  STATUS_LABELS,
};
