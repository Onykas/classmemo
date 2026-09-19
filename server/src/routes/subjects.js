import { Router } from 'express';
import { db } from '../db.js';
import { newId, memberGuard, serializeCourse } from './_helpers.js';

const router = Router();

async function serializeSubject(s) {
  // Compte tous les cours (pas seulement publiés) : sinon une matière avec
  // un cours en préparation affiche « 0 cours » à tort.
  const courseCount = Number(
    (await db.get('SELECT COUNT(*) n FROM courses WHERE subject_id = ?', s.id)).n,
  );
  const flashcardCount = Number(
    (await db.get('SELECT COUNT(*) n FROM flashcards WHERE subject_id = ?', s.id)).n,
  );
  const lastCourse = await db.get(
    'SELECT * FROM courses WHERE subject_id = ? ORDER BY date DESC, created_at DESC LIMIT 1',
    s.id,
  );
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
    lastCourse: lastCourse ? await serializeCourse(lastCourse, { withContent: false }) : null,
  };
}

router.get('/groups/:gid/subjects', memberGuard(), async (req, res) => {
  const rows = await db.all('SELECT * FROM subjects WHERE group_id = ? ORDER BY created_at ASC', req.params.gid);
  res.json(await Promise.all(rows.map(serializeSubject)));
});

router.post('/groups/:gid/subjects', memberGuard(), async (req, res) => {
  const { name, colorKey = 'psm', description = null, semester = null } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom de matière requis' });
  const id = newId();
  await db.run(
    'INSERT INTO subjects (id, group_id, name, color_key, description, semester) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    req.params.gid,
    String(name).trim(),
    colorKey,
    description,
    semester,
  );
  res.json(await serializeSubject(await db.get('SELECT * FROM subjects WHERE id = ?', id)));
});

router.get('/subjects/:id', async (req, res) => {
  const s = await db.get('SELECT * FROM subjects WHERE id = ?', req.params.id);
  if (!s) return res.status(404).json({ error: 'Matière introuvable' });
  if (!(await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', s.group_id, req.user.id))) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  // Tous les cours de la matière, quel que soit leur état (draft/analyzing/
  // ready/published) : rien ne doit sembler avoir disparu.
  const rows = await db.all(
    'SELECT * FROM courses WHERE subject_id = ? ORDER BY date DESC, created_at DESC',
    s.id,
  );
  const courses = await Promise.all(rows.map((c) => serializeCourse(c, { withContent: false })));
  res.json({ ...(await serializeSubject(s)), courses });
});

export default router;
