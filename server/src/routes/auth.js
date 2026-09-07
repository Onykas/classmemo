import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, checkPassword, signToken, publicUser, authMiddleware } from '../auth.js';
import { newId, membersOfGroup } from './_helpers.js';

const router = Router();

function groupsForUser(userId) {
  const rows = db
    .prepare(
      `SELECT g.* FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY gm.joined_at ASC`,
    )
    .all(userId);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    subjectLabel: g.subject_label,
    maxMembers: g.max_members,
    members: membersOfGroup(g.id),
  }));
}

function sessionPayload(user) {
  return {
    token: signToken(user),
    user: publicUser(user),
    groups: groupsForUser(user.id),
  };
}

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Champs manquants' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min.)' });
  const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé' });

  const id = newId();
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
    id,
    String(email).toLowerCase(),
    hashPassword(String(password)),
    String(name).trim(),
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(sessionPayload(user));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!user || !checkPassword(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  }
  res.json(sessionPayload(user));
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user), groups: groupsForUser(req.user.id) });
});

export default router;
