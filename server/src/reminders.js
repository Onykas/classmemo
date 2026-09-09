/*
 * Rappels de révision quotidiens.
 * Un minuteur vérifie l'heure toutes les 5 min ; aux créneaux « matin »
 * (7 h–9 h) et « soir » (18 h–20 h) locaux, il envoie à chaque personne
 * abonnée aux notifications push un micro-rappel : une flashcard due, sinon
 * une notion d'un cours récent. Chaque créneau n'est envoyé qu'une fois/jour
 * (mémorisé dans users.reminder_last).
 */
import { db, parseJson } from './db.js';
import { REMINDER_TZ } from './env.js';
import { pushConfigured, sendPush } from './push.js';
import { notify } from './routes/_helpers.js';
import { emitToUser } from './realtime.js';

const TICK_MS = 5 * 60 * 1000;
const clip = (s, n = 170) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

// { hour: 0-23, date: 'YYYY-MM-DD', weekend: bool } dans le fuseau de référence.
function localNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  return {
    hour,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekend: ['Sat', 'Sun'].includes(get('weekday')),
  };
}

function slotFor(hour) {
  if (hour >= 7 && hour <= 9) return 'm';
  if (hour >= 18 && hour <= 20) return 'e';
  return null;
}

// Le créneau s'applique-t-il à cette personne, vu ses réglages ?
function slotApplies(user, slot, weekend) {
  const freq = user.reminder_freq || '2/jour';
  if (freq === 'Week-end off' && weekend) return false;
  if (slot === 'm') return true;
  // créneau du soir : si 2/jour, ou si le rappel de fin de journée est activé
  return freq === '2/jour' || !!user.evening_reminder;
}

async function groupIdsOf(userId) {
  const rows = await db.all('SELECT group_id FROM group_members WHERE user_id = ?', userId);
  return rows.map((r) => r.group_id);
}

// Choisit le contenu du rappel : flashcard due > notion récente > point clé.
async function pickContent(userId) {
  const gids = await groupIdsOf(userId);
  if (!gids.length) return null;
  const ph = gids.map(() => '?').join(',');
  const today = new Date().toISOString().slice(0, 10);

  const card = await db.get(
    `SELECT f.front, f.back, c.title AS course_title
       FROM flashcards f
       JOIN courses c ON c.id = f.course_id AND c.status = 'published'
       LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = ?
      WHERE f.group_id IN (${ph})
        AND (r.due_date IS NULL OR r.due_date <= ?)
      ORDER BY random() LIMIT 1`,
    userId,
    ...gids,
    today,
  );
  if (card) {
    return {
      title: `🧠 Révision du jour — ${clip(card.course_title, 40)}`,
      body: `${clip(card.front, 90)}\n➡️ ${clip(card.back, 110)}`,
      url: '/review',
    };
  }

  const courses = await db.all(
    `SELECT title, notions, key_points FROM courses
      WHERE group_id IN (${ph}) AND status = 'published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT 8`,
    ...gids,
  );
  const withNotions = courses
    .map((c) => ({ ...c, list: parseJson(c.notions, []).filter((n) => n?.term && n?.short) }))
    .filter((c) => c.list.length);
  if (withNotions.length) {
    const c = withNotions[Math.floor(Math.random() * withNotions.length)];
    const n = c.list[Math.floor(Math.random() * c.list.length)];
    return {
      title: `💡 ${clip(n.term, 48)}`,
      body: `${clip(n.short, 130)}\n— vu dans « ${clip(c.title, 40)} »`,
      url: '/subjects',
    };
  }
  const withPoints = courses
    .map((c) => ({ ...c, list: parseJson(c.key_points, []).filter(Boolean) }))
    .filter((c) => c.list.length);
  if (withPoints.length) {
    const c = withPoints[Math.floor(Math.random() * withPoints.length)];
    const p = c.list[Math.floor(Math.random() * c.list.length)];
    return {
      title: `📌 À retenir — ${clip(c.title, 40)}`,
      body: clip(p, 200),
      url: '/subjects',
    };
  }
  return null;
}

let running = false;
async function tick({ force } = {}) {
  if (running) return;
  running = true;
  try {
    const { hour, date, weekend } = localNow();
    const slot = slotFor(hour) || (force ? 'm' : null);
    if (!slot) return;
    const tag = `${date}/${slot}`;

    const users = await db.all(
      force
        ? `SELECT DISTINCT u.* FROM users u JOIN push_subscriptions p ON p.user_id = u.id`
        : `SELECT DISTINCT u.* FROM users u
             JOIN push_subscriptions p ON p.user_id = u.id
            WHERE u.reminder_last IS DISTINCT FROM ?`,
      ...(force ? [] : [tag]),
    );

    let sent = 0;
    for (const u of users) {
      if (!force && !slotApplies(u, slot, weekend)) continue;
      const content = await pickContent(u.id);
      if (!content) continue;
      try {
        await sendPush(u.id, { ...content, tag: `classmemo-reminder-${slot}` });
        const n = await notify(u.id, { kind: 'reminder', title: content.title, body: content.body });
        emitToUser(u.id, 'notification', n);
        if (!force) await db.run('UPDATE users SET reminder_last = ? WHERE id = ?', tag, u.id);
        sent += 1;
      } catch (err) {
        console.warn('[reminders] envoi échoué pour', u.id, ':', err.message);
      }
    }
    return sent;
  } catch (err) {
    console.error('[reminders] tick :', err.message);
  } finally {
    running = false;
  }
}

// Déclenchement manuel (tests / futur bouton admin) : ignore l'heure et l'anti-doublon.
export const runRemindersNow = () => tick({ force: true });

export function initReminders() {
  if (!pushConfigured()) {
    console.log('[reminders] désactivés (pas de clés VAPID).');
    return;
  }
  console.log(`[reminders] actifs — fuseau ${REMINDER_TZ}, créneaux 7-9 h et 18-20 h.`);
  setTimeout(tick, 30_000);
  setInterval(tick, TICK_MS);
}
