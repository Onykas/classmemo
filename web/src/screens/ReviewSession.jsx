import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get, post } from '../api.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, Spinner, useToast } from '../components/ui.jsx';

export default function ReviewSession() {
  const { group } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(params.get('tab') === 'quiz' ? 'quiz' : 'cards');

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Session de révision" to="/" />
      <div className="flex bg-surface-container rounded-xl p-1 text-label-md font-semibold">
        {[
          ['cards', 'Flashcards', 'style'],
          ['quiz', 'Quiz QCM', 'quiz'],
        ].map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={icon} size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'cards' ? (
        <Flashcards groupId={group.id} />
      ) : (
        <Quiz groupId={group.id} courseParam={params.get('course')} onDone={() => navigate('/')} />
      )}
    </div>
  );
}

/* ---------------- Flashcards ---------------- */
function Flashcards({ groupId }) {
  const toast = useToast();
  const [queue, setQueue] = useState(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    get(`/review/queue?groupId=${groupId}`).then(setQueue).catch(() => setQueue({ cards: [], due: 0 }));
  }, [groupId]);

  if (!queue) return <ScreenLoader label="Préparation de la file…" />;
  const cards = queue.cards;

  if (!cards.length || idx >= cards.length) {
    return (
      <Card className="p-space-lg flex flex-col items-center text-center gap-2">
        <span className="w-14 h-14 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
          <Icon name="check_circle" size={28} fill />
        </span>
        <p className="text-headline-sm font-semibold">Tout est à jour !</p>
        <p className="text-body-sm text-on-surface-variant">
          {done > 0 ? `${done} carte·s revue·s. ` : ''}Reviens plus tard pour la prochaine série d'ancrage.
        </p>
      </Card>
    );
  }

  const card = cards[idx];

  async function grade(g) {
    try {
      await post('/review/grade', { flashcardId: card.id, grade: g });
    } catch (err) {
      toast(err.message, 'error');
    }
    setDone((d) => d + 1);
    setRevealed(false);
    setIdx((i) => i + 1);
  }

  return (
    <div className="flex flex-col gap-space-md">
      <Card className="p-space-md">
        <div className="flex items-center justify-between text-caption text-on-surface-variant">
          <span className="flex items-center gap-1"><Icon name="style" size={14} /> Carte {idx + 1} sur {cards.length}</span>
          <div className="flex gap-1">
            {cards.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i <= idx ? 'bg-primary' : 'bg-outline-variant'}`} />
            ))}
          </div>
        </div>
        <div className="h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
        </div>
      </Card>

      <button
        onClick={() => setRevealed((r) => !r)}
        className="min-h-[18rem] w-full bg-surface-container-lowest ring-1 ring-black/[0.04] rounded-2xl shadow-card p-space-lg flex flex-col items-center justify-center text-center gap-3 active:scale-[0.99] transition-transform"
      >
        <span className="text-caption font-semibold bg-secondary-fixed text-secondary px-2.5 py-0.5 rounded-full self-start">
          {card.tag}
        </span>
        {!revealed ? (
          <>
            <p className="text-headline-md font-bold text-primary">{card.front}</p>
            <p className="text-caption text-on-surface-variant flex items-center gap-1 mt-2">
              <Icon name="touch_app" size={15} /> Appuie pour révéler la réponse
            </p>
          </>
        ) : (
          <p className="cm-flip text-body-lg text-on-surface leading-relaxed">{card.back}</p>
        )}
        <span className="text-caption text-on-surface-variant/70">{card.courseTitle}</span>
      </button>

      {revealed && (
        <div className="cm-pop">
          <p className="text-caption uppercase tracking-wider text-on-surface-variant font-bold mb-2">
            Comment as-tu trouvé cette carte ?
          </p>
          <div className="grid grid-cols-3 gap-2">
            <GradeBtn onClick={() => grade('again')} tone="error" icon="history" label="À revoir" sub="< 10 min" />
            <GradeBtn onClick={() => grade('hard')} tone="amber" icon="sentiment_neutral" label="Moyen" sub="1 jour" />
            <GradeBtn onClick={() => grade('good')} tone="primary" icon="check_circle" label="Je savais" sub="3 jours +" />
          </div>
        </div>
      )}
    </div>
  );
}

function GradeBtn({ onClick, tone, icon, label, sub }) {
  const tones = {
    error: 'bg-error-container/50 text-on-error-container',
    amber: 'bg-secondary-fixed text-on-secondary-fixed',
    primary: 'bg-primary text-on-primary',
  };
  return (
    <button onClick={onClick} className={`rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform ${tones[tone]}`}>
      <Icon name={icon} size={20} />
      <span className="text-label-md font-bold">{label}</span>
      <span className="text-caption opacity-80">{sub}</span>
    </button>
  );
}

/* ---------------- Quiz ---------------- */
function Quiz({ groupId, courseParam, onDone }) {
  const toast = useToast();
  const [quiz, setQuiz] = useState(undefined); // undefined = loading, null = none
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let courseId = courseParam;
        if (!courseId) {
          const courses = await get(`/groups/${groupId}/courses?limit=10`);
          courseId = (courses.find((c) => c.quiz?.questionCount > 0) || courses[0])?.id;
        }
        if (!courseId) return !cancelled && setQuiz(null);
        const q = await get(`/courses/${courseId}/quiz`);
        if (!cancelled) setQuiz(q);
      } catch {
        if (!cancelled) setQuiz(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, courseParam]);

  const allAnswered = useMemo(
    () => quiz && quiz.questions.every((_, i) => answers[i] != null),
    [quiz, answers],
  );

  if (quiz === undefined) return <Spinner className="mx-auto my-16 block" />;
  if (!quiz) return <Card className="p-space-md text-body-sm text-on-surface-variant">Aucun quiz disponible pour l'instant.</Card>;

  async function submit() {
    setSubmitting(true);
    try {
      const r = await post(`/quiz/${quiz.id}/attempt`, {
        answers: quiz.questions.map((_, i) => answers[i] ?? -1),
      });
      setResult(r);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-space-md">
        <Card className="p-space-lg flex flex-col items-center text-center gap-1">
          <span className="text-display font-bold text-primary">{result.score}/{result.total}</span>
          <p className="text-body-sm text-on-surface-variant">
            {result.score === result.total ? 'Sans faute, bravo à la tablée !' : 'Regarde les explications ci-dessous.'}
          </p>
        </Card>
        {result.results.map((r, i) => (
          <Card key={i} className={`p-space-md border-l-4 ${r.correct ? 'border-primary' : 'border-error'}`}>
            <p className="text-body-sm font-semibold text-on-surface">{i + 1}. {r.question}</p>
            <p className={`text-body-sm mt-1 ${r.correct ? 'text-primary' : 'text-error'}`}>
              {r.correct ? '✓ Bonne réponse' : `✗ Réponse attendue : ${r.options[r.correctIndex]}`}
            </p>
            {r.explanation && <p className="text-caption text-on-surface-variant mt-1">{r.explanation}</p>}
          </Card>
        ))}
        <Btn onClick={onDone} className="w-full">Terminer</Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-md">
      {quiz.questions.map((q, qi) => (
        <Card key={q.id} className="p-space-md">
          <p className="text-body-md font-semibold text-on-surface mb-2">{qi + 1}. {q.question}</p>
          <div className="flex flex-col gap-2">
            {q.options.map((o, oi) => (
              <button
                key={oi}
                onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left text-body-sm transition-all ${
                  answers[qi] === oi ? 'border-primary bg-primary-fixed/40 text-primary' : 'border-outline-variant'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${answers[qi] === oi ? 'border-primary bg-primary' : 'border-outline'}`} />
                {o}
              </button>
            ))}
          </div>
        </Card>
      ))}
      <Btn onClick={submit} disabled={!allAnswered || submitting} className="w-full">
        {submitting ? '…' : 'Valider mes réponses'}
      </Btn>
    </div>
  );
}
