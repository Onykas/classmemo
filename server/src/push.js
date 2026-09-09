/*
 * Web Push (VAPID). Envoi de notifications système aux appareils abonnés,
 * même quand l'app est fermée. Sans clés VAPID configurées, tout est inerte
 * (les fonctions renvoient simplement 0 envoi).
 */
import webpush from 'web-push';
import { db } from './db.js';
import { newId } from './routes/_helpers.js';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from './env.js';

let ready = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    ready = true;
  } catch (err) {
    console.warn('[push] clés VAPID invalides :', err.message);
  }
}

export const pushConfigured = () => ready;
export const publicKey = () => (ready ? VAPID_PUBLIC_KEY : null);

/** Enregistre / met à jour un abonnement pour un utilisateur. */
export async function saveSubscription(userId, sub, userAgent = null) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw Object.assign(new Error('Abonnement push invalide'), { status: 400 });
  }
  await db.run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent`,
    newId(),
    userId,
    sub.endpoint,
    sub.keys.p256dh,
    sub.keys.auth,
    userAgent,
  );
}

export async function removeSubscription(userId, endpoint) {
  if (!endpoint) return;
  await db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', userId, endpoint);
}

export async function countSubscriptions(userId) {
  const r = await db.get('SELECT COUNT(*) n FROM push_subscriptions WHERE user_id = ?', userId);
  return Number(r?.n || 0);
}

/**
 * Envoie une notification à tous les appareils d'un utilisateur.
 * `payload` : { title, body, url?, tag? }. Nettoie les abonnements expirés.
 * Renvoie le nombre d'envois réussis.
 */
export async function sendPush(userId, payload) {
  if (!ready) return 0;
  const subs = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', userId);
  if (!subs.length) return 0;

  const data = JSON.stringify({
    title: payload.title || 'ClassMemo',
    body: payload.body || '',
    url: payload.url || '/',
    tag: payload.tag || 'classmemo',
  });

  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        ok += 1;
      } catch (err) {
        // 404 / 410 = abonnement mort -> on le supprime.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.run('DELETE FROM push_subscriptions WHERE id = ?', s.id).catch(() => {});
        } else {
          console.warn('[push] envoi échoué :', err.statusCode || err.message);
        }
      }
    }),
  );
  return ok;
}
