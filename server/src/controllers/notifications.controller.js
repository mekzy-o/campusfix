/** In-app notifications for the signed-in user. */
const db = require('../db');
const HttpError = require('../utils/httpError');
const { getPaging, paginationMeta } = require('../utils/pagination');

async function list(req, res) {
  const f = req.validQuery || {};
  const paging = getPaging(f, { defaultLimit: 15 });
  const base = db('notifications as n')
    .leftJoin('service_requests as sr', 'sr.id', 'n.request_id')
    .where('n.user_id', req.user.id)
    .modify((q) => { if (f.unread === 'true') q.where('n.is_read', false); });

  const [{ count }] = await base.clone().count('n.id as count');
  const [{ unread }] = await db('notifications').where({ user_id: req.user.id, is_read: false }).count('id as unread');
  const rows = await base.clone()
    .select('n.*', 'sr.reference as request_reference')
    .orderBy('n.created_at', 'desc')
    .limit(paging.limit)
    .offset(paging.offset);

  res.json({ data: rows, unread: Number(unread), pagination: paginationMeta(Number(count), paging) });
}

async function unreadCount(req, res) {
  const [{ unread }] = await db('notifications').where({ user_id: req.user.id, is_read: false }).count('id as unread');
  res.json({ unread: Number(unread) });
}

async function markRead(req, res) {
  const updated = await db('notifications')
    .where({ id: req.params.id, user_id: req.user.id })
    .update({ is_read: true });
  if (!updated) throw HttpError.notFound('Notification not found');
  res.json({ message: 'Marked as read' });
}

async function markAllRead(req, res) {
  const count = await db('notifications').where({ user_id: req.user.id, is_read: false }).update({ is_read: true });
  res.json({ message: `${count} notification(s) marked as read` });
}

module.exports = {
  list, unreadCount, markRead, markAllRead,
};
