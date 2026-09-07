import { nanoid } from 'nanoid';
import { db, parseJson } from '../db.js';
import { publicUser } from '../auth.js';

export { parseJson };
export const j = (v) => (v == null ? null : JSON.stringify(v));
export const newId = () => nanoid(12);

export async function isMember(groupId, userId) {
  return !!(await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', groupId, userId));
}

/** Garde d'accès : l'utilisateur doit appartenir à la tablée visée. */
export function memberGuard(source = 'params', key = 'gid') {
  return async (req, res, next) => {
    try {
      const gid = req[source]?.[key] || req.body?.groupId || req.query?.groupId;
      if (!gid || !(await isMember(gid, req.user.id))) {
        return res.status(403).json({ error: 'Accès refusé à cette tablée' });
      }
      req.groupId = gid;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Garde d'accès à un cours (via sa tablée). */
export async function courseGuard(req, res, next) {
  try {
    const course = await db.get('SELECT * FROM courses WHERE id = ?', req.params.id);
    if (!course) return res.status(404).json({ error: 'Cours introuvable' });
    if (!(await isMember(course.group_id, req.user.id))) return res.status(403).json({ error: 'Accès refusé' });
    req.course = course;
    next();
  } catch (err) {
    next(err);
  }
}

export async function membersOfGroup(groupId) {
  const rows = await db.all(
    `SELECT u.*, gm.role, gm.presence, gm.activity, gm.last_seen
       FROM group_members gm JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC`,
    groupId,
  );
  return rows.map((r) => ({
    ...publicUser(r),
    role: r.role,
    presence: r.presence,
    activity: r.activity,
    lastSeen: r.last_seen,
  }));
}

export async function serializeCourse(course, { withContent = true } = {}) {
  if (!course) return null;
  const subject = course.subject_id
    ? await db.get('SELECT * FROM subjects WHERE id = ?', course.subject_id)
    : null;
  const author = course.author_id
    ? await db.get('SELECT * FROM users WHERE id = ?', course.author_id)
    : null;
  const pages = (
    await db.all('SELECT * FROM course_pages WHERE course_id = ? ORDER BY position ASC', course.id)
  ).map((p) => ({
    id: p.id,
    position: p.position,
    imageUrl: p.image_url,
    label: p.label,
    ocrText: p.ocr_text,
    quality: p.quality,
  }));
  const flashcardCount = Number(
    (await db.get('SELECT COUNT(*) n FROM flashcards WHERE course_id = ?', course.id)).n,
  );
  const quiz = await db.get('SELECT * FROM quizzes WHERE course_id = ?', course.id);
  const quizCount = quiz
    ? Number((await db.get('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id = ?', quiz.id)).n)
    : 0;
  const hasCapsule = !!(await db.get('SELECT 1 FROM capsules WHERE course_id = ?', course.id));

  const base = {
    id: course.id,
    groupId: course.group_id,
    title: course.title,
    date: course.date,
    sessionLabel: course.session_label,
    location: course.location,
    status: course.status,
    analysisStep: course.analysis_step,
    generatedBy: course.generated_by,
    readingTime: course.reading_time,
    note: course.note,
    createdAt: course.created_at,
    publishedAt: course.published_at,
    author: author && { id: author.id, name: author.name, avatarUrl: author.avatar_url },
    subject: subject && { id: subject.id, name: subject.name, colorKey: subject.color_key },
    pages,
    flashcardCount,
    quiz: quiz ? { id: quiz.id, questionCount: quizCount } : null,
    hasCapsule,
  };
  if (!withContent) return base;
  return {
    ...base,
    summary: course.summary,
    keyPoints: parseJson(course.key_points, []),
    analogy: { title: course.analogy_title, body: course.analogy_body },
    notions: parseJson(course.notions, []),
  };
}

export async function notify(userId, { groupId = null, kind, title, body = null, meta = null }) {
  const id = newId();
  await db.run(
    'INSERT INTO notifications (id, user_id, group_id, kind, title, body, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    userId,
    groupId,
    kind,
    title,
    body,
    meta ? JSON.stringify(meta) : null,
  );
  return db.get('SELECT * FROM notifications WHERE id = ?', id);
}
