import 'express-async-errors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { PORT, WEB_DIST } from './env.js';
import { migrate, db } from './db.js';
import { authMiddleware } from './auth.js';
import { initRealtime } from './realtime.js';

import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import subjectRoutes from './routes/subjects.js';
import courseRoutes from './routes/courses.js';
import reviewRoutes from './routes/review.js';
import quizRoutes from './routes/quiz.js';
import calendarRoutes from './routes/calendar.js';
import chatRoutes from './routes/chat.js';
import notificationRoutes from './routes/notifications.js';
import meRoutes from './routes/me.js';
import homeRoutes from './routes/home.js';
import pushRoutes from './routes/push.js';
import { initReminders } from './reminders.js';

await migrate();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'classmemo' }));

// Images des notes manuscrites, stockées en base (base64).
app.get('/uploads/:pageId', async (req, res) => {
  const row = await db.get('SELECT image_data FROM course_pages WHERE id = ?', req.params.pageId);
  if (!row?.image_data) return res.status(404).end();
  const [meta, b64] = row.image_data.startsWith('data:')
    ? [row.image_data.slice(5, row.image_data.indexOf(';')), row.image_data.split(',')[1]]
    : ['image/jpeg', row.image_data];
  res.set('Content-Type', meta || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(b64, 'base64'));
});

app.use('/api/auth', authRoutes);

const api = express.Router();
api.use(authMiddleware);
api.use('/groups', groupRoutes);
api.use('/', subjectRoutes);
api.use('/', courseRoutes);
api.use('/', reviewRoutes);
api.use('/', quizRoutes);
api.use('/', calendarRoutes);
api.use('/', chatRoutes);
api.use('/', notificationRoutes);
api.use('/', meRoutes);
api.use('/', homeRoutes);
api.use('/', pushRoutes);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` }));

// Front compilé (déploiement single-origin) si présent.
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
  console.log(`Front servi depuis ${WEB_DIST}`);
} else {
  app.use((req, res) => res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` }));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

const server = http.createServer(app);
initRealtime(server);
initReminders();

server.listen(PORT, () => {
  console.log(`ClassMemo API  →  http://localhost:${PORT}`);
});
