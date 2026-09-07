import { Server } from 'socket.io';
import { userFromToken } from './auth.js';
import { db } from './db.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  io.on('connection', async (socket) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = user.id;

    const groups = await db.all('SELECT group_id FROM group_members WHERE user_id = ?', user.id);
    for (const g of groups) socket.join('group:' + g.group_id);
    await setPresenceAll(user.id, 'active');
    for (const g of groups) {
      io.to('group:' + g.group_id).emit('presence', { userId: user.id, state: 'active' });
    }

    socket.on('presence', async ({ groupId, state = 'active', activity = null }) => {
      try {
        await db.run(
          'UPDATE group_members SET presence = ?, activity = ?, last_seen = now() WHERE user_id = ? AND group_id = ?',
          state,
          activity,
          user.id,
          groupId,
        );
        io.to('group:' + groupId).emit('presence', { userId: user.id, state, activity });
      } catch {
        /* ignore */
      }
    });

    socket.on('typing', ({ groupId, threadId }) => {
      socket.to('group:' + groupId).emit('typing', { userId: user.id, threadId, name: user.name });
    });

    socket.on('disconnect', async () => {
      await setPresenceAll(user.id, 'offline').catch(() => {});
      for (const g of groups) {
        io.to('group:' + g.group_id).emit('presence', { userId: user.id, state: 'offline' });
      }
    });
  });

  return io;
}

function setPresenceAll(userId, state) {
  return db.run('UPDATE group_members SET presence = ?, last_seen = now() WHERE user_id = ?', state, userId);
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
