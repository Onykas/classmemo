import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { db, j, parseJson } from '../db.js';
import { UPLOAD_DIR } from '../env.js';
import { newId, memberGuard, courseGuard, serializeCourse, notify, membersOfGroup } from './_helpers.js';
import { generateStudyKit } from '../anthropic.js';
import { emitToGroup, emitToUser } from '../realtime.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase().slice(0, 6);
    cb(null, `${Date.now()}-${newId()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 } });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Lecture ----------

router.get('/groups/:gid/courses', memberGuard(), (req, res) => {
  const { subjectId, status = 'published', limit = 50 } = req.query;
  const rows = db
    .prepare(
      `SELECT * FROM courses
        WHERE group_id = ?
          AND (@subjectId IS NULL OR subject_id = @subjectId)
          AND (@status = 'all' OR status = @status)
        ORDER BY date DESC, created_at DESC
        LIMIT @limit`,
    )
    .all(req.params.gid, {
      subjectId: subjectId || null,
      status,
      limit: Number(limit) || 50,
    });
  res.json(rows.map((c) => serializeCourse(c, { withContent: false })));
});

router.get('/courses/:id', courseGuard, (req, res) => {
  res.json(serializeCourse(req.course));
});

router.get('/courses/:id/flashcards', courseGuard, (req, res) => {
  const rows = db.prepare('SELECT * FROM flashcards WHERE course_id = ? ORDER BY created_at ASC').all(req.course.id);
  res.json(rows.map((f) => ({ id: f.id, front: f.front, back: f.back, tag: f.tag })));
});

router.get('/courses/:id/quiz', courseGuard, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE course_id = ?').get(req.course.id);
  if (!quiz) return res.json(null);
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC')
    .all(quiz.id)
    .map((q) => ({
      id: q.id,
      question: q.question,
      options: parseJson(q.options, []),
      correctIndex: q.correct_index,
      explanation: q.explanation,
    }));
  res.json({ id: quiz.id, title: quiz.title, questions });
});

router.get('/courses/:id/capsule', courseGuard, (req, res) => {
  const c = db.prepare('SELECT * FROM capsules WHERE course_id = ?').get(req.course.id);
  if (!c) return res.json(null);
  res.json({
    id: c.id,
    notion: c.notion,
    title: c.title,
    simpleTranslation: c.simple_translation,
    body: c.body,
    analogyTitle: c.analogy_title,
    analogyBody: c.analogy_body,
    keyPoints: parseJson(c.key_points, []),
    challenge: {
      question: c.challenge_question,
      options: parseJson(c.challenge_options, []),
      correctIndex: c.challenge_correct_index,
    },
  });
});

// ---------- Création / notes manuscrites ----------

router.post('/courses', memberGuard('body', 'groupId'), (req, res) => {
  const { groupId, subjectId = null, title, date = null, sessionLabel = null, location = null } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const id = newId();
  db.prepare(
    `INSERT INTO courses (id, group_id, subject_id, title, date, session_label, location, status, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
  ).run(id, groupId, subjectId, String(title).trim(), date, sessionLabel, location, req.user.id);
  res.json(serializeCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(id)));
});

router.post('/courses/:id/pages', courseGuard, upload.single('image'), (req, res) => {
  const { label = null, ocrText = '', quality = 'Net' } = req.body || {};
  const count = db.prepare('SELECT COUNT(*) n FROM course_pages WHERE course_id = ?').get(req.course.id).n;
  const id = newId();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare(
    'INSERT INTO course_pages (id, course_id, position, image_url, label, ocr_text, quality) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, req.course.id, count, imageUrl, label, ocrText, quality);
  res.json({ id, position: count, imageUrl, label, ocrText, quality });
});

router.delete('/courses/:id/pages/:pid', courseGuard, (req, res) => {
  const page = db.prepare('SELECT * FROM course_pages WHERE id = ? AND course_id = ?').get(req.params.pid, req.course.id);
  if (page?.image_url) {
    const f = path.join(UPLOAD_DIR, path.basename(page.image_url));
    fs.promises.unlink(f).catch(() => {});
  }
  db.prepare('DELETE FROM course_pages WHERE id = ? AND course_id = ?').run(req.params.pid, req.course.id);
  res.json({ ok: true });
});

// ---------- Analyse IA ----------

router.post('/courses/:id/analyze', courseGuard, (req, res) => {
  const course = req.course;
  if (course.status === 'analyzing') return res.status(409).json({ error: 'Analyse déjà en cours' });
  const note = req.body?.note ?? course.note ?? null;
  db.prepare("UPDATE courses SET status = 'analyzing', analysis_step = 1, note = ? WHERE id = ?").run(note, course.id);
  runAnalysis(course.id, req.user).catch((err) => {
    console.error('[analyze] échec', err);
    db.prepare("UPDATE courses SET status = 'draft', analysis_step = 0 WHERE id = ?").run(course.id);
  });
  res.status(202).json({ ok: true, status: 'analyzing' });
});

async function runAnalysis(courseId, user) {
  const setStep = (n) => db.prepare('UPDATE courses SET analysis_step = ? WHERE id = ?').run(n, courseId);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  const subject = course.subject_id ? db.prepare('SELECT * FROM subjects WHERE id = ?').get(course.subject_id) : null;
  const pages = db.prepare('SELECT * FROM course_pages WHERE course_id = ? ORDER BY position ASC').all(courseId);
  const text = pages.map((p) => p.ocr_text || '').filter(Boolean).join('\n\n');

  await wait(700);
  setStep(2);
  await wait(500);

  const kit = await generateStudyKit({
    apiKey: user.anthropic_key,
    model: user.model,
    text,
    course: { title: course.title, subjectName: subject?.name, date: course.date, note: course.note },
  });

  setStep(3);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE courses SET summary = ?, key_points = ?, analogy_title = ?, analogy_body = ?,
         notions = ?, reading_time = ?, generated_by = ? WHERE id = ?`,
    ).run(
      kit.summary,
      j(kit.keyPoints),
      kit.analogy.title,
      kit.analogy.body,
      j(kit.notions),
      kit.readingTime,
      kit.generatedBy,
      courseId,
    );

    db.prepare('DELETE FROM flashcards WHERE course_id = ?').run(courseId);
    const insCard = db.prepare(
      'INSERT INTO flashcards (id, course_id, subject_id, group_id, front, back, tag) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const f of kit.flashcards) {
      insCard.run(newId(), courseId, course.subject_id, course.group_id, f.front, f.back, f.tag);
    }

    db.prepare('DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)').run(courseId);
    db.prepare('DELETE FROM quizzes WHERE course_id = ?').run(courseId);
    const quizId = newId();
    db.prepare('INSERT INTO quizzes (id, course_id) VALUES (?, ?)').run(quizId, courseId);
    const insQ = db.prepare(
      'INSERT INTO quiz_questions (id, quiz_id, position, question, options, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    kit.quiz.forEach((q, i) => insQ.run(newId(), quizId, i, q.question, j(q.options), q.correctIndex, q.explanation));

    db.prepare('DELETE FROM capsules WHERE course_id = ?').run(courseId);
    const cap = kit.capsule;
    db.prepare(
      `INSERT INTO capsules (id, course_id, notion, title, simple_translation, body, analogy_title, analogy_body,
         key_points, challenge_question, challenge_options, challenge_correct_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      courseId,
      cap.notion,
      cap.title,
      cap.simpleTranslation,
      cap.body,
      cap.analogyTitle,
      cap.analogyBody,
      j(cap.keyPoints),
      cap.challenge.question,
      j(cap.challenge.options),
      cap.challenge.correctIndex,
    );

    db.prepare("UPDATE courses SET status = 'ready', analysis_step = 4 WHERE id = ?").run(courseId);
  });
  tx();

  await wait(300);
  emitToUser(user.id, 'course:ready', { courseId });
}

// ---------- Édition + publication ----------

router.patch('/courses/:id', courseGuard, (req, res) => {
  const b = req.body || {};
  const c = req.course;
  db.prepare(
    `UPDATE courses SET
       title = ?, summary = ?, key_points = ?, analogy_title = ?, analogy_body = ?, notions = ?, note = ?
     WHERE id = ?`,
  ).run(
    b.title ?? c.title,
    b.summary ?? c.summary,
    b.keyPoints ? j(b.keyPoints) : c.key_points,
    b.analogy?.title ?? c.analogy_title,
    b.analogy?.body ?? c.analogy_body,
    b.notions ? j(b.notions) : c.notions,
    b.note ?? c.note,
    c.id,
  );
  res.json(serializeCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id)));
});

router.post('/courses/:id/publish', courseGuard, (req, res) => {
  const c = req.course;
  db.prepare("UPDATE courses SET status = 'published', published_at = datetime('now') WHERE id = ?").run(c.id);

  const subject = c.subject_id ? db.prepare('SELECT * FROM subjects WHERE id = ?').get(c.subject_id) : null;
  const subjLabel = subject?.name || 'un cours';

  // salon par défaut -> message système
  let thread = db.prepare("SELECT * FROM chat_threads WHERE group_id = ? AND kind = 'default'").get(c.group_id);
  if (!thread) {
    thread = { id: newId() };
    db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon du groupe', 'default')").run(
      thread.id,
      c.group_id,
    );
  }
  const msgId = newId();
  db.prepare(
    `INSERT INTO chat_messages (id, thread_id, group_id, user_id, kind, body, card_ref)
     VALUES (?, ?, ?, NULL, 'system', ?, ?)`,
  ).run(
    msgId,
    thread.id,
    c.group_id,
    `${req.user.name} a déposé les notes : « ${c.title} »`,
    JSON.stringify({ courseId: c.id, title: c.title, excerpt: (c.summary || '').slice(0, 120) }),
  );
  emitToGroup(c.group_id, 'chat:message', {
    id: msgId,
    threadId: thread.id,
    kind: 'system',
    body: `${req.user.name} a déposé les notes : « ${c.title} »`,
    cardRef: { courseId: c.id, title: c.title },
    createdAt: new Date().toISOString(),
  });

  // notifications aux autres membres
  for (const m of membersOfGroup(c.group_id)) {
    if (m.id === req.user.id) continue;
    const n = notify(m.id, {
      groupId: c.group_id,
      kind: 'course',
      title: `Notes de ${subjLabel} déposées`,
      body: `${req.user.name} a partagé la transcription, ${c.reading_time || 5} min de lecture + flashcards.`,
      meta: { courseId: c.id },
    });
    emitToUser(m.id, 'notification', n);
  }

  // évènement calendrier lié -> validé
  db.prepare("UPDATE calendar_events SET status = 'validated' WHERE course_id = ?").run(c.id);

  res.json(serializeCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id)));
});

export default router;
