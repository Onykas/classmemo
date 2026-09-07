import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, checkPassword, signToken, publicUser, authMiddleware } from '../auth.js';
import { newId, membersOfGroup } from './_helpers.js';

const router = Router();

async function groupsForUser(userId) {
  const rows = await db.all(
    `SELECT g.* FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
      ORDER BY gm.joined_at ASC`,
    userId,
  );
  const out = [];
  for (const g of rows) {
    out.push({
      id: g.id,
      name: g.name,
      code: g.code,
      subjectLabel: g.subject_label,
      maxMembers: g.max_members,
      members: await membersOfGroup(g.id),
    });
  }
  return out;
}

async function sessionPayload(user) {
  return {
    token: signToken(user),
    user: publicUser(user),
    groups: await groupsForUser(user.id),
  };
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Champs manquants' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min.)' });
  const existing = await db.get('SELECT 1 FROM users WHERE email = ?', String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé' });

  const id = newId();
  await db.run(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    id,
    String(email).toLowerCase(),
    hashPassword(String(password)),
    String(name).trim(),
  );
  const user = await db.get('SELECT * FROM users WHERE id = ?', id);
  res.json(await sessionPayload(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.get('SELECT * FROM users WHERE email = ?', String(email || '').toLowerCase());
  if (!user || !checkPassword(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  }
  res.json(await sessionPayload(user));
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: publicUser(req.user), groups: await groupsForUser(req.user.id) });
});

export default router;
