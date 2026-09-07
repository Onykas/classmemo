import { Router } from 'express';
import { db } from '../db.js';
import { newId, memberGuard, membersOfGroup } from './_helpers.js';
import { emitToGroup } from '../realtime.js';

const router = Router();

function genCode() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `CLAS-${n}`;
}

function serializeGroup(g) {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    subjectLabel: g.subject_label,
    maxMembers: g.max_members,
    members: membersOfGroup(g.id),
  };
}

router.get('/mine', (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ? ORDER BY gm.joined_at ASC`,
    )
    .all(req.user.id);
  res.json(rows.map(serializeGroup));
});

router.post('/', (req, res) => {
  const { name, subjectLabel } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom de tablée requis' });
  let code = genCode();
  while (db.prepare('SELECT 1 FROM groups WHERE code = ?').get(code)) code = genCode();

  const id = newId();
  db.prepare(
    'INSERT INTO groups (id, name, code, subject_label, created_by) VALUES (?, ?, ?, ?, ?)',
  ).run(id, String(name).trim(), code, subjectLabel || null, req.user.id);
  db.prepare(
    "INSERT INTO group_members (group_id, user_id, role, presence, activity) VALUES (?, ?, 'scribe', 'active', 'A créé la tablée')",
  ).run(id, req.user.id);

  // salon par défaut
  db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, ?, 'default')").run(
    newId(),
    id,
    'Salon du groupe',
  );

  res.json(serializeGroup(db.prepare('SELECT * FROM groups WHERE id = ?').get(id)));
});

router.post('/join', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const g = db.prepare('SELECT * FROM groups WHERE code = ?').get(code);
  if (!g) return res.status(404).json({ error: 'Aucune tablée pour ce code' });
  if (db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(g.id, req.user.id)) {
    return res.json(serializeGroup(g));
  }
  const count = db.prepare('SELECT COUNT(*) n FROM group_members WHERE group_id = ?').get(g.id).n;
  if (count >= g.max_members) return res.status(403).json({ error: 'Cette tablée est complète (4 max.)' });

  db.prepare(
    "INSERT INTO group_members (group_id, user_id, presence, activity) VALUES (?, ?, 'active', 'Vient de rejoindre')",
  ).run(g.id, req.user.id);
  emitToGroup(g.id, 'group:updated', { groupId: g.id });
  res.json(serializeGroup(g));
});

router.get('/:gid', memberGuard(), (req, res) => {
  res.json(serializeGroup(db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.gid)));
});

router.post('/:gid/presence', memberGuard(), (req, res) => {
  const { state = 'active', activity = null } = req.body || {};
  db.prepare(
    "UPDATE group_members SET presence = ?, activity = ?, last_seen = datetime('now') WHERE group_id = ? AND user_id = ?",
  ).run(state, activity, req.params.gid, req.user.id);
  emitToGroup(req.params.gid, 'presence', { userId: req.user.id, state, activity });
  res.json({ ok: true });
});

export default router;
