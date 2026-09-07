import { Router } from 'express';
import { db, TODAY } from '../db.js';
import { memberGuard, membersOfGroup, serializeCourse } from './_helpers.js';

const router = Router();

const daysAgo = (v) => {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  const d = Math.round((Date.now() - t) / 86400000);
  return Number.isFinite(d) ? d : null;
};

router.get('/home', memberGuard('query', 'groupId'), async (req, res) => {
  const gid = req.groupId;
  const today = TODAY();
  const group = await db.get('SELECT * FROM groups WHERE id = ?', gid);
  const members = await membersOfGroup(gid);

  const recentCourseRow = await db.get(
    "SELECT * FROM courses WHERE group_id = ? AND status = 'published' ORDER BY published_at DESC, date DESC LIMIT 1",
    gid,
  );
  const recentCourse = recentCourseRow ? await serializeCourse(recentCourseRow) : null;

  const lastMsg = await db.get(
    `SELECT m.*, u.name AS uname FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ? ORDER BY m.created_at DESC LIMIT 1`,
    gid,
  );
  const activeCount = members.filter((m) => m.presence === 'active').length;
  let activity = 'Ta tablée est calme pour le moment.';
  if (lastMsg?.kind === 'system') activity = lastMsg.body;
  else if (recentCourseRow) {
    const author = members.find((m) => m.id === recentCourseRow.author_id);
    activity = `${author?.name || 'Un·e camarade'} a déposé « ${recentCourseRow.title} »`;
  }

  const spotlight = await db.get(
    `SELECT f.front, f.back, f.tag, r.last_reviewed FROM flashcards f
       LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = @uid
       LEFT JOIN courses c ON c.id = f.course_id
      WHERE f.group_id = @gid AND c.status = 'published'
        AND (r.due_date IS NULL OR r.due_date <= @today)
      ORDER BY (r.last_reviewed IS NULL) DESC, r.last_reviewed ASC LIMIT 1`,
    { uid: req.user.id, gid, today },
  );
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

  const events = (
    await db.all('SELECT * FROM calendar_events WHERE group_id = ? AND date = ? ORDER BY start_time', gid, today)
  ).map((e) => ({
    kind: 'event',
    time: e.start_time || '—',
    title: e.title,
    subtitle: e.location ? `${e.subject_label || ''} • ${e.location}` : e.subject_label || '',
    colorKey: e.color_key,
    ref: { type: 'calendar' },
  }));

  const newCourses = (
    await db.all("SELECT * FROM courses WHERE group_id = ? AND status = 'published' AND date = ?", gid, today)
  ).map((c) => ({
    kind: 'course',
    time: 'auj.',
    title: c.title,
    subtitle: 'Nouvelles notes partagées',
    ref: { type: 'course', id: c.id },
  }));

  const todayItems = [...events, ...newCourses];
  if (spotlight) {
    todayItems.push({
      kind: 'notion',
      time: 'à revoir',
      title: spotlight.front,
      subtitle: `${dueCards} carte${dueCards > 1 ? 's' : ''} en attente`,
      ref: { type: 'review' },
    });
  }

  res.json({
    group: { id: group.id, name: group.name, code: group.code },
    members,
    activity: { text: activity, activeCount, total: members.length },
    recentCourse,
    review: {
      dueCards,
      rhythm: dueCards > 6 ? 'Rythme soutenu' : 'Rythme doux',
      spotlight: spotlight
        ? {
            title: spotlight.front,
            hint: spotlight.back,
            tag: spotlight.tag,
            lastSeenDays: daysAgo(spotlight.last_reviewed),
          }
        : null,
    },
    today: todayItems,
  });
});

export default router;
