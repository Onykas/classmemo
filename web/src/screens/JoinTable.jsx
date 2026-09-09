import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { post } from '../api.js';
import { Btn, Card, Icon, useToast } from '../components/ui.jsx';

export default function JoinTable() {
  const { refresh, selectGroup, logout, group } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const addMode = params.get('add') === '1';
  const toast = useToast();
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);

  // Déjà dans une tablée et on n'est pas venu volontairement en ajouter une :
  // on renvoie vers l'app (évite de rester bloqué sur cet écran).
  if (group && !addMode) return <Navigate to="/" replace />;

  async function enterGroup(g) {
    selectGroup(g.id);
    try {
      await refresh();
      navigate('/', { replace: true });
    } catch {
      // dernier recours : rechargement complet, la session repart du token
      window.location.assign('/');
    }
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    try {
      const g = await post('/groups/join', { code: code.trim() });
      await enterGroup(g);
    } catch (err) {
      toast(err.message || 'Impossible de rejoindre la tablée', 'error');
      setBusy(false);
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const g = await post('/groups', { name: newName.trim(), subjectLabel: subject.trim() || null });
      await enterGroup(g);
    } catch (err) {
      toast(err.message || 'Impossible de créer la tablée', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full max-w-app mx-auto px-space-md py-space-2xl flex flex-col gap-space-lg">
      <div className="text-center flex flex-col items-center gap-2">
        <span className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-surface-container-high text-label-md font-semibold text-primary">
          <img src="/icon.svg" alt="" className="w-4 h-4" /> ClassMemo Tablée
        </span>
        <h1 className="text-headline-lg-mobile font-bold text-primary mt-2">
          {addMode ? 'Rejoindre une autre tablée' : "Bienvenue dans ton cercle d'étude privé"}
        </h1>
        <p className="text-body-sm text-on-surface-variant max-w-[18rem]">
          {addMode
            ? 'Saisis le code de la tablée que tu veux rejoindre. Tu pourras passer de l’une à l’autre depuis ton profil.'
            : 'ClassMemo est pensé pour de petits groupes de 3 à 4 camarades. Partagez vos notes, révisez ensemble et progressez sans stress.'}
        </p>
      </div>

      <Card className="p-space-lg flex flex-col gap-space-sm border-t-4 border-primary">
        <div className="flex items-start justify-between">
          <h2 className="text-headline-sm font-semibold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Icon name="pin" size={18} />
            </span>
            J'ai un code d'invitation
          </h2>
          <span className="text-caption font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">Recommandé</span>
        </div>
        <p className="text-body-sm text-on-surface-variant">Saisis le code partagé par ta ou ton camarade de promo.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CLAS-0000"
          className="h-14 rounded-xl bg-surface-container text-center text-headline-md font-bold tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary"
        />
        <Btn onClick={join} disabled={busy || code.trim().length < 4} iconRight="arrow_forward" className="w-full">
          Rejoindre la tablée
        </Btn>
      </Card>

      {!addMode && (
        <>
          <div className="flex items-center gap-3 text-caption uppercase tracking-wider text-on-surface-variant">
            <span className="flex-1 h-px bg-outline-variant" /> ou commencez à zéro <span className="flex-1 h-px bg-outline-variant" />
          </div>

          <Card className="p-space-lg flex flex-col gap-space-sm">
            <h2 className="text-headline-sm font-semibold flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
                <Icon name="add" size={18} />
              </span>
              Créer une nouvelle tablée
            </h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom de la tablée (ex. Tablée UX 2026)"
              className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md"
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Filière / promo (facultatif)"
              className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md"
            />
            <Btn variant="ghost" onClick={create} disabled={busy || newName.trim().length < 2} icon="group_add" className="w-full">
              Créer un groupe
            </Btn>
          </Card>
        </>
      )}

      <button
        onClick={() => (addMode ? navigate('/profile') : logout())}
        className="text-body-sm text-on-surface-variant underline self-center mt-2"
      >
        {addMode ? 'Annuler' : 'Changer de compte'}
      </button>
    </div>
  );
}
