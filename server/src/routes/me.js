import { Router } from 'express';
import { db } from '../db.js';
import { publicUser } from '../auth.js';
import { memberGuard, serializeCourse } from './_helpers.js';

const router = Router();

router.put('/me/settings', async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  const allowedModels = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
  const model = allowedModels.includes(b.model) ? b.model : u.model;
  await db.run(
    'UPDATE users SET name = ?, role_label = ?, model = ?, reminder_freq = ?, evening_reminder = ?, sr_enabled = ? WHERE id = ?',
    b.name ?? u.name,
    b.roleLabel ?? u.role_label,
    model,
    b.reminderFreq ?? u.reminder_freq,
    b.eveningReminder == null ? u.evening_reminder : b.eveningReminder ? 1 : 0,
    b.srEnabled == null ? u.sr_enabled : b.srEnabled ? 1 : 0,
    u.id,
  );
  res.json(publicUser(await db.get('SELECT * FROM users WHERE id = ?', u.id)));
});

router.put('/me/anthropic-key', async (req, res) => {
  const key = String(req.body?.key ?? '').trim();
  await db.run('UPDATE users SET anthropic_key = ? WHERE id = ?', key || null, req.user.id);
  res.json({ hasKey: !!key, masked: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null });
});

router.get('/me/missed-days', async (req, res) => {
  const rows = await db.all(
    'SELECT date, status FROM missed_days WHERE user_id = ? ORDER BY date DESC',
    req.user.id,
  );
  res.json(rows);
});

router.put('/me/missed-days', async (req, res) => {
  const days = Array.isArray(req.body?.days) ? req.body.days : [];
  await db.tx(async (q) => {
    for (const d of days) {
      if (!d?.date) continue;
      await q(
        `INSERT INTO missed_days (user_id, date, status) VALUES (?, ?, ?)
         ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status`,
        req.user.id,
        d.date,
        d.status === 'absent' ? 'absent' : 'present',
      );
    }
  });
  res.json({ ok: true });
});

router.get('/groups/:gid/catchup', memberGuard(), async (req, res) => {
  const dates = String(req.query.dates || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!dates.length) return res.json({ courses: [], flashcards: 0, keyNotions: 0 });

  const placeholders = dates.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT * FROM courses WHERE group_id = ? AND status = 'published' AND date IN (${placeholders})
      ORDER BY date DESC`,
    req.params.gid,
    ...dates,
  );

  const courses = [];
  for (const c of rows) {
    const full = await serializeCourse(c);
    courses.push({ ...full, audioMinutes: Math.max(1, Math.round((c.reading_time || 4) / 2)) });
  }
  res.json({
    courses,
    flashcards: courses.reduce((n, c) => n + (c.flashcardCount || 0), 0),
    keyNotions: courses.reduce((n, c) => n + (c.notions?.length || 0), 0),
  });
});

export default router;
