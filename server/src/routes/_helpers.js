import { nanoid } from 'nanoid';
import { db, parseJson } from '../db.js';
import { publicUser } from '../auth.js';

export const newId = () => nanoid(12);

export { parseJson };
export const j = (v) => (v == null ? null : JSON.stringify(v));

export function isMember(groupId, userId) {
  return !!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
}

/** Garde d'accès : l'utilisateur doit appartenir à la tablée visée. */
export function memberGuard(source = 'params', key = 'gid') {
  return (req, res, next) => {
    const gid = req[source]?.[key] || req.body?.groupId || req.query?.groupId;
    if (!gid || !isMember(gid, req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé à cette tablée' });
    }
    req.groupId = gid;
    next();
  };
}

/** Garde d'accès à un cours (via sa tablée). */
export function courseGuard(req, res, next) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Cours introuvable' });
  if (!isMember(course.group_id, req.user.id)) return res.status(403).json({ error: 'Accès refusé' });
  req.course = course;
  next();
}

export function membersOfGroup(groupId) {
  const rows = db
    .prepare(
      `SELECT u.*, gm.role, gm.presence, gm.activity, gm.last_seen
         FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY gm.joined_at ASC`,
    )
    .all(groupId);
  return rows.map((r) => ({
    ...publicUser(r),
    role: r.role,
    presence: r.presence,
    activity: r.activity,
    lastSeen: r.last_seen,
  }));
}

export function serializeCourse(course, { withContent = true } = {}) {
  if (!course) return null;
  const subject = course.subject_id
    ? db.prepare('SELECT * FROM subjects WHERE id = ?').get(course.subject_id)
    : null;
  const author = course.author_id
    ? db.prepare('SELECT * FROM users WHERE id = ?').get(course.author_id)
    : null;
  const pages = db
    .prepare('SELECT * FROM course_pages WHERE course_id = ? ORDER BY position ASC')
    .all(course.id)
    .map((p) => ({
      id: p.id,
      position: p.position,
      imageUrl: p.image_url,
      label: p.label,
      ocrText: p.ocr_text,
      quality: p.quality,
    }));
  const flashcardCount = db
    .prepare('SELECT COUNT(*) n FROM flashcards WHERE course_id = ?')
    .get(course.id).n;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE course_id = ?').get(course.id);
  const quizCount = quiz
    ? db.prepare('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id = ?').get(quiz.id).n
    : 0;
  const hasCapsule = !!db.prepare('SELECT 1 FROM capsules WHERE course_id = ?').get(course.id);

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
    subject: subject && {
      id: subject.id,
      name: subject.name,
      colorKey: subject.color_key,
    },
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

export function notify(userId, { groupId = null, kind, title, body = null, meta = null }) {
  const id = newId();
  db.prepare(
    'INSERT INTO notifications (id, user_id, group_id, kind, title, body, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, userId, groupId, kind, title, body, meta ? JSON.stringify(meta) : null);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
}
