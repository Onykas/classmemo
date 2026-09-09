import { Router } from 'express';
import multer from 'multer';
import { db, j, parseJson } from '../db.js';
import { newId, memberGuard, courseGuard, serializeCourse, notify, membersOfGroup } from './_helpers.js';
import { generateStudyKit } from '../anthropic.js';
import { emitToGroup, emitToUser } from '../realtime.js';
import { sendPush } from '../push.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Lecture ----------

router.get('/groups/:gid/courses', memberGuard(), async (req, res) => {
  const { subjectId, status = 'published', limit = 50 } = req.query;
  const rows = await db.all(
    `SELECT * FROM courses
      WHERE group_id = ?
        AND (@subjectId::text IS NULL OR subject_id = @subjectId)
        AND (@status::text = 'all' OR status = @status)
      ORDER BY date DESC, created_at DESC
      LIMIT @limit::int`,
    req.params.gid,
    { subjectId: subjectId || null, status, limit: Number(limit) || 50 },
  );
  res.json(await Promise.all(rows.map((c) => serializeCourse(c, { withContent: false }))));
});

router.get('/courses/:id', courseGuard, async (req, res) => {
  res.json(await serializeCourse(req.course));
});

router.get('/courses/:id/flashcards', courseGuard, async (req, res) => {
  const rows = await db.all('SELECT * FROM flashcards WHERE course_id = ? ORDER BY created_at ASC', req.course.id);
  res.json(rows.map((f) => ({ id: f.id, front: f.front, back: f.back, tag: f.tag })));
});

router.get('/courses/:id/quiz', courseGuard, async (req, res) => {
  const quiz = await db.get('SELECT * FROM quizzes WHERE course_id = ?', req.course.id);
  if (!quiz) return res.json(null);
  const questions = (
    await db.all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC', quiz.id)
  ).map((q) => ({
    id: q.id,
    question: q.question,
    options: parseJson(q.options, []),
    correctIndex: q.correct_index,
    explanation: q.explanation,
  }));
  res.json({ id: quiz.id, title: quiz.title, questions });
});

router.get('/courses/:id/capsule', courseGuard, async (req, res) => {
  const c = await db.get('SELECT * FROM capsules WHERE course_id = ?', req.course.id);
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

const sessionLabelFor = (date) => {
  if (!date) return 'Séance';
  const d = new Date(date + 'T00:00:00');
  return Number.isNaN(d.getTime())
    ? 'Séance'
    : 'Séance du ' + d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

router.post('/courses', memberGuard('body', 'groupId'), async (req, res) => {
  const {
    groupId,
    subjectId = null,
    title,
    teacher = null,
    date = null,
    sessionLabel = null,
    location = null,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const id = newId();
  await db.run(
    `INSERT INTO courses (id, group_id, subject_id, title, teacher, date, session_label, location, status, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    id,
    groupId,
    subjectId,
    String(title).trim(),
    teacher ? String(teacher).trim() : null,
    date,
    sessionLabel,
    location,
    req.user.id,
  );
  // Première séance.
  const sid = newId();
  await db.run(
    'INSERT INTO course_sessions (id, course_id, group_id, date, label, author_id) VALUES (?, ?, ?, ?, ?, ?)',
    sid,
    id,
    groupId,
    date,
    sessionLabel || sessionLabelFor(date),
    req.user.id,
  );
  const course = await serializeCourse(await db.get('SELECT * FROM courses WHERE id = ?', id));
  res.json({ ...course, currentSessionId: sid });
});

// Nouvelle séance sur un cours existant (cours évolutif).
router.post('/courses/:id/sessions', courseGuard, async (req, res) => {
  const { date = null, label = null, note = null } = req.body || {};
  const sid = newId();
  await db.run(
    'INSERT INTO course_sessions (id, course_id, group_id, date, label, note, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sid,
    req.course.id,
    req.course.group_id,
    date,
    label || sessionLabelFor(date),
    note,
    req.user.id,
  );
  res.json({ id: sid, courseId: req.course.id, date, label: label || sessionLabelFor(date) });
});

router.get('/courses/:id/sessions', courseGuard, async (req, res) => {
  const rows = await db.all(
    `SELECT s.*, (SELECT COUNT(*) FROM course_pages p WHERE p.session_id = s.id) AS page_count
       FROM course_sessions s WHERE s.course_id = ? ORDER BY s.date ASC, s.created_at ASC`,
    req.course.id,
  );
  res.json(
    rows.map((s) => ({
      id: s.id,
      date: s.date,
      label: s.label,
      note: s.note,
      authorId: s.author_id,
      pageCount: Number(s.page_count || 0),
    })),
  );
});

router.post('/courses/:id/pages', courseGuard, upload.single('image'), async (req, res) => {
  const { label = null, ocrText = '', quality = 'Net', imageData = null, sessionId = null } = req.body || {};
  const count = Number(
    (await db.get('SELECT COUNT(*) n FROM course_pages WHERE course_id = ?', req.course.id)).n,
  );
  // Rattache à la séance donnée, sinon à la dernière séance du cours.
  const session =
    (sessionId && (await db.get('SELECT id FROM course_sessions WHERE id = ? AND course_id = ?', sessionId, req.course.id))) ||
    (await db.get('SELECT id FROM course_sessions WHERE course_id = ? ORDER BY created_at DESC LIMIT 1', req.course.id));
  const id = newId();
  let stored = null;
  let mime = 'image/jpeg';
  if (req.file) {
    stored = req.file.buffer.toString('base64');
    mime = req.file.mimetype || mime;
  } else if (imageData && String(imageData).startsWith('data:')) {
    stored = String(imageData); // data URI complète
  }
  const imageUrl = stored ? `/uploads/${id}` : null;
  await db.run(
    'INSERT INTO course_pages (id, course_id, session_id, position, image_url, image_data, label, ocr_text, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    req.course.id,
    session?.id || null,
    count,
    imageUrl,
    stored && !stored.startsWith('data:') ? `data:${mime};base64,${stored}` : stored,
    label,
    ocrText,
    quality,
  );
  res.json({ id, position: count, imageUrl, label, ocrText, quality });
});

router.delete('/courses/:id/pages/:pid', courseGuard, async (req, res) => {
  await db.run('DELETE FROM course_pages WHERE id = ? AND course_id = ?', req.params.pid, req.course.id);
  res.json({ ok: true });
});

// ---------- Analyse IA ----------

router.post('/courses/:id/analyze', courseGuard, async (req, res) => {
  const course = req.course;
  if (course.status === 'analyzing') return res.status(409).json({ error: 'Analyse déjà en cours' });
  const note = req.body?.note ?? course.note ?? null;
  await db.run("UPDATE courses SET status = 'analyzing', analysis_step = 1, note = ? WHERE id = ?", note, course.id);
  runAnalysis(course.id, req.user).catch(async (err) => {
    console.error('[analyze] échec', err);
    await db.run("UPDATE courses SET status = 'draft', analysis_step = 0 WHERE id = ?", course.id).catch(() => {});
  });
  res.status(202).json({ ok: true, status: 'analyzing' });
});

async function runAnalysis(courseId, user) {
  const setStep = (n) => db.run('UPDATE courses SET analysis_step = ? WHERE id = ?', n, courseId);
  const course = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
  const subject = course.subject_id ? await db.get('SELECT * FROM subjects WHERE id = ?', course.subject_id) : null;

  // Texte cumulé de TOUTES les séances, dans l'ordre chronologique, avec un
  // en-tête par séance pour que l'IA suive la progression du cours.
  const sessions = await db.all(
    'SELECT * FROM course_sessions WHERE course_id = ? ORDER BY date ASC, created_at ASC',
    courseId,
  );
  const chunks = [];
  for (const s of sessions) {
    const sp = await db.all(
      'SELECT ocr_text FROM course_pages WHERE session_id = ? ORDER BY position ASC',
      s.id,
    );
    const body = sp.map((p) => p.ocr_text || '').filter(Boolean).join('\n\n');
    if (body) chunks.push(`### ${s.label || 'Séance'}${s.date ? ' (' + s.date + ')' : ''}\n${body}`);
  }
  // Pages jamais rattachées à une séance (sécurité).
  const orphan = await db.all(
    'SELECT ocr_text FROM course_pages WHERE course_id = ? AND session_id IS NULL ORDER BY position ASC',
    courseId,
  );
  const orphanText = orphan.map((p) => p.ocr_text || '').filter(Boolean).join('\n\n');
  if (orphanText) chunks.push(orphanText);
  const text = chunks.join('\n\n');

  await wait(700);
  await setStep(2);
  await wait(500);

  const kit = await generateStudyKit({
    apiKey: user.anthropic_key,
    model: user.model,
    text,
    course: { title: course.title, subjectName: subject?.name, date: course.date, note: course.note },
  });

  await setStep(3);

  await db.tx(async (q) => {
    await q(
      `UPDATE courses SET summary = ?, key_points = ?, analogy_title = ?, analogy_body = ?,
         notions = ?, reading_time = ?, generated_by = ? WHERE id = ?`,
      kit.summary,
      j(kit.keyPoints),
      kit.analogy.title,
      kit.analogy.body,
      j(kit.notions),
      kit.readingTime,
      kit.generatedBy,
      courseId,
    );

    // Upsert des flashcards par « front » normalisé : on garde les cartes
    // déjà connues (et donc la progression SM-2 de chacun), on ajoute les
    // nouvelles, on retire celles que l'IA ne produit plus.
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = await q('SELECT id, front FROM flashcards WHERE course_id = ?', courseId);
    const byFront = new Map(existing.rows.map((r) => [norm(r.front), r.id]));
    const keep = new Set();
    for (const f of kit.flashcards) {
      const key = norm(f.front);
      const found = byFront.get(key);
      if (found) {
        keep.add(found);
        await q('UPDATE flashcards SET back = ?, tag = ? WHERE id = ?', f.back, f.tag, found);
      } else {
        const fid = newId();
        keep.add(fid);
        await q(
          'INSERT INTO flashcards (id, course_id, subject_id, group_id, front, back, tag) VALUES (?, ?, ?, ?, ?, ?, ?)',
          fid,
          courseId,
          course.subject_id,
          course.group_id,
          f.front,
          f.back,
          f.tag,
        );
      }
    }
    for (const r of existing.rows) {
      if (!keep.has(r.id)) {
        await q('DELETE FROM flashcard_reviews WHERE flashcard_id = ?', r.id);
        await q('DELETE FROM flashcards WHERE id = ?', r.id);
      }
    }

    await q('DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)', courseId);
    await q('DELETE FROM quizzes WHERE course_id = ?', courseId);
    const quizId = newId();
    await q('INSERT INTO quizzes (id, course_id) VALUES (?, ?)', quizId, courseId);
    for (let i = 0; i < kit.quiz.length; i++) {
      const qq = kit.quiz[i];
      await q(
        'INSERT INTO quiz_questions (id, quiz_id, position, question, options, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newId(),
        quizId,
        i,
        qq.question,
        j(qq.options),
        qq.correctIndex,
        qq.explanation,
      );
    }

    await q('DELETE FROM capsules WHERE course_id = ?', courseId);
    const cap = kit.capsule;
    await q(
      `INSERT INTO capsules (id, course_id, notion, title, simple_translation, body, analogy_title, analogy_body,
         key_points, challenge_question, challenge_options, challenge_correct_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    await q("UPDATE courses SET status = 'ready', analysis_step = 4 WHERE id = ?", courseId);
  });

  await wait(300);
  emitToUser(user.id, 'course:ready', { courseId });
}

// ---------- Édition + publication ----------

router.patch('/courses/:id', courseGuard, async (req, res) => {
  const b = req.body || {};
  const c = req.course;
  await db.run(
    `UPDATE courses SET
       title = ?, summary = ?, key_points = ?, analogy_title = ?, analogy_body = ?, notions = ?, note = ?
     WHERE id = ?`,
    b.title ?? c.title,
    b.summary ?? c.summary,
    b.keyPoints ? j(b.keyPoints) : c.key_points,
    b.analogy?.title ?? c.analogy_title,
    b.analogy?.body ?? c.analogy_body,
    b.notions ? j(b.notions) : c.notions,
    b.note ?? c.note,
    c.id,
  );
  res.json(await serializeCourse(await db.get('SELECT * FROM courses WHERE id = ?', c.id)));
});

router.post('/courses/:id/publish', courseGuard, async (req, res) => {
  const c = req.course;
  await db.run("UPDATE courses SET status = 'published', published_at = now() WHERE id = ?", c.id);

  const subject = c.subject_id ? await db.get('SELECT * FROM subjects WHERE id = ?', c.subject_id) : null;
  const subjLabel = subject?.name || 'un cours';

  let thread = await db.get("SELECT * FROM chat_threads WHERE group_id = ? AND kind = 'default'", c.group_id);
  if (!thread) {
    const tid = newId();
    await db.run(
      "INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon du groupe', 'default')",
      tid,
      c.group_id,
    );
    thread = { id: tid };
  }
  const body = `${req.user.name} a déposé les notes : « ${c.title} »`;
  const msgId = newId();
  await db.run(
    `INSERT INTO chat_messages (id, thread_id, group_id, user_id, kind, body, card_ref)
     VALUES (?, ?, ?, NULL, 'system', ?, ?)`,
    msgId,
    thread.id,
    c.group_id,
    body,
    JSON.stringify({ courseId: c.id, title: c.title, excerpt: (c.summary || '').slice(0, 120) }),
  );
  emitToGroup(c.group_id, 'chat:message', {
    id: msgId,
    threadId: thread.id,
    kind: 'system',
    body,
    cardRef: { courseId: c.id, title: c.title },
    createdAt: new Date().toISOString(),
  });

  for (const m of await membersOfGroup(c.group_id)) {
    if (m.id === req.user.id) continue;
    const title = `Notes de ${subjLabel} déposées`;
    const bodyText = `${req.user.name} a partagé la transcription, ${c.reading_time || 5} min de lecture + flashcards.`;
    const n = await notify(m.id, {
      groupId: c.group_id,
      kind: 'course',
      title,
      body: bodyText,
      meta: { courseId: c.id },
    });
    emitToUser(m.id, 'notification', n);
    sendPush(m.id, { title, body: bodyText, url: `/courses/${c.id}`, tag: `course-${c.id}` }).catch(() => {});
  }

  await db.run("UPDATE calendar_events SET status = 'validated' WHERE course_id = ?", c.id);

  res.json(await serializeCourse(await db.get('SELECT * FROM courses WHERE id = ?', c.id)));
});

export default router;
