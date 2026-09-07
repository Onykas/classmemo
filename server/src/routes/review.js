import { Router } from 'express';
import { db, TODAY } from '../db.js';
import { memberGuard } from './_helpers.js';
import { sm2, GRADE_QUALITY } from '../sm2.js';

const router = Router();

router.get('/review/queue', memberGuard('query', 'groupId'), async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const today = TODAY();
  const rows = await db.all(
    `SELECT f.*, r.due_date, r.reps, c.title AS course_title, s.color_key AS subject_color
       FROM flashcards f
       LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
       LEFT JOIN courses c ON c.id = f.course_id
       LEFT JOIN subjects s ON s.id = f.subject_id
      WHERE f.group_id = @gid
        AND c.status = 'published'
        AND (r.due_date IS NULL OR r.due_date <= @today)
      ORDER BY (r.due_date IS NULL) DESC, r.due_date ASC, f.created_at ASC
      LIMIT @limit`,
    { uid: req.user.id, gid: req.groupId, today, limit },
  );

  const totalDue = Number(
    (
      await db.get(
        `SELECT COUNT(*) n FROM flashcards f
           LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
           LEFT JOIN courses c ON c.id = f.course_id
          WHERE f.group_id = @gid AND c.status = 'published'
            AND (r.due_date IS NULL OR r.due_date <= @today)`,
        { uid: req.user.id, gid: req.groupId, today },
      )
    ).n,
  );

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

router.post('/review/grade', async (req, res) => {
  const { flashcardId, grade } = req.body || {};
  const quality = GRADE_QUALITY[grade];
  if (quality == null) return res.status(400).json({ error: 'Note invalide' });

  const card = await db.get('SELECT * FROM flashcards WHERE id = ?', flashcardId);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  if (!(await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', card.group_id, req.user.id))) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const prev = await db.get(
    'SELECT * FROM flashcard_reviews WHERE flashcard_id = ? AND user_id = ?',
    flashcardId,
    req.user.id,
  );
  const next = sm2(prev, quality);

  await db.run(
    `INSERT INTO flashcard_reviews (flashcard_id, user_id, ease, interval_days, reps, due_date, last_grade, last_reviewed)
     VALUES (@fid, @uid, @ease, @interval, @reps, @due, @grade, now())
     ON CONFLICT (flashcard_id, user_id) DO UPDATE SET
       ease = @ease, interval_days = @interval, reps = @reps, due_date = @due,
       last_grade = @grade, last_reviewed = now()`,
    {
      fid: flashcardId,
      uid: req.user.id,
      ease: next.ease,
      interval: next.interval,
      reps: next.reps,
      due: next.dueDate,
      grade: quality,
    },
  );

  res.json({ dueDate: next.dueDate, intervalDays: next.interval });
});

router.get('/review/summary', memberGuard('query', 'groupId'), async (req, res) => {
  const gid = req.groupId;
  const today = TODAY();
  const dueCards = Number(
    (
      await db.get(
        `SELECT COUNT(*) n FROM flashcards f
           LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
           LEFT JOIN courses c ON c.id = f.course_id
          WHERE f.group_id = @gid AND c.status = 'published'
            AND (r.due_date IS NULL OR r.due_date <= @today)`,
        { uid: req.user.id, gid, today },
      )
    ).n,
  );

  const spotlight = await db.get(
    `SELECT f.front, f.back, f.tag, r.last_reviewed FROM flashcards f
       LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
       LEFT JOIN courses c ON c.id = f.course_id
      WHERE f.group_id = @gid AND c.status = 'published'
        AND (r.due_date IS NULL OR r.due_date <= @today)
      ORDER BY (r.last_reviewed IS NULL) DESC, r.last_reviewed ASC LIMIT 1`,
    { uid: req.user.id, gid, today },
  );

  res.json({
    dueCards,
    spotlight: spotlight
      ? { title: spotlight.front, hint: spotlight.back, tag: spotlight.tag, lastReviewed: spotlight.last_reviewed }
      : null,
  });
});

export default router;
