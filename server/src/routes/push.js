import { Router } from 'express';
import {
  pushConfigured,
  publicKey,
  saveSubscription,
  removeSubscription,
  countSubscriptions,
  sendPush,
} from '../push.js';
import { notify } from './_helpers.js';
import { emitToUser } from '../realtime.js';

const router = Router();

// Clé publique VAPID à passer à pushManager.subscribe côté navigateur.
router.get('/push/key', (_req, res) => {
  res.json({ enabled: pushConfigured(), publicKey: publicKey() });
});

router.get('/push/status', async (req, res) => {
  res.json({ enabled: pushConfigured(), devices: await countSubscriptions(req.user.id) });
});

router.post('/push/subscribe', async (req, res) => {
  await saveSubscription(req.user.id, req.body?.subscription || req.body, req.headers['user-agent'] || null);
  res.json({ ok: true, devices: await countSubscriptions(req.user.id) });
});

router.post('/push/unsubscribe', async (req, res) => {
  await removeSubscription(req.user.id, req.body?.endpoint);
  res.json({ ok: true, devices: await countSubscriptions(req.user.id) });
});

// Notification de test immédiate (bouton « Tester » dans le profil).
router.post('/push/test', async (req, res) => {
  const payload = {
    title: 'ClassMemo — test ✅',
    body: 'Les notifications fonctionnent sur cet appareil.',
    url: '/notifications',
    tag: 'classmemo-test',
  };
  const sent = await sendPush(req.user.id, payload);
  const n = await notify(req.user.id, {
    kind: 'reminder',
    title: payload.title,
    body: payload.body,
  });
  emitToUser(req.user.id, 'notification', n);
  res.json({ ok: true, sent });
});

export default router;
