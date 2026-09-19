import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip } from '../components/ui.jsx';
import { formatDayDate, relativeTime, MONTH_NAMES } from '../lib/format.js';

function dayBadge(v) {
  if (!v) return null;
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), mon: MONTH_NAMES[d.getMonth()].slice(0, 3) };
}

// Titre de section « document » : grand, gras, souligné d'un trait de couleur.
function Heading({ children }) {
  return (
    <h2 className="text-headline-md font-extrabold text-primary tracking-tight pb-2 mb-3 border-b-[3px] border-primary/70">
      {children}
    </h2>
  );
}

// Encart couleur pour le contenu à retenir (une couleur par type de section).
function Callout({ tone, title, children }) {
  const tones = {
    amber: { bg: 'bg-secondary-fixed/60', border: 'border-secondary', head: 'text-on-secondary-fixed-variant' },
    blue: { bg: 'bg-tertiary-fixed/50', border: 'border-tertiary', head: 'text-on-tertiary-fixed-variant' },
  };
  const t = tones[tone];
  return (
    <div className={`${t.bg} rounded-xl p-space-md border-l-4 ${t.border}`}>
      <p className={`text-label-md font-extrabold uppercase tracking-wide mb-2.5 ${t.head}`}>{title}</p>
      {children}
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, loading } = useApi(`/courses/${id}`, [id]);

  if (loading || !course) return <ScreenLoader />;

  const meta = [
    course.teacher,
    `${course.sessionCount || 1} séance${(course.sessionCount || 1) > 1 ? 's' : ''}`,
    `${course.readingTime || 5} min de lecture`,
    course.flashcardCount ? `${course.flashcardCount} fiches` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-space-lg py-space-sm">
      <BackBar label="Tous les cours" to="/subjects" />

      {/* --- En-tête façon page de garde --- */}
      <header className="flex flex-col gap-2 px-1">
        <SubjectChip colorKey={course.subject?.colorKey} label={course.subject?.name} className="self-start" />
        <h1 className="text-headline-lg font-extrabold text-primary leading-tight pb-2 border-b-4 border-primary inline-block self-start">
          {course.title}
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          {meta.join(' · ')}
          {(course.publishedAt || course.createdAt) && (
            <span> · mis à jour {relativeTime(course.publishedAt || course.createdAt)}</span>
          )}
        </p>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1">
          <button
            onClick={() => navigate(`/add-notes?courseId=${id}`)}
            className="text-label-md font-bold text-primary underline decoration-2 underline-offset-4 decoration-primary/40 hover:decoration-primary"
          >
            Ajouter une séance
          </button>
          <button
            onClick={() => navigate(`/courses/${id}/print`)}
            className="text-label-md font-bold text-primary underline decoration-2 underline-offset-4 decoration-primary/40 hover:decoration-primary"
          >
            Exporter en PDF
          </button>
          {course.pages?.length > 0 && (
            <button
              onClick={() => navigate(`/courses/${id}/original`)}
              className="text-label-md font-bold text-primary underline decoration-2 underline-offset-4 decoration-primary/40 hover:decoration-primary"
            >
              Notes originales
            </button>
          )}
        </div>
      </header>

      {/* --- Séances du cours --- */}
      {course.sessions?.length > 0 && (
        <section>
          <Heading>Séances du cours</Heading>
          <div className="flex flex-col gap-space-md border-l-2 border-primary/25 pl-space-md ml-1">
            {course.sessions.map((s) => {
              const badge = dayBadge(s.date);
              return (
                <div key={s.id} className="relative">
                  <span className="absolute -left-[calc(1rem+5px)] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                  <p className="text-label-md font-extrabold text-on-surface underline decoration-primary/30 underline-offset-4">
                    {badge ? `${badge.day} ${badge.mon}` : ''} {s.label || (s.date ? formatDayDate(s.date) : 'Séance')}
                  </p>
                  {s.note && <p className="text-body-sm text-on-surface-variant italic mt-1">« {s.note} »</p>}
                  <p className="text-caption text-on-surface-variant mt-0.5">
                    {s.pageCount} bloc{s.pageCount > 1 ? 's' : ''} de notes
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Résumé --- */}
      <section>
        <Heading>Résumé</Heading>
        {course.summary ? (
          course.summary.split('\n\n').map((p, i) => (
            <p key={i} className="text-body-lg text-on-surface leading-relaxed mb-3 last:mb-0">
              {p}
            </p>
          ))
        ) : (
          <p className="text-body-md text-on-surface-variant italic">
            La synthèse sera disponible dès que l'analyse est terminée.
          </p>
        )}
      </section>

      {/* --- À retenir --- */}
      {course.keyPoints?.length > 0 && (
        <Callout tone="amber" title="Points essentiels à retenir">
          <ol className="flex flex-col gap-space-sm">
            {course.keyPoints.map((k, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="font-extrabold text-secondary flex-shrink-0">{i + 1}.</span>
                <span className="text-body-md text-on-secondary-fixed-variant leading-relaxed">{k}</span>
              </li>
            ))}
          </ol>
        </Callout>
      )}

      {/* --- Comprendre simplement --- */}
      {course.analogy?.body && (
        <Callout tone="blue" title={`Comprendre simplement — ${course.analogy.title}`}>
          <p className="text-body-md text-on-tertiary-fixed-variant italic leading-relaxed">{course.analogy.body}</p>
        </Callout>
      )}

      {/* --- Notions clés --- */}
      {course.notions?.length > 0 && (
        <section>
          <Heading>Notions clés</Heading>
          <Card className="p-space-md flex flex-col divide-y divide-outline-variant/50">
            {course.notions.map((n, i) => (
              <div key={i} className={`py-space-sm ${i === 0 ? 'pt-0' : ''} last:pb-0`}>
                <p className="text-body-md font-extrabold text-primary">{n.term}</p>
                <p className="text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">{n.short}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* --- Réviser --- */}
      <section>
        <Heading>Réviser ce cours</Heading>
        <div className="flex flex-col gap-space-sm">
          {course.quiz?.questionCount > 0 && (
            <Btn onClick={() => navigate(`/review?course=${id}&tab=quiz`)} className="w-full justify-between" iconRight="arrow_forward">
              <span className="flex flex-col items-start">
                <span>Faire le quiz</span>
                <span className="text-caption font-normal opacity-80">{course.quiz.questionCount} questions rapides</span>
              </span>
            </Btn>
          )}
          <button
            onClick={() => navigate(`/review?course=${id}`)}
            className="w-full bg-surface-container-lowest ring-1 ring-black/[0.04] rounded-xl p-space-sm flex items-center justify-between shadow-card active:scale-[0.99] transition-transform"
          >
            <span className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
                <Icon name="style" size={18} />
              </span>
              <span className="flex flex-col items-start">
                <span className="text-label-md text-on-surface">Voir les flashcards</span>
                <span className="text-caption text-on-surface-variant">{course.flashcardCount} cartes · répétition espacée</span>
              </span>
            </span>
            <Icon name="chevron_right" size={18} className="text-on-surface-variant" />
          </button>
          {course.hasCapsule && (
            <button
              onClick={() => navigate(`/courses/${id}/capsule`)}
              className="w-full bg-surface-container-lowest ring-1 ring-black/[0.04] rounded-xl p-space-sm flex items-center justify-between shadow-card active:scale-[0.99] transition-transform"
            >
              <span className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <Icon name="spa" size={18} />
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-label-md text-on-surface">Capsule pédagogique</span>
                  <span className="text-caption text-on-surface-variant">Sans stress, on décortique ensemble</span>
                </span>
              </span>
              <Icon name="chevron_right" size={18} className="text-on-surface-variant" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
