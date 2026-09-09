// Abonnement aux notifications push côté navigateur.
import { get, post } from '../api.js';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureRegistration() {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  if (reg.active) return reg;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Service worker non prêt')), 8000);
    const sw = reg.installing || reg.waiting;
    if (!sw) {
      clearTimeout(t);
      resolve();
      return;
    }
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') {
        clearTimeout(t);
        resolve();
      }
    });
  });
  return navigator.serviceWorker.ready;
}

export async function getPushState() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = !!(reg && (await reg.pushManager.getSubscription()));
  } catch {
    /* ignore */
  }
  return { supported: true, permission: Notification.permission, subscribed };
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Notifications non supportées sur ce navigateur');

  const { enabled, publicKey } = await get('/push/key');
  if (!enabled || !publicKey) {
    throw new Error("Le serveur n'a pas de clés push configurées (VAPID).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation refusée');

  const reg = await ensureRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const r = await post('/push/subscribe', { subscription: sub.toJSON() });
  return { subscribed: true, devices: r.devices };
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    const { endpoint } = sub.toJSON();
    await sub.unsubscribe().catch(() => {});
    await post('/push/unsubscribe', { endpoint }).catch(() => {});
  }
  return { subscribed: false };
}

export async function sendTestPush() {
  return post('/push/test');
}
