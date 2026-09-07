import { Router } from 'express';
import { db, parseJson } from '../db.js';
import { newId, memberGuard } from './_helpers.js';
import { emitToGroup } from '../realtime.js';

const router = Router();

function serializeMessage(m) {
  const user = m.user_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(m.user_id) : null;
  return {
    id: m.id,
    threadId: m.thread_id,
    kind: m.kind,
    body: m.body,
    attachmentUrl: m.attachment_url,
    cardRef: parseJson(m.card_ref, null),
    createdAt: m.created_at,
    user: user && { id: user.id, name: user.name, avatarUrl: user.avatar_url },
  };
}

router.get('/groups/:gid/threads', memberGuard(), (req, res) => {
  let threads = db
    .prepare("SELECT * FROM chat_threads WHERE group_id = ? ORDER BY (kind = 'default') DESC, created_at ASC")
    .all(req.params.gid);
  if (!threads.length) {
    const id = newId();
    db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon du groupe', 'default')").run(id, req.params.gid);
    threads = db.prepare('SELECT * FROM chat_threads WHERE group_id = ?').all(req.params.gid);
  }
  res.json(
    threads.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      count: db.prepare('SELECT COUNT(*) n FROM chat_messages WHERE thread_id = ?').get(t.id).n,
    })),
  );
});

router.post('/groups/:gid/threads', memberGuard(), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom du fil requis' });
  const id = newId();
  db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, ?, 'topic')").run(id, req.params.gid, String(name).trim());
  emitToGroup(req.params.gid, 'chat:thread', { id, name });
  res.json({ id, name, kind: 'topic', count: 0 });
});

router.get('/threads/:tid/messages', (req, res) => {
  const t = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.tid);
  if (!t) return res.status(404).json({ error: 'Fil introuvable' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(t.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200')
    .all(req.params.tid);
  res.json(rows.map(serializeMessage));
});

router.post('/threads/:tid/messages', (req, res) => {
  const t = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.tid);
  if (!t) return res.status(404).json({ error: 'Fil introuvable' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(t.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { body = '', attachmentUrl = null, cardRef = null } = req.body || {};
  if (!body.trim() && !attachmentUrl && !cardRef) return res.status(400).json({ error: 'Message vide' });

  const id = newId();
  db.prepare(
    "INSERT INTO chat_messages (id, thread_id, group_id, user_id, kind, body, attachment_url, card_ref) VALUES (?, ?, ?, ?, 'user', ?, ?, ?)",
  ).run(id, t.id, t.group_id, req.user.id, body.trim(), attachmentUrl, cardRef ? JSON.stringify(cardRef) : null);

  const msg = serializeMessage(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id));
  emitToGroup(t.group_id, 'chat:message', msg);
  res.json(msg);
});

export default router;
