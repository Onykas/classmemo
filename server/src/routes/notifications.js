import { Router } from 'express';
import { db, parseJson } from '../db.js';

const router = Router();

function serialize(n) {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    meta: parseJson(n.meta, null),
    read: !!n.read,
    createdAt: n.created_at,
  };
}

router.get('/notifications', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
    .all(req.user.id);
  res.json({
    items: rows.map(serialize),
    unread: rows.filter((n) => !n.read).length,
  });
});

router.post('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
