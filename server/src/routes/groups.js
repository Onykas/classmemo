import { Router } from 'express';
import { db } from '../db.js';
import { newId, memberGuard, membersOfGroup, notify } from './_helpers.js';
import { emitToGroup, emitToUser } from '../realtime.js';
import { sendPush } from '../push.js';

const router = Router();

const genCode = () => `CLAS-${Math.floor(1000 + Math.random() * 9000)}`;

async function serializeGroup(g) {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    subjectLabel: g.subject_label,
    maxMembers: g.max_members,
    members: await membersOfGroup(g.id),
  };
}

router.get('/mine', async (req, res) => {
  const rows = await db.all(
    `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ? ORDER BY gm.joined_at ASC`,
    req.user.id,
  );
  res.json(await Promise.all(rows.map(serializeGroup)));
});

router.post('/', async (req, res) => {
  const { name, subjectLabel } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom de tablée requis' });
  let code = genCode();
  while (await db.get('SELECT 1 FROM groups WHERE code = ?', code)) code = genCode();

  const id = newId();
  await db.run(
    'INSERT INTO groups (id, name, code, subject_label, created_by) VALUES (?, ?, ?, ?, ?)',
    id,
    String(name).trim(),
    code,
    subjectLabel || null,
    req.user.id,
  );
  await db.run(
    "INSERT INTO group_members (group_id, user_id, role, presence, activity) VALUES (?, ?, 'scribe', 'active', 'A créé la tablée')",
    id,
    req.user.id,
  );
  await db.run(
    "INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon du groupe', 'default')",
    newId(),
    id,
  );
  // Matière par défaut pour que « Déposer des notes » soit utilisable d'emblée.
  await db.run(
    'INSERT INTO subjects (id, group_id, name, color_key) VALUES (?, ?, ?, ?)',
    newId(),
    id,
    (subjectLabel && String(subjectLabel).trim()) || 'Cours',
    'psm',
  );

  res.json(await serializeGroup(await db.get('SELECT * FROM groups WHERE id = ?', id)));
});

router.post('/join', async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const g = await db.get('SELECT * FROM groups WHERE code = ?', code);
  if (!g) return res.status(404).json({ error: 'Aucune tablée pour ce code' });
  if (await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', g.id, req.user.id)) {
    return res.json(await serializeGroup(g));
  }
  const count = Number((await db.get('SELECT COUNT(*) n FROM group_members WHERE group_id = ?', g.id)).n);
  if (count >= g.max_members) return res.status(403).json({ error: 'Cette tablée est complète (4 max.)' });

  await db.run(
    "INSERT INTO group_members (group_id, user_id, presence, activity) VALUES (?, ?, 'active', 'Vient de rejoindre')",
    g.id,
    req.user.id,
  );
  emitToGroup(g.id, 'group:updated', { groupId: g.id });
  res.json(await serializeGroup(g));

  // Prévenir les autres membres (hors réponse HTTP).
  (async () => {
    const title = `${req.user.name} a rejoint la tablée`;
    const bodyText = `${req.user.name} fait maintenant partie de « ${g.name} ».`;
    for (const m of await membersOfGroup(g.id)) {
      if (m.id === req.user.id) continue;
      const n = await notify(m.id, { groupId: g.id, kind: 'group', title, body: bodyText });
      emitToUser(m.id, 'notification', n);
      sendPush(m.id, { title, body: bodyText, url: '/profile', tag: `join-${g.id}` }).catch(() => {});
    }
  })().catch((e) => console.warn('[join notify]', e.message));
});

router.get('/:gid', memberGuard(), async (req, res) => {
  res.json(await serializeGroup(await db.get('SELECT * FROM groups WHERE id = ?', req.params.gid)));
});

// Quitter une tablée. Si plus personne ne reste, la tablée et son contenu
// sont supprimés.
router.post('/:gid/leave', memberGuard(), async (req, res) => {
  const gid = req.params.gid;
  await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', gid, req.user.id);
  const left = Number((await db.get('SELECT COUNT(*) n FROM group_members WHERE group_id = ?', gid)).n);

  if (left === 0) {
    await db.tx(async (q) => {
      const { rows: courses } = await q('SELECT id FROM courses WHERE group_id = ?', gid);
      for (const c of courses) {
        await q('DELETE FROM course_pages WHERE course_id = ?', c.id);
        await q('DELETE FROM flashcard_reviews WHERE flashcard_id IN (SELECT id FROM flashcards WHERE course_id = ?)', c.id);
        await q('DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)', c.id);
        await q('DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)', c.id);
        await q('DELETE FROM quizzes WHERE course_id = ?', c.id);
        await q('DELETE FROM capsules WHERE course_id = ?', c.id);
      }
      await q('DELETE FROM flashcards WHERE group_id = ?', gid);
      await q('DELETE FROM courses WHERE group_id = ?', gid);
      await q('DELETE FROM subjects WHERE group_id = ?', gid);
      await q('DELETE FROM chat_messages WHERE group_id = ?', gid);
      await q('DELETE FROM chat_threads WHERE group_id = ?', gid);
      await q('DELETE FROM calendar_events WHERE group_id = ?', gid);
      await q('DELETE FROM notifications WHERE group_id = ?', gid);
      await q('DELETE FROM groups WHERE id = ?', gid);
    });
  } else {
    emitToGroup(gid, 'group:updated', { groupId: gid });
  }
  res.json({ ok: true, deleted: left === 0 });
});

router.post('/:gid/presence', memberGuard(), async (req, res) => {
  const { state = 'active', activity = null } = req.body || {};
  await db.run(
    'UPDATE group_members SET presence = ?, activity = ?, last_seen = now() WHERE group_id = ? AND user_id = ?',
    state,
    activity,
    req.params.gid,
    req.user.id,
  );
  emitToGroup(req.params.gid, 'presence', { userId: req.user.id, state, activity });
  res.json({ ok: true });
});

export default router;
