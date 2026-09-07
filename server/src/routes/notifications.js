import { Router } from 'express';
import { db, parseJson } from '../db.js';

const router = Router();

const serialize = (n) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  meta: parseJson(n.meta, null),
  read: !!n.read,
  createdAt: n.created_at,
});

router.get('/notifications', async (req, res) => {
  const rows = await db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
    req.user.id,
  );
  res.json({ items: rows.map(serialize), unread: rows.filter((n) => !n.read).length });
});

router.post('/notifications/:id/read', async (req, res) => {
  await db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/read-all', async (req, res) => {
  await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

export default router;
