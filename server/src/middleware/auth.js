/**
 * Authentication and role-based access control (RBAC).
 *
 *  authenticate  – verifies the JWT and loads the current user. The user row is
 *                  re-read on every request, so a deactivated account or a
 *                  changed role takes effect immediately.
 *  authorize()   – restricts a route to the listed roles.
 */
const db = require('../db');
const HttpError = require('../utils/httpError');
const { verifyAccessToken } = require('../utils/tokens');

async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw HttpError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw HttpError.unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where('users.id', payload.sub)
    .first('users.id', 'users.full_name', 'users.email', 'users.is_active', 'roles.name as role');

  if (!user || !user.is_active) throw HttpError.unauthorized('Account is not active');

  req.user = user;
  next();
}

function authorize(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!req.user) throw HttpError.unauthorized();
    if (!allowed.includes(req.user.role)) throw HttpError.forbidden();
    next();
  };
}

module.exports = { authenticate, authorize };
