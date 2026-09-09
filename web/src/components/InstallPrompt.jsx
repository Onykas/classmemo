import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';

const DISMISS_KEY = 'cm_install_dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

/**
 * Bandeau « Ajouter à l'écran d'accueil ».
 * - Android/Chrome : bouton qui déclenche l'invite native (beforeinstallprompt).
 * - iOS/Safari : petite notice illustrée (pas d'invite native possible).
 * Masqué si l'app est déjà installée ou si l'utilisateur a fermé le bandeau.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  const ios = isIos();
  if (!deferred && !ios) return null; // navigateur sans invite (desktop, Firefox mobile…)

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setInstalled(true);
  };

  return (
    <div className="mb-space-sm rounded-2xl bg-primary-fixed/50 ring-1 ring-primary/15 p-space-sm flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-surface-container-lowest text-primary flex items-center justify-center flex-shrink-0">
        <Icon name="install_mobile" size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-label-md font-bold text-on-surface">Installer ClassMemo</p>
        {ios ? (
          <p className="text-caption text-on-surface-variant mt-0.5">
            Appuie sur <Icon name="ios_share" size={14} className="align-text-bottom" /> en bas de
            Safari, puis <b>« Sur l'écran d'accueil »</b>.
          </p>
        ) : (
          <p className="text-caption text-on-surface-variant mt-0.5">
            Ajoute l'app à ton écran d'accueil pour l'ouvrir en un geste et recevoir les rappels.
          </p>
        )}
        {!ios && (
          <button
            onClick={install}
            className="mt-2 h-9 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold"
          >
            Ajouter à l'écran d'accueil
          </button>
        )}
      </div>
      <button onClick={close} className="text-on-surface-variant flex-shrink-0" aria-label="Fermer">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
