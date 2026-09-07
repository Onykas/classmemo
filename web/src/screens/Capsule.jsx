import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader } from '../components/ui.jsx';

export default function Capsule() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: capsule, loading } = useApi(`/courses/${id}/capsule`, [id]);
  const [picked, setPicked] = useState(null);

  if (loading) return <ScreenLoader />;
  if (!capsule) {
    return (
      <div className="py-space-md">
        <BackBar label="Retour au cours" to={`/courses/${id}`} />
        <Card className="p-space-md mt-4 text-body-sm text-on-surface-variant">Pas de capsule pour ce cours.</Card>
      </div>
    );
  }

  const isCorrect = picked != null && picked === capsule.challenge.correctIndex;

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Retour au cours" to={`/courses/${id}`} right={<span className="text-caption font-semibold bg-secondary-fixed text-secondary px-2 py-1 rounded-full">Notion clé</span>} />

      <div className="bg-secondary-fixed/60 rounded-2xl p-space-md flex items-start gap-space-sm">
        <span className="w-10 h-10 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center flex-shrink-0">
          <Icon name="spa" size={20} />
        </span>
        <div>
          <p className="text-label-md font-bold text-on-secondary-fixed flex items-center gap-2">
            Capsule pédagogique <span className="text-caption font-semibold bg-surface-container-lowest text-secondary px-2 py-0.5 rounded-full">Sans stress</span>
          </p>
          <p className="text-body-sm text-on-secondary-fixed-variant mt-0.5">On pose les stylos, on respire et on décortique ça ensemble.</p>
        </div>
      </div>

      <Card className="p-space-md border-l-[4px] border-secondary">
        <p className="text-caption uppercase tracking-wider text-secondary font-bold flex items-center gap-1">
          <Icon name="lightbulb" size={14} fill /> Petite explication
        </p>
        <h1 className="text-headline-md font-bold text-primary mt-1">{capsule.title}</h1>
        {capsule.simpleTranslation && (
          <p className="inline-block text-caption text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full mt-1">
            Traduction simple : {capsule.simpleTranslation}
          </p>
        )}
        <p className="text-body-md text-on-surface-variant leading-relaxed mt-2">{capsule.body}</p>
      </Card>

      <section>
        <h2 className="text-headline-sm font-semibold flex items-center gap-1.5 mb-2">
          <Icon name="psychology" size={18} className="text-primary" /> Pas de panique, on reprend pas à pas
        </h2>
        <Card className="p-space-md">
          <p className="text-caption uppercase tracking-wider text-secondary font-bold flex items-center gap-1">
            <Icon name="push_pin" size={14} /> {capsule.analogyTitle}
          </p>
          <p className="text-body-md text-on-surface-variant leading-relaxed mt-1">{capsule.analogyBody}</p>
        </Card>
      </section>

      {capsule.keyPoints?.length > 0 && (
        <section>
          <h2 className="text-label-md font-bold flex items-center gap-1.5 mb-2">
            <Icon name="star" size={16} className="text-secondary" fill /> Ce qu'il faut retenir
          </h2>
          <div className="flex flex-col gap-2">
            {capsule.keyPoints.map((k, i) => (
              <div key={i} className="flex gap-2.5 bg-surface-container-low rounded-xl p-3">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-caption font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-body-sm text-on-surface-variant">{k}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Card className="p-space-md">
        <p className="text-caption uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-1 mb-1">
          <Icon name="check_circle" size={14} /> Vérifions ensemble <span className="text-secondary">· mini-défi</span>
        </p>
        <p className="text-body-md font-semibold text-on-surface mb-2">{capsule.challenge.question}</p>
        <div className="flex flex-col gap-2">
          {capsule.challenge.options.map((o, i) => {
            const chosen = picked === i;
            const showState = picked != null;
            return (
              <button
                key={i}
                onClick={() => setPicked(i)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left text-body-sm transition-all ${
                  showState && i === capsule.challenge.correctIndex
                    ? 'border-primary bg-primary-fixed/50 text-primary'
                    : chosen
                      ? 'border-error bg-error-container/40 text-on-error-container'
                      : 'border-outline-variant bg-surface-container-lowest'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${chosen ? 'border-current' : 'border-outline'}`} />
                {o}
              </button>
            );
          })}
        </div>
        {picked != null && (
          <p className={`text-body-sm font-semibold mt-2 ${isCorrect ? 'text-primary' : 'text-error'}`}>
            {isCorrect ? 'Exactement 🎉' : 'Pas tout à fait — relis la petite explication au-dessus.'}
          </p>
        )}
      </Card>

      <Btn onClick={() => navigate(`/courses/${id}`)} icon="menu_book" className="w-full">
        Revenir au cours
      </Btn>
    </div>
  );
}
