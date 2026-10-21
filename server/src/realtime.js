/**
 * Real-time layer (Socket.IO).
 *
 * Each connected client authenticates with its access token and joins two
 * rooms: `user:<id>` (personal events) and `role:<ROLE>` (e.g. all admins).
 * The API pushes `notification:new` and `request:updated` events so
 * dashboards refresh instantly without polling.
 */
const { Server } = require('socket.io');
const config = require('./config');
const { verifyAccessToken } = require('./utils/tokens');

let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = verifyAccessToken(token);
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.sub}`);
    socket.join(`role:${socket.user.role}`);
  });

  return io;
}

function emitToUsers(userIds, event, payload) {
  if (!io) return;
  [...new Set(userIds.filter(Boolean))].forEach((id) => io.to(`user:${id}`).emit(event, payload));
}

function emitToRole(role, event, payload) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, payload);
}

module.exports = { initRealtime, emitToUsers, emitToRole };
