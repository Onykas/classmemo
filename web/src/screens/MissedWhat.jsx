import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get, put } from '../api.js';
import { BackBar, Btn, Card, Icon, Spinner, SubjectChip, useToast } from '../components/ui.jsx';
import { DAY_NAMES, formatDate } from '../lib/format.js';

function lastDays(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function MissedWhat() {
  const { group } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const days = useMemo(() => lastDays(7), []);
  const [absent, setAbsent] = useState(new Set());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const key = [...absent].sort().join(',');

  useEffect(() => {
    if (!absent.size) {
      setData(null);
      return;
    }
    setLoading(true);
    get(`/groups/${group.id}/catchup?dates=${key}`)
      .then(setData)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [key, group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(d) {
    setAbsent((s) => {
      const n = new Set(s);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  }

  async function markCaughtUp() {
    try {
      await put('/me/missed-days', {
        days: [...absent].map((date) => ({ date, status: 'present' })),
      });
      toast('Ton groupe est prévenu que tu es à jour 👍', 'success');
      setAbsent(new Set());
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Accueil" to="/" right={<span className="text-caption font-semibold text-primary bg-primary-fixed px-2 py-1 rounded-full">Espace bienveillant</span>} />

      <header>
        <span className="text-caption uppercase tracking-wider text-primary font-bold flex items-center gap-1">
          <Icon name="spa" size={14} fill /> Respire un grand coup
        </span>
        <h1 className="text-headline-lg-mobile font-bold text-primary mt-1">Qu'est-ce que j'ai raté ?</h1>
        <p className="text-body-sm text-on-surface-variant">
          Pas de panique, le groupe a tout noté pour toi. Sélectionne tes jours d'absence :
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const on = absent.has(d);
          const dt = new Date(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              className={`flex-shrink-0 w-20 rounded-xl p-2 text-center transition-all ${
                on ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              <p className="text-caption capitalize">{DAY_NAMES[dt.getDay()].slice(0, 3)}</p>
              <p className="text-label-md font-bold">{dt.getDate()}</p>
              <p className="text-caption">{on ? 'Absent' : 'Présent'}</p>
            </button>
          );
        })}
      </div>

      {loading && <Spinner className="mx-auto my-8 block" />}

      {data && (
        <>
          <Card className="p-space-md">
            <p className="text-label-md font-bold flex items-center gap-1.5 mb-2">
              <Icon name="inventory_2" size={16} className="text-secondary" /> Synthèse de rattrapage
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={data.courses.length} label="cours manqués" />
              <Stat n={data.flashcards} label="fiches prêtes" tone="secondary" />
              <Stat n={data.keyNotions} label="notions clés" />
            </div>
          </Card>

          {data.courses.map((c) => (
            <Card key={c.id} className="p-space-md flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <SubjectChip colorKey={c.subject?.colorKey} label={c.subject?.name} />
                <span className="text-caption text-on-surface-variant">{formatDate(c.date)}</span>
              </div>
              <h3 className="text-headline-sm font-semibold text-primary">{c.title}</h3>
              <p className="text-body-sm text-on-surface-variant line-clamp-2">{c.summary}</p>
              <div className="flex gap-2 text-caption">
                <span className="flex items-center gap-1 bg-surface-container-low rounded-lg px-2 py-1">
                  <Icon name="headphones" size={13} /> Résumé audio {c.audioMinutes} min
                </span>
                <span className="flex items-center gap-1 bg-surface-container-low rounded-lg px-2 py-1">
                  <Icon name="style" size={13} /> {c.flashcardCount} flashcards
                </span>
              </div>
              <Btn onClick={() => navigate(`/courses/${c.id}`)} iconRight="arrow_forward" className="w-full mt-1">
                Rattraper ce cours
              </Btn>
            </Card>
          ))}

          {data.courses.length === 0 && (
            <Card className="p-space-md text-body-sm text-on-surface-variant text-center">
              Aucun cours publié sur ces dates — tu n'as rien manqué d'important !
            </Card>
          )}

          <Btn onClick={markCaughtUp} icon="task_alt" className="w-full">
            Tout marquer comme rattrapé
          </Btn>
        </>
      )}
    </div>
  );
}

function Stat({ n, label, tone }) {
  return (
    <div className="bg-surface-container-low rounded-xl py-2">
      <p className={`text-headline-md font-bold ${tone === 'secondary' ? 'text-secondary' : 'text-primary'}`}>{n}</p>
      <p className="text-caption text-on-surface-variant">{label}</p>
    </div>
  );
}
