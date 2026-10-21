/**
 * Creates in-app notifications, pushes them over Socket.IO and (if SMTP is
 * configured) e-mails them.
 */
const db = require('../db');
const { emitToUsers } = require('../realtime');
const { sendMail } = require('./mailer');
const { ROLES } = require('../constants');

async function notifyUsers(userIds, { type, title, message, requestId = null }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const rows = await db('notifications')
    .insert(ids.map((userId) => ({
      user_id: userId, type, title, message, request_id: requestId,
    })))
    .returning('*');

  rows.forEach((row) => emitToUsers([row.user_id], 'notification:new', row));

  // E-mail is fire-and-forget so it never slows down the API response.
  db('users').whereIn('id', ids).select('email')
    .then((users) => users.forEach((u) => sendMail({
      to: u.email, subject: `[CampusFix] ${title}`, text: message,
    })))
    .catch(() => {});

  return rows;
}

async function notifyAdmins(payload, { exclude } = {}) {
  const admins = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'roles.name': ROLES.ADMIN, 'users.is_active': true })
    .modify((q) => { if (exclude) q.whereNot('users.id', exclude); })
    .pluck('users.id');
  return notifyUsers(admins, payload);
}

module.exports = { notifyUsers, notifyAdmins };
