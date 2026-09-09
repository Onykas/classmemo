import { Router } from 'express';
import { db, parseJson } from '../db.js';
import { newId, memberGuard, membersOfGroup } from './_helpers.js';
import { emitToGroup, isUserOnline } from '../realtime.js';
import { sendPush } from '../push.js';

const router = Router();

// Anti-spam : au plus un push de chat par (destinataire, fil) toutes les 90 s.
const lastChatPush = new Map();
const CHAT_PUSH_COOLDOWN = 90_000;

async function pushChatToOffline(thread, sender, text) {
  const preview = (text || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'a envoyé une pièce jointe';
  const now = Date.now();
  for (const m of await membersOfGroup(thread.group_id)) {
    if (m.id === sender.id || isUserOnline(m.id)) continue;
    const key = `${m.id}:${thread.id}`;
    if (now - (lastChatPush.get(key) || 0) < CHAT_PUSH_COOLDOWN) continue;
    lastChatPush.set(key, now);
    sendPush(m.id, {
      title: `💬 ${sender.name}`,
      body: preview,
      url: '/chat',
      tag: `chat-${thread.id}`,
    }).catch(() => {});
  }
}

async function serializeMessage(m) {
  const user = m.user_id ? await db.get('SELECT * FROM users WHERE id = ?', m.user_id) : null;
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

router.get('/groups/:gid/threads', memberGuard(), async (req, res) => {
  let threads = await db.all(
    "SELECT * FROM chat_threads WHERE group_id = ? ORDER BY (kind = 'default') DESC, created_at ASC",
    req.params.gid,
  );
  if (!threads.length) {
    const id = newId();
    await db.run(
      "INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon du groupe', 'default')",
      id,
      req.params.gid,
    );
    threads = await db.all('SELECT * FROM chat_threads WHERE group_id = ?', req.params.gid);
  }
  const out = [];
  for (const t of threads) {
    out.push({
      id: t.id,
      name: t.name,
      kind: t.kind,
      count: Number((await db.get('SELECT COUNT(*) n FROM chat_messages WHERE thread_id = ?', t.id)).n),
    });
  }
  res.json(out);
});

router.post('/groups/:gid/threads', memberGuard(), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom du fil requis' });
  const id = newId();
  await db.run(
    "INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, ?, 'topic')",
    id,
    req.params.gid,
    String(name).trim(),
  );
  emitToGroup(req.params.gid, 'chat:thread', { id, name });
  res.json({ id, name, kind: 'topic', count: 0 });
});

async function threadGuard(req, res, next) {
  try {
    const t = await db.get('SELECT * FROM chat_threads WHERE id = ?', req.params.tid);
    if (!t) return res.status(404).json({ error: 'Fil introuvable' });
    if (!(await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', t.group_id, req.user.id))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.thread = t;
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/threads/:tid/messages', threadGuard, async (req, res) => {
  const rows = await db.all(
    'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200',
    req.params.tid,
  );
  res.json(await Promise.all(rows.map(serializeMessage)));
});

router.post('/threads/:tid/messages', threadGuard, async (req, res) => {
  const { body = '', attachmentUrl = null, cardRef = null } = req.body || {};
  if (!body.trim() && !attachmentUrl && !cardRef) return res.status(400).json({ error: 'Message vide' });

  const id = newId();
  await db.run(
    "INSERT INTO chat_messages (id, thread_id, group_id, user_id, kind, body, attachment_url, card_ref) VALUES (?, ?, ?, ?, 'user', ?, ?, ?)",
    id,
    req.thread.id,
    req.thread.group_id,
    req.user.id,
    body.trim(),
    attachmentUrl,
    cardRef ? JSON.stringify(cardRef) : null,
  );

  const msg = await serializeMessage(await db.get('SELECT * FROM chat_messages WHERE id = ?', id));
  emitToGroup(req.thread.group_id, 'chat:message', msg);
  res.json(msg);

  pushChatToOffline(req.thread, req.user, body).catch(() => {});
});

export default router;
