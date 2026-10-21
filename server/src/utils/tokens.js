/**
 * Token helpers.
 *  - Access token: short-lived JWT sent in the Authorization header.
 *  - Refresh token: long random string kept in an httpOnly cookie; only its
 *    SHA-256 hash is stored in the sessions table, so a database leak does
 *    not expose usable tokens.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.full_name },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken, verifyAccessToken, generateRefreshToken, hashToken,
};
