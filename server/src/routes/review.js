import { Router } from 'express';
import { db } from '../db.js';
import { memberGuard } from './_helpers.js';
import { sm2, GRADE_QUALITY } from '../sm2.js';

const router = Router();

// File de révision : cartes dues (ou jamais vues) de la tablée, pour l'utilisateur.
router.get('/review/queue', memberGuard('query', 'groupId'), (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const rows = db
    .prepare(
      `SELECT f.*, r.due_date, r.reps, c.title AS course_title, s.color_key AS subject_color
         FROM flashcards f
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
         LEFT JOIN courses c ON c.id = f.course_id
         LEFT JOIN subjects s ON s.id = f.subject_id
        WHERE f.group_id = @gid
          AND c.status = 'published'
          AND (r.due_date IS NULL OR r.due_date <= date('now'))
        ORDER BY (r.due_date IS NULL) DESC, r.due_date ASC, f.created_at ASC
        LIMIT @limit`,
    )
    .all({ uid: req.user.id, gid: req.groupId, limit });

  const totalDue = db
    .prepare(
      `SELECT COUNT(*) n FROM flashcards f
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
         LEFT JOIN courses c ON c.id = f.course_id
        WHERE f.group_id = @gid AND c.status = 'published'
          AND (r.due_date IS NULL OR r.due_date <= date('now'))`,
    )
    .get({ uid: req.user.id, gid: req.groupId }).n;

  res.json({
    due: totalDue,
    cards: rows.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      tag: f.tag,
      courseId: f.course_id,
      courseTitle: f.course_title,
      subjectColor: f.subject_color || 'psm',
      isNew: f.due_date == null,
    })),
  });
});

router.post('/review/grade', (req, res) => {
  const { flashcardId, grade } = req.body || {};
  const quality = GRADE_QUALITY[grade];
  if (quality == null) return res.status(400).json({ error: 'Note invalide' });

  const card = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(flashcardId);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(card.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const prev = db
    .prepare('SELECT * FROM flashcard_reviews WHERE flashcard_id = ? AND user_id = ?')
    .get(flashcardId, req.user.id);
  const next = sm2(prev, quality);

  db.prepare(
    `INSERT INTO flashcard_reviews (flashcard_id, user_id, ease, interval, reps, due_date, last_grade, last_reviewed)
     VALUES (@fid, @uid, @ease, @interval, @reps, @due, @grade, datetime('now'))
     ON CONFLICT(flashcard_id, user_id) DO UPDATE SET
       ease = @ease, interval = @interval, reps = @reps, due_date = @due,
       last_grade = @grade, last_reviewed = datetime('now')`,
  ).run({
    fid: flashcardId,
    uid: req.user.id,
    ease: next.ease,
    interval: next.interval,
    reps: next.reps,
    due: next.dueDate,
    grade: quality,
  });

  res.json({ dueDate: next.dueDate, intervalDays: next.interval });
});

router.get('/review/summary', memberGuard('query', 'groupId'), (req, res) => {
  const gid = req.groupId;
  const dueCards = db
    .prepare(
      `SELECT COUNT(*) n FROM flashcards f
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
         LEFT JOIN courses c ON c.id = f.course_id
        WHERE f.group_id = @gid AND c.status = 'published'
          AND (r.due_date IS NULL OR r.due_date <= date('now'))`,
    )
    .get({ uid: req.user.id, gid }).n;

  // notion "à réviser" mise en avant : dernière carte vue il y a le plus longtemps, sinon une nouvelle
  const spotlight = db
    .prepare(
      `SELECT f.front, f.back, f.tag, r.last_reviewed FROM flashcards f
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
         LEFT JOIN courses c ON c.id = f.course_id
        WHERE f.group_id = @gid AND c.status = 'published'
          AND (r.due_date IS NULL OR r.due_date <= date('now'))
        ORDER BY r.last_reviewed IS NULL DESC, r.last_reviewed ASC LIMIT 1`,
    )
    .get({ uid: req.user.id, gid });

  res.json({
    dueCards,
    spotlight: spotlight
      ? { title: spotlight.front, hint: spotlight.back, tag: spotlight.tag, lastReviewed: spotlight.last_reviewed }
      : null,
  });
});

export default router;
