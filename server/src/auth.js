import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET } from './env.js';
import { db } from './db.js';

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const checkPassword = (pw, h) => bcrypt.compareSync(pw, h);
export const signToken = (user) => jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    return (await db.get('SELECT * FROM users WHERE id = ?', id)) || null;
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'Non authentifié·e' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    roleLabel: u.role_label,
    avatarUrl: u.avatar_url,
    model: u.model,
    hasKey: !!u.anthropic_key,
    reminderFreq: u.reminder_freq,
    eveningReminder: !!u.evening_reminder,
    srEnabled: !!u.sr_enabled,
  };
}
