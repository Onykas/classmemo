import { Router } from 'express';
import { db, parseJson } from '../db.js';
import { newId } from './_helpers.js';

const router = Router();

async function guardQuiz(req, res, next) {
  try {
    const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' });
    const course = await db.get('SELECT * FROM courses WHERE id = ?', quiz.course_id);
    if (!(await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', course.group_id, req.user.id))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.quiz = quiz;
    next();
  } catch (err) {
    next(err);
  }
}

router.post('/quiz/:quizId/attempt', guardQuiz, async (req, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const questions = await db.all(
    'SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC',
    req.quiz.id,
  );

  const results = questions.map((q, i) => {
    const given = answers[i];
    return {
      questionId: q.id,
      given,
      correctIndex: q.correct_index,
      correct: given === q.correct_index,
      explanation: q.explanation,
      options: parseJson(q.options, []),
      question: q.question,
    };
  });
  const score = results.filter((r) => r.correct).length;

  const id = newId();
  await db.run(
    'INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total, answers) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    req.quiz.id,
    req.user.id,
    score,
    questions.length,
    JSON.stringify(answers),
  );

  res.json({ attemptId: id, score, total: questions.length, results });
});

router.get('/quiz/:quizId/attempts', guardQuiz, async (req, res) => {
  const rows = await db.all(
    'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10',
    req.quiz.id,
    req.user.id,
  );
  res.json(rows.map((a) => ({ id: a.id, score: a.score, total: a.total, createdAt: a.created_at })));
});

export default router;
