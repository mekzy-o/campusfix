/**
 * Authentication & session management.
 *
 * Flow:
 *  1. Login/registration returns a 15-minute access token (JSON body) and sets a
 *     7-day refresh token in an httpOnly, SameSite cookie.
 *  2. The client keeps the access token in memory only (never localStorage).
 *  3. When it expires the client calls /auth/refresh: the refresh token is
 *     ROTATED (old one revoked, new one issued). Presenting an already-revoked
 *     token is treated as theft and every session of that user is revoked.
 *  4. Logout revokes the session server-side and clears the cookie.
 */
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const HttpError = require('../utils/httpError');
const { logAudit } = require('../services/audit');
const { notifyAdmins } = require('../services/notify');
const {
  signAccessToken, generateRefreshToken, hashToken,
} = require('../utils/tokens');

const REFRESH_COOKIE = 'cf_refresh';
const BCRYPT_ROUNDS = config.isTest ? 4 : 12;

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000,
});

/** Shape of a user returned to clients (never includes the password hash). */
async function loadPublicUser(userId) {
  const user = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .leftJoin('officer_profiles as op', 'op.user_id', 'users.id')
    .where('users.id', userId)
    .first(
      'users.id', 'users.full_name', 'users.email', 'users.phone', 'users.department',
      'users.id_number', 'users.is_active', 'users.last_login_at', 'users.created_at',
      'roles.name as role', 'roles.label as role_label',
      'op.specialisation', 'op.availability',
    );
  return user;
}

async function startSession(req, res, user) {
  const refreshToken = generateRefreshToken();
  await db('sessions').insert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    user_agent: (req.get('user-agent') || '').slice(0, 255),
    ip_address: (req.ip || '').slice(0, 64),
    expires_at: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  return signAccessToken(user);
}

async function register(req, res) {
  const {
    fullName, email, password, role, phone, department, idNumber,
  } = req.body;

  const exists = await db('users').whereRaw('lower(email) = ?', [email]).first('id');
  if (exists) throw HttpError.conflict('An account with this email already exists');

  const roleRow = await db('roles').where({ name: role }).first('id');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [created] = await db('users').insert({
    full_name: fullName,
    email,
    password_hash: passwordHash,
    phone,
    department,
    id_number: idNumber,
    role_id: roleRow.id,
    last_login_at: db.fn.now(),
  }).returning('id');

  const user = await loadPublicUser(created.id);
  await logAudit(req, {
    actorId: user.id, action: 'USER_REGISTERED', entityType: 'user', entityId: user.id, details: { role },
  });
  notifyAdmins({
    type: 'USER_REGISTERED',
    title: 'New user registered',
    message: `${user.full_name} (${user.role_label}) created an account.`,
  }).catch(() => {});

  const accessToken = await startSession(req, res, user);
  res.status(201).json({ message: 'Account created successfully', accessToken, user });
}

async function login(req, res) {
  const { email, password } = req.body;
  const row = await db('users').whereRaw('lower(email) = ?', [email])
    .first('id', 'password_hash', 'is_active');

  // Same message for unknown email and wrong password (prevents user enumeration).
  const valid = row && await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    await logAudit(req, {
      actorId: row ? row.id : null, action: 'LOGIN_FAILED', entityType: 'user', details: { email },
    });
    throw HttpError.unauthorized('Invalid email or password');
  }
  if (!row.is_active) throw HttpError.forbidden('This account has been deactivated. Contact the administrator.');

  await db('users').where({ id: row.id }).update({ last_login_at: db.fn.now() });
  const user = await loadPublicUser(row.id);
  const accessToken = await startSession(req, res, user);
  await logAudit(req, { actorId: user.id, action: 'USER_LOGIN', entityType: 'user', entityId: user.id });

  res.json({ message: 'Signed in successfully', accessToken, user });
}

async function refresh(req, res) {
  const token = req.cookies && req.cookies[REFRESH_COOKIE];
  if (!token) throw HttpError.unauthorized('No active session');

  const session = await db('sessions').where({ token_hash: hashToken(token) }).first();
  if (!session) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw HttpError.unauthorized('Session not found');
  }

  if (session.revoked_at) {
    // Refresh-token reuse detected: revoke every session for this user.
    await db('sessions').where({ user_id: session.user_id }).whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
    await logAudit(req, {
      actorId: session.user_id, action: 'SESSION_REUSE_DETECTED', entityType: 'session', entityId: session.id,
    });
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw HttpError.unauthorized('Session is no longer valid. Please sign in again.');
  }

  if (new Date(session.expires_at) < new Date()) {
    throw HttpError.unauthorized('Session expired. Please sign in again.');
  }

  const user = await loadPublicUser(session.user_id);
  if (!user || !user.is_active) throw HttpError.unauthorized('Account is not active');

  await db('sessions').where({ id: session.id }).update({ revoked_at: db.fn.now() });
  const accessToken = await startSession(req, res, user);
  res.json({ accessToken, user });
}

async function logout(req, res) {
  const token = req.cookies && req.cookies[REFRESH_COOKIE];
  if (token) {
    const session = await db('sessions').where({ token_hash: hashToken(token) }).first('id', 'user_id');
    if (session) {
      await db('sessions').where({ id: session.id }).update({ revoked_at: db.fn.now() });
      await logAudit(req, { actorId: session.user_id, action: 'USER_LOGOUT', entityType: 'user', entityId: session.user_id });
    }
  }
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Signed out' });
}

async function me(req, res) {
  res.json({ user: await loadPublicUser(req.user.id) });
}

async function updateMe(req, res) {
  const {
    fullName, phone, department, idNumber,
  } = req.body;
  await db('users').where({ id: req.user.id }).update({
    full_name: fullName, phone, department, id_number: idNumber, updated_at: db.fn.now(),
  });
  await logAudit(req, { action: 'PROFILE_UPDATED', entityType: 'user', entityId: req.user.id });
  res.json({ message: 'Profile updated', user: await loadPublicUser(req.user.id) });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const row = await db('users').where({ id: req.user.id }).first('password_hash');
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw HttpError.badRequest('Current password is incorrect', [{ field: 'currentPassword', message: 'Current password is incorrect' }]);
  }
  await db('users').where({ id: req.user.id }).update({
    password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), updated_at: db.fn.now(),
  });

  // Sign out every other device.
  const current = req.cookies && req.cookies[REFRESH_COOKIE];
  await db('sessions').where({ user_id: req.user.id }).whereNull('revoked_at')
    .modify((q) => { if (current) q.whereNot({ token_hash: hashToken(current) }); })
    .update({ revoked_at: db.fn.now() });

  await logAudit(req, { action: 'PASSWORD_CHANGED', entityType: 'user', entityId: req.user.id });
  res.json({ message: 'Password changed. Other devices have been signed out.' });
}

module.exports = {
  register, login, refresh, logout, me, updateMe, changePassword, loadPublicUser, REFRESH_COOKIE,
};
