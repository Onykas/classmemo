import { Router } from 'express';
import { db, parseJson } from '../db.js';
import { newId } from './_helpers.js';

const router = Router();

function guardQuiz(req, res, next) {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(quiz.course_id);
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(course.group_id, req.user.id)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  req.quiz = quiz;
  next();
}

router.post('/quiz/:quizId/attempt', guardQuiz, (req, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC')
    .all(req.quiz.id);

  const results = questions.map((q, i) => {
    const given = answers[i];
    const correct = given === q.correct_index;
    return {
      questionId: q.id,
      given,
      correctIndex: q.correct_index,
      correct,
      explanation: q.explanation,
      options: parseJson(q.options, []),
      question: q.question,
    };
  });
  const score = results.filter((r) => r.correct).length;

  const id = newId();
  db.prepare(
    'INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total, answers) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, req.quiz.id, req.user.id, score, questions.length, JSON.stringify(answers));

  res.json({ attemptId: id, score, total: questions.length, results });
});

router.get('/quiz/:quizId/attempts', guardQuiz, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(req.quiz.id, req.user.id);
  res.json(rows.map((a) => ({ id: a.id, score: a.score, total: a.total, createdAt: a.created_at })));
});

export default router;
