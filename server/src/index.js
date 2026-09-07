import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { PORT, UPLOAD_DIR, WEB_DIST } from './env.js';
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

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'classmemo' }));

app.use('/api/auth', authRoutes);

// tout le reste exige une session
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
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` }));

// Sert le front compilé (déploiement single-origin) si présent.
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => {
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

server.listen(PORT, () => {
  console.log(`ClassMemo API  →  http://localhost:${PORT}`);
});
