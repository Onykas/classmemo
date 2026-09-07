import { Router } from 'express';
import { db } from '../db.js';
import { newId, memberGuard } from './_helpers.js';
import { emitToGroup } from '../realtime.js';

const router = Router();

function serializeEvent(e) {
  const scribe = e.scribe_id ? db.prepare('SELECT id, name, avatar_url FROM users WHERE id = ?').get(e.scribe_id) : null;
  return {
    id: e.id,
    groupId: e.group_id,
    courseId: e.course_id,
    subjectLabel: e.subject_label,
    colorKey: e.color_key,
    title: e.title,
    description: e.description,
    date: e.date,
    startTime: e.start_time,
    endTime: e.end_time,
    location: e.location,
    status: e.status,
    scribe: scribe && { id: scribe.id, name: scribe.name, avatarUrl: scribe.avatar_url },
  };
}

router.get('/groups/:gid/events', memberGuard(), (req, res) => {
  const { month } = req.query; // YYYY-MM
  const rows = month
    ? db.prepare("SELECT * FROM calendar_events WHERE group_id = ? AND date LIKE ? ORDER BY date, start_time").all(req.params.gid, `${month}%`)
    : db.prepare('SELECT * FROM calendar_events WHERE group_id = ? ORDER BY date, start_time').all(req.params.gid);
  res.json(rows.map(serializeEvent));
});

router.post('/groups/:gid/events', memberGuard(), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.date) return res.status(400).json({ error: 'Titre et date requis' });
  const id = newId();
  db.prepare(
    `INSERT INTO calendar_events (id, group_id, subject_label, color_key, title, description, date, start_time, end_time, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.params.gid,
    b.subjectLabel || null,
    b.colorKey || 'psm',
    String(b.title).trim(),
    b.description || null,
    b.date,
    b.startTime || null,
    b.endTime || null,
    b.location || null,
    b.status || 'scheduled',
  );
  const ev = serializeEvent(db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id));
  emitToGroup(req.params.gid, 'calendar:updated', { eventId: id });
  res.json(ev);
});

router.patch('/events/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Évènement introuvable' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(e.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const b = req.body || {};
  // "Je prends" : scribeId = "me"
  const scribeId = b.scribeId === 'me' ? req.user.id : b.scribeId === null ? null : b.scribeId ?? e.scribe_id;
  db.prepare(
    'UPDATE calendar_events SET title = ?, description = ?, date = ?, start_time = ?, end_time = ?, location = ?, status = ?, scribe_id = ? WHERE id = ?',
  ).run(
    b.title ?? e.title,
    b.description ?? e.description,
    b.date ?? e.date,
    b.startTime ?? e.start_time,
    b.endTime ?? e.end_time,
    b.location ?? e.location,
    b.status ?? e.status,
    scribeId,
    e.id,
  );
  const ev = serializeEvent(db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(e.id));
  emitToGroup(e.group_id, 'calendar:updated', { eventId: e.id });
  res.json(ev);
});

export default router;
