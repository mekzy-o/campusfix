/**
 * API route table. Every route declares its own authentication, role
 * restrictions and validation, so the access rules can be read in one place.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadImages } = require('../middleware/upload');
const s = require('../validators/schemas');
const { ROLES, REQUESTER_ROLES } = require('../constants');

const auth = require('../controllers/auth.controller');
const requests = require('../controllers/requests.controller');
const users = require('../controllers/users.controller');
const categories = require('../controllers/categories.controller');
const notifications = require('../controllers/notifications.controller');
const reports = require('../controllers/reports.controller');
const audit = require('../controllers/audit.controller');

const router = express.Router();
const { ADMIN, OFFICER } = ROLES;

// Brute-force protection on credential endpoints (disabled in automated tests).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

// ---------------------------------------------------------------- Health
router.get('/health', async (_req, res) => {
  await db.raw('select 1');
  res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
});

// ---------------------------------------------------------------- Auth
router.post('/auth/register', authLimiter, validate({ body: s.register }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: s.login }), auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.patch('/auth/me', authenticate, validate({ body: s.updateProfile }), auth.updateMe);
router.post('/auth/change-password', authenticate, validate({ body: s.changePassword }), auth.changePassword);

// Everything below requires a signed-in user.
router.use(authenticate);

// ---------------------------------------------------------------- Dashboard & reports
router.get('/dashboard', reports.dashboard);
router.get('/reports/summary', authorize(ADMIN), validate({ query: s.reportQuery }), reports.summary);
router.get('/reports/export', authorize(ADMIN, OFFICER), validate({ query: s.exportQuery }), reports.exportRequests);

// ---------------------------------------------------------------- Service requests
router.get('/requests', validate({ query: s.requestFilters }), requests.list);
router.post('/requests', authorize(REQUESTER_ROLES), uploadImages, validate({ body: s.createRequest }), requests.create);
router.get('/requests/:id', validate({ params: s.idParam }), requests.getOne);
router.patch('/requests/:id', authorize(ADMIN, REQUESTER_ROLES), validate({ params: s.idParam, body: s.updateRequest }), requests.update);
router.delete('/requests/:id', authorize(ADMIN, REQUESTER_ROLES), validate({ params: s.idParam }), requests.remove);
router.patch('/requests/:id/status', uploadImages, validate({ params: s.idParam, body: s.changeStatus }), requests.changeStatus);
router.post('/requests/:id/assign', authorize(ADMIN), validate({ params: s.idParam, body: s.assign }), requests.assign);
router.post('/requests/:id/comments', validate({ params: s.idParam, body: s.comment }), requests.addComment);
router.post('/requests/:id/attachments', uploadImages, validate({ params: s.idParam }), requests.uploadAttachments);
router.get('/attachments/:id', validate({ params: s.idParam }), requests.downloadAttachment);

// ---------------------------------------------------------------- Categories
router.get('/categories', categories.list);
router.post('/categories', authorize(ADMIN), validate({ body: s.category }), categories.create);
router.patch('/categories/:id', authorize(ADMIN), validate({ params: s.intIdParam, body: s.categoryUpdate }), categories.update);
router.delete('/categories/:id', authorize(ADMIN), validate({ params: s.intIdParam }), categories.remove);

// ---------------------------------------------------------------- Users & roles (admin)
router.get('/roles', authorize(ADMIN), users.roles);
router.get('/users/officers', authorize(ADMIN), validate({ query: s.officersQuery }), users.officers);
router.get('/users', authorize(ADMIN), validate({ query: s.listUsers }), users.list);
router.post('/users', authorize(ADMIN), validate({ body: s.createUser }), users.create);
router.get('/users/:id', authorize(ADMIN), validate({ params: s.idParam }), users.getOne);
router.patch('/users/:id', authorize(ADMIN), validate({ params: s.idParam, body: s.updateUser }), users.update);
router.delete('/users/:id', authorize(ADMIN), validate({ params: s.idParam }), users.deactivate);

// ---------------------------------------------------------------- Notifications
router.get('/notifications', validate({ query: s.pageQuery }), notifications.list);
router.get('/notifications/unread-count', notifications.unreadCount);
router.patch('/notifications/read-all', notifications.markAllRead);
router.patch('/notifications/:id/read', validate({ params: s.intIdParam }), notifications.markRead);

// ---------------------------------------------------------------- Audit trail (admin)
router.get('/audit-logs', authorize(ADMIN), validate({ query: s.auditQuery }), audit.list);

module.exports = router;
