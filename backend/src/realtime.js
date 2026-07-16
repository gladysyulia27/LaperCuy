const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

let ioInstance = null;

function attach(server) {
  const io = new Server(server, {
    cors: { origin: false },
  });

  io.use((socket, next) => {
    try {
      const role = socket.handshake.auth?.role;
      const token = socket.handshake.auth?.token;
      if (role === 'student') {
        const decoded = jwt.verify(token, env.studentJwtSecret);
        socket.join(`student:${decoded.sessionId}`);
        socket.data.student = decoded;
        return next();
      }
      if (role === 'kitchen') {
        const cookie = socket.handshake.headers.cookie || '';
        const match = cookie.match(/(?:^|;\s*)staff_token=([^;]+)/);
        const staffToken = token || (match ? decodeURIComponent(match[1]) : null);
        const decoded = jwt.verify(staffToken, env.staffJwtSecret);
        socket.join('kitchen');
        socket.data.staff = decoded;
        return next();
      }
      return next(new Error('unauthorized'));
    } catch (error) {
      return next(new Error('unauthorized'));
    }
  });

  ioInstance = io;
  return io;
}

function emitKitchen(event, payload) {
  if (ioInstance) ioInstance.to('kitchen').emit(event, payload);
}

function emitStudent(sessionId, event, payload) {
  if (ioInstance) ioInstance.to(`student:${sessionId}`).emit(event, payload);
}

module.exports = { attach, emitKitchen, emitStudent };
