import { Server } from 'socket.io';
import { userFromToken } from './auth.js';
import { db } from './db.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  io.on('connection', (socket) => {
    const user = userFromToken(socket.handshake.auth?.token);
    if (!user) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = user.id;

    const groups = db.prepare('SELECT group_id FROM group_members WHERE user_id = ?').all(user.id);
    for (const g of groups) socket.join('group:' + g.group_id);
    setPresenceAll(user.id, 'active');
    for (const g of groups) {
      io.to('group:' + g.group_id).emit('presence', { userId: user.id, state: 'active' });
    }

    socket.on('presence', ({ groupId, state = 'active', activity = null }) => {
      db.prepare(
        "UPDATE group_members SET presence = ?, activity = ?, last_seen = datetime('now') WHERE user_id = ? AND group_id = ?",
      ).run(state, activity, user.id, groupId);
      io.to('group:' + groupId).emit('presence', { userId: user.id, state, activity });
    });

    socket.on('typing', ({ groupId, threadId }) => {
      socket.to('group:' + groupId).emit('typing', { userId: user.id, threadId, name: user.name });
    });

    socket.on('disconnect', () => {
      setPresenceAll(user.id, 'offline');
      for (const g of groups) {
        io.to('group:' + g.group_id).emit('presence', { userId: user.id, state: 'offline' });
      }
    });
  });

  return io;
}

function setPresenceAll(userId, state) {
  db.prepare("UPDATE group_members SET presence = ?, last_seen = datetime('now') WHERE user_id = ?").run(state, userId);
}

export const emitToGroup = (groupId, event, data) => {
  if (io) io.to('group:' + groupId).emit(event, data);
};

export const emitToUser = (userId, event, data) => {
  if (!io) return;
  for (const [, socket] of io.of('/').sockets) {
    if (socket.data.userId === userId) socket.emit(event, data);
  }
};
