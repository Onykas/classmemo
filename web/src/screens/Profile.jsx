import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../lib/useApi.js';
import { put } from '../api.js';
import { Avatar, Btn, Card, Icon, SubjectChip, useToast } from '../components/ui.jsx';
import { getPushState, enablePush, disablePush, sendTestPush } from '../lib/push.js';

const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', hint: 'Le plus fin' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'Équilibré' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'Rapide & éco' },
];
const PRESENCE = {
  active: { label: 'Actif', tone: 'text-primary', dot: 'bg-primary-container' },
  pause: { label: 'Pause', tone: 'text-secondary', dot: 'bg-secondary-container' },
  offline: { label: 'Hors ligne', tone: 'text-on-surface-variant', dot: 'bg-outline-variant' },
};

export default function Profile() {
  const { user, group, groups, members, logout, updateUser, selectGroup } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const subjects = useApi(group ? `/groups/${group.id}/subjects` : null, [group?.id]);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState({ supported: true, subscribed: false, permission: 'default' });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setPush).catch(() => {});
  }, []);

  async function togglePush(next) {
    setPushBusy(true);
    try {
      const r = next ? await enablePush() : await disablePush();
      setPush((p) => ({ ...p, subscribed: r.subscribed, permission: 'granted' }));
      toast(next ? 'Notifications activées sur cet appareil' : 'Notifications désactivées', 'success');
    } catch (e) {
      toast(e.message, 'error');
      setPush(await getPushState());
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushBusy(true);
    try {
      const r = await sendTestPush();
      toast(r.sent ? 'Notification de test envoyée' : 'Aucun appareil abonné', r.sent ? 'success' : 'info');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPushBusy(false);
    }
  }

  async function saveSettings(patch) {
    updateUser(patch);
    try {
      const u = await put('/me/settings', {
        reminderFreq: user.reminderFreq,
        eveningReminder: user.eveningReminder,
        srEnabled: user.srEnabled,
        model: user.model,
        ...patch,
      });
      updateUser(u);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function saveKey() {
    setBusy(true);
    try {
      const r = await put('/me/anthropic-key', { key: keyInput.trim() });
      updateUser({ hasKey: r.hasKey });
      setKeyInput('');
      toast(r.hasKey ? 'Clé API enregistrée' : 'Clé API retirée', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(group.code).then(
      () => toast('Code copié', 'success'),
      () => toast('Copie impossible', 'error'),
    );
  }

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <Card className="p-space-md flex items-center gap-3">
        <Avatar user={user} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-headline-sm font-bold text-primary flex items-center gap-1">
            {user.name} <Icon name="verified" size={16} className="text-secondary" fill />
          </p>
          <p className="text-body-sm text-on-surface-variant">{user.roleLabel}</p>
          <p className="text-caption text-on-surface-variant flex items-center gap-1 mt-0.5">
            <Icon name="groups" size={13} /> {group?.name} • {members.length} membres
          </p>
        </div>
      </Card>

      <section>
        <h2 className="text-headline-sm font-semibold flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-primary" /> Ma tablée d'étude privée
          <span className="ml-auto text-caption font-semibold bg-surface-container-high px-2 py-0.5 rounded-full">
            {members.length}/{group?.maxMembers || 4} places
          </span>
        </h2>
        <Card className="p-space-sm flex flex-col divide-y divide-surface-container">
          {members.map((m) => {
            const p = PRESENCE[m.presence] || PRESENCE.offline;
            return (
              <div key={m.id} className="flex items-center gap-3 p-space-xs">
                <div className="relative">
                  <Avatar user={m} size={40} />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface-container-lowest ${p.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-label-md text-on-surface">
                    {m.name}
                    {m.id === user.id && <span className="text-on-surface-variant"> (moi)</span>}
                  </p>
                  <p className="text-caption text-on-surface-variant truncate">{m.activity || m.role}</p>
                </div>
                <span className={`text-caption font-semibold ${p.tone}`}>{p.label}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between p-space-xs pt-3">
            <div>
              <p className="text-caption text-on-surface-variant">Code d'accès de la tablée</p>
              <p className="text-headline-sm font-bold tracking-widest text-primary">{group?.code}</p>
            </div>
            <Btn variant="ghost" icon="content_copy" onClick={copyCode}>Copier</Btn>
          </div>
          <p className="text-caption text-secondary flex items-center gap-1 p-space-xs pt-3">
            <Icon name="lock" size={13} /> Espace verrouillé à 4 étudiant·es max pour préserver l'intimité d'apprentissage.
          </p>
        </Card>

        {groups.length > 1 && (
          <Card className="p-space-sm mt-space-sm flex flex-col gap-1.5">
            <p className="text-caption font-semibold text-on-surface-variant px-1">Basculer de tablée</p>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  selectGroup(g.id);
                  toast(`Tablée active : ${g.name}`, 'success');
                  navigate('/');
                }}
                className={`flex items-center justify-between px-3 h-11 rounded-xl text-label-md font-semibold transition-colors ${
                  g.id === group?.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                }`}
              >
                <span className="truncate">{g.name}</span>
                {g.id === group?.id ? (
                  <Icon name="check" size={16} />
                ) : (
                  <span className="text-caption opacity-70">{g.code}</span>
                )}
              </button>
            ))}
          </Card>
        )}

        <button
          onClick={() => navigate('/join?add=1')}
          className="w-full h-11 mt-space-sm rounded-xl bg-surface-container-high text-primary flex items-center justify-center gap-2 text-label-md font-semibold"
        >
          <Icon name="group_add" size={18} /> Rejoindre une autre tablée
        </button>
      </section>

      <section>
        <h2 className="text-headline-sm font-semibold flex items-center gap-1.5 mb-2">
          <Icon name="tune" size={18} className="text-primary" /> Réglages pédagogiques
        </h2>
        <Card className="p-space-md flex flex-col gap-space-md">
          <div>
            <p className="text-label-md font-semibold mb-1.5">Fréquence des micro-rappels</p>
            <div className="flex bg-surface-container rounded-xl p-1 text-label-md font-semibold">
              {['1/jour', '2/jour', 'Week-end off'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => saveSettings({ reminderFreq: opt })}
                  className={`flex-1 h-9 rounded-lg transition-colors ${
                    user.reminderFreq === opt ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <Toggle
            icon="wb_twilight"
            title="Rappels doux de fin de journée"
            sub="Notification bienveillante à 18h30"
            on={user.eveningReminder}
            onChange={(v) => saveSettings({ eveningReminder: v })}
          />
          <Toggle
            icon="psychology"
            title="Répétition espacée (SM-2)"
            sub="Moteur adaptatif d'ancrage mémoriel"
            on={user.srEnabled}
            onChange={(v) => saveSettings({ srEnabled: v })}
          />

          <div>
            <Toggle
              icon="notifications_active"
              title="Notifications sur cet appareil"
              sub={
                push.supported
                  ? 'Rappels de révision aux heures choisies, même app fermée'
                  : 'Non pris en charge par ce navigateur'
              }
              on={push.subscribed}
              onChange={(v) => !pushBusy && push.supported && togglePush(v)}
            />
            {push.subscribed && (
              <div className="flex items-center gap-2 mt-2 pl-12">
                <Btn variant="ghost" onClick={testPush} disabled={pushBusy}>
                  Envoyer un test
                </Btn>
                <span className="text-caption text-on-surface-variant">
                  Créneaux : matin (7 h–9 h){user.eveningReminder || user.reminderFreq === '2/jour' ? ' et soir (18 h–20 h)' : ''}
                </span>
              </div>
            )}
            {push.supported && push.permission === 'denied' && !push.subscribed && (
              <p className="text-caption text-error mt-1 pl-12">
                Notifications bloquées : autorise-les dans les réglages du navigateur pour cet appareil.
              </p>
            )}
          </div>

          <div>
            <p className="text-label-md font-semibold mb-1.5">Modèle de génération</p>
            <div className="flex flex-col gap-1.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => saveSettings({ model: m.id })}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    user.model === m.id ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant'
                  }`}
                >
                  <span className="text-body-sm font-semibold text-on-surface">{m.label}</span>
                  <span className="text-caption text-on-surface-variant">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-label-md font-semibold mb-1">Clé API Anthropic</p>
            <p className="text-caption text-on-surface-variant mb-1.5">
              {user.hasKey
                ? 'Une clé est enregistrée. Laisse vide et enregistre pour la retirer.'
                : "Sans clé, ClassMemo génère les fiches avec un moteur heuristique local."}
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={user.hasKey ? '•••••••• (enregistrée)' : 'sk-ant-…'}
                className="flex-1 h-11 px-3 rounded-xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary text-body-sm"
              />
              <Btn variant="ghost" onClick={saveKey} disabled={busy}>Enregistrer</Btn>
            </div>
          </div>
        </Card>
      </section>

      {subjects.data && (
        <section>
          <h2 className="text-headline-sm font-semibold flex items-center gap-1.5 mb-2">
            <Icon name="menu_book" size={18} className="text-secondary" fill /> Mes matières suivies
          </h2>
          <div className="grid grid-cols-2 gap-space-sm">
            {subjects.data.map((s) => (
              <Card key={s.id} className="p-space-sm">
                <SubjectChip colorKey={s.colorKey} label={s.name} />
                <p className="text-caption text-on-surface-variant mt-1.5">{s.flashcardCount} fiches partagées</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => toast('Export PDF bientôt disponible', 'info')}
        className="w-full h-12 rounded-2xl bg-surface-container-lowest ring-1 ring-black/[0.04] shadow-card flex items-center justify-between px-4 text-label-md font-semibold"
      >
        <span className="flex items-center gap-2"><Icon name="picture_as_pdf" size={18} /> Exporter mes fiches révisées</span>
        <Icon name="chevron_right" size={18} className="text-on-surface-variant" />
      </button>

      <button
        onClick={logout}
        className="w-full h-12 rounded-2xl bg-error-container/40 text-error flex items-center justify-center gap-2 text-label-md font-semibold"
      >
        <Icon name="logout" size={18} /> Se déconnecter
      </button>
    </div>
  );
}

function Toggle({ icon, title, sub, on, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-label-md font-semibold text-on-surface">{title}</p>
        <p className="text-caption text-on-surface-variant">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ${on ? 'bg-primary' : 'bg-outline-variant'}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-surface-container-lowest transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
