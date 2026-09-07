import { Router } from 'express';
import { db } from '../db.js';
import { newId, memberGuard, serializeCourse } from './_helpers.js';

const router = Router();

function serializeSubject(s) {
  const courseCount = db
    .prepare("SELECT COUNT(*) n FROM courses WHERE subject_id = ? AND status = 'published'")
    .get(s.id).n;
  const flashcardCount = db.prepare('SELECT COUNT(*) n FROM flashcards WHERE subject_id = ?').get(s.id).n;
  const lastCourse = db
    .prepare(
      "SELECT * FROM courses WHERE subject_id = ? AND status = 'published' ORDER BY date DESC, created_at DESC LIMIT 1",
    )
    .get(s.id);
  return {
    id: s.id,
    groupId: s.group_id,
    name: s.name,
    colorKey: s.color_key,
    description: s.description,
    modulesCount: s.modules_count,
    semester: s.semester,
    courseCount,
    flashcardCount,
    lastCourse: lastCourse ? serializeCourse(lastCourse, { withContent: false }) : null,
  };
}

router.get('/groups/:gid/subjects', memberGuard(), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM subjects WHERE group_id = ? ORDER BY created_at ASC')
    .all(req.params.gid);
  res.json(rows.map(serializeSubject));
});

router.post('/groups/:gid/subjects', memberGuard(), (req, res) => {
  const { name, colorKey = 'psm', description = null, semester = null } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom de matière requis' });
  const id = newId();
  db.prepare(
    'INSERT INTO subjects (id, group_id, name, color_key, description, semester) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, req.params.gid, String(name).trim(), colorKey, description, semester);
  res.json(serializeSubject(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)));
});

router.get('/subjects/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Matière introuvable' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(s.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const courses = db
    .prepare("SELECT * FROM courses WHERE subject_id = ? AND status = 'published' ORDER BY date DESC")
    .all(s.id)
    .map((c) => serializeCourse(c, { withContent: false }));
  res.json({ ...serializeSubject(s), courses });
});

export default router;
