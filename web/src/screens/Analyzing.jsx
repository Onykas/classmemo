import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get } from '../api.js';
import { Card, Icon } from '../components/ui.jsx';

const STEPS = [
  { label: 'Lecture et transcription des pages', sub: 'Feuillets manuscrits océrisés' },
  { label: 'Extraction des notions clés', sub: 'Vocabulaire & définitions' },
  { label: 'Création du résumé & analogie simplifiée', sub: 'Métaphores pédagogiques' },
  { label: 'Génération des flashcards et du mini-quiz', sub: "Questions d'ancrage mémoriel" },
];

export default function Analyzing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const timer = useRef(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const c = await get(`/courses/${id}`);
        if (!active) return;
        setStep(c.analysisStep || 1);
        if (c.status === 'ready' || c.status === 'published') {
          navigate(`/courses/${id}/validate`, { replace: true });
          return;
        }
        if (c.status === 'draft') {
          navigate(`/courses/${id}`, { replace: true });
          return;
        }
      } catch { /* retry */ }
      timer.current = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, [id, navigate]);

  const done = Math.max(0, step - 1);

  return (
    <div className="flex flex-col gap-space-md py-space-md">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> Traitement IA en cours
        </span>
      </div>

      <Card className="p-space-lg flex flex-col items-center text-center gap-2">
        <span className="relative w-24 h-24 rounded-full bg-primary-fixed/60 flex items-center justify-center">
          <Icon name="draft" size={40} className="text-primary" />
          <span className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
            <Icon name="auto_awesome" size={16} />
          </span>
        </span>
        <h1 className="text-headline-md font-bold text-primary">Transformation de tes notes…</h1>
        <p className="text-body-sm text-on-surface-variant max-w-[18rem]">
          Notre modèle prépare la capsule et les fiches mémo pour ton groupe.
        </p>
        <div className="w-full h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(done / STEPS.length) * 100}%` }} />
        </div>
      </Card>

      <section>
        <h2 className="text-headline-sm font-semibold flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5"><Icon name="widgets" size={18} className="text-primary" /> Étapes d'assimilation</span>
          <span className="text-caption font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">{done} / {STEPS.length}</span>
        </h2>
        <div className="flex flex-col gap-space-sm">
          {STEPS.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'active' : 'todo';
            return (
              <div
                key={i}
                className={`rounded-2xl p-space-md flex items-center gap-3 ${
                  state === 'active' ? 'bg-secondary-fixed/60' : 'bg-surface-container-low'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    state === 'done'
                      ? 'bg-primary text-on-primary'
                      : state === 'active'
                        ? 'bg-secondary text-on-secondary animate-pulse'
                        : 'bg-surface-container-highest text-outline'
                  }`}
                >
                  <Icon name={state === 'done' ? 'check' : state === 'active' ? 'sync' : 'circle'} size={18} />
                </span>
                <div className={state === 'todo' ? 'opacity-50' : ''}>
                  <p className="text-label-md font-semibold text-on-surface">{s.label}</p>
                  <p className="text-caption text-on-surface-variant">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="bg-surface-container-low rounded-2xl p-space-md">
        <p className="text-caption uppercase tracking-wider text-secondary font-bold flex items-center gap-1">
          <Icon name="lightbulb" size={14} fill /> Pendant ce temps…
        </p>
        <p className="text-body-md text-on-surface-variant italic mt-1">
          « Revoir une notion dans les 24 h après sa prise de note multiplie par 3 sa rétention à long terme. »
        </p>
        <p className="text-caption text-on-surface-variant mt-1">Courbe de l'oubli · Hermann Ebbinghaus</p>
      </div>
    </div>
  );
}
