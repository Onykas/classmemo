import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, Section, SubjectChip, subjectStyle } from '../components/ui.jsx';
import { formatDayDate, relativeTime, MONTH_NAMES } from '../lib/format.js';

function dayBadge(v) {
  if (!v) return null;
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), mon: MONTH_NAMES[d.getMonth()].slice(0, 3) };
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, loading } = useApi(`/courses/${id}`, [id]);

  if (loading || !course) return <ScreenLoader />;
  const style = subjectStyle(course.subject?.colorKey);
  const isFresh = course.status === 'published';

  return (
    <div className="flex flex-col gap-space-lg py-space-sm">
      <BackBar label="Tous les cours" to="/subjects" />

      {/* --- En-tête du cours --- */}
      <Card className="relative overflow-hidden p-space-md flex flex-col gap-space-sm">
        <span className={`absolute inset-x-0 top-0 h-1.5 ${style.dot}`} />
        <div className="flex items-center justify-between pt-1">
          <SubjectChip colorKey={course.subject?.colorKey} label={course.subject?.name} />
          <span
            className={`flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full ${
              isFresh ? 'bg-primary-fixed/70 text-on-primary-fixed-variant' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isFresh ? 'bg-primary' : 'bg-outline'}`} />
            {isFresh ? 'Fiche à jour' : 'En préparation'}
          </span>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile font-bold text-primary leading-tight">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {course.teacher && (
              <p className="text-body-sm text-on-surface-variant flex items-center gap-1">
                <Icon name="person" size={14} /> {course.teacher}
              </p>
            )}
            {(course.publishedAt || course.createdAt) && (
              <p className="text-caption text-on-surface-variant flex items-center gap-1">
                <Icon name="update" size={13} /> Mis à jour {relativeTime(course.publishedAt || course.createdAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Stat icon="event_repeat" value={course.sessionCount || 1} label={course.sessionCount > 1 ? 'séances' : 'séance'} />
          <Stat icon="schedule" value={`${course.readingTime || 5} min`} label="lecture" />
          <Stat icon="style" value={course.flashcardCount} label="fiches" />
          {course.quiz?.questionCount > 0 && <Stat icon="quiz" value={course.quiz.questionCount} label="quiz" />}
        </div>
      </Card>

      {/* --- Barre d'actions --- */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <ToolChip icon="note_add" label="Ajouter une séance" primary onClick={() => navigate(`/add-notes?courseId=${id}`)} />
        <ToolChip icon="picture_as_pdf" label="Export PDF" onClick={() => navigate(`/courses/${id}/print`)} />
        {course.pages?.length > 0 && (
          <ToolChip icon="photo_library" label={`${course.pages.length} page·s`} onClick={() => navigate(`/courses/${id}/original`)} />
        )}
      </div>

      {/* --- Frise des séances --- */}
      {course.sessions?.length > 0 && (
        <Section icon="event_note" title="Séances du cours">
          <Card className="p-space-md">
            <div className="relative flex flex-col gap-space-md">
              {course.sessions.length > 1 && (
                <span className="absolute left-[19px] top-3 bottom-3 w-px bg-outline-variant" aria-hidden="true" />
              )}
              {course.sessions.map((s) => {
                const badge = dayBadge(s.date);
                return (
                  <div key={s.id} className="relative flex gap-3">
                    <div className="relative z-10 w-10 h-10 rounded-xl bg-primary text-on-primary flex flex-col items-center justify-center flex-shrink-0 shadow-card leading-none">
                      {badge ? (
                        <>
                          <span className="text-label-md font-bold">{badge.day}</span>
                          <span className="text-[9px] uppercase opacity-80 tracking-wide">{badge.mon}</span>
                        </>
                      ) : (
                        <Icon name="event" size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-label-md font-semibold text-on-surface">{s.label || (s.date ? formatDayDate(s.date) : 'Séance')}</p>
                      {s.note && <p className="text-caption text-on-surface-variant mt-0.5 italic">« {s.note} »</p>}
                      <p className="text-caption text-on-surface-variant mt-0.5 flex items-center gap-1">
                        <Icon name="description" size={12} /> {s.pageCount} bloc{s.pageCount > 1 ? 's' : ''} de notes
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Section>
      )}

      {/* --- Résumé --- */}
      <Section
        icon="menu_book"
        title="Résumé"
        action={
          <span className="text-caption text-on-surface-variant flex items-center gap-1">
            <Icon name="schedule" size={13} /> {course.readingTime || 5} min
          </span>
        }
      >
        {course.summary ? (
          <Card className="p-space-md">
            {course.summary.split('\n\n').map((p, i) => (
              <p key={i} className="text-body-md text-on-surface-variant leading-relaxed mb-2 last:mb-0">
                {p}
              </p>
            ))}
          </Card>
        ) : (
          <Card className="p-space-md flex items-center gap-space-sm text-on-surface-variant">
            <Icon name="hourglass_top" size={20} className="flex-shrink-0" />
            <p className="text-body-sm">La synthèse sera disponible dès que l'analyse est terminée.</p>
          </Card>
        )}
      </Section>

      {/* --- À retenir --- */}
      {course.keyPoints?.length > 0 && (
        <Section
          icon="star"
          title="À retenir"
          action={<span className="text-caption font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">Essentiel exam</span>}
        >
          <Card className="p-space-md flex flex-col gap-space-sm">
            {course.keyPoints.map((k, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-label-sm font-bold">
                  {i + 1}
                </span>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{k}</p>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* --- Comprendre simplement --- */}
      {course.analogy?.body && (
        <Section icon="lightbulb" title="Comprendre simplement">
          <div className="bg-secondary-fixed/60 rounded-2xl p-space-md border-l-[3px] border-secondary flex gap-space-sm">
            <Icon name="format_quote" size={22} className="text-secondary flex-shrink-0 -scale-x-100" />
            <div>
              <p className="text-caption uppercase tracking-wider text-secondary font-bold mb-1">{course.analogy.title}</p>
              <p className="text-body-md text-on-secondary-fixed-variant italic leading-relaxed">{course.analogy.body}</p>
            </div>
          </div>
        </Section>
      )}

      {/* --- Notions clés --- */}
      {course.notions?.length > 0 && (
        <Section icon="key" title="Notions clés">
          <div className="grid grid-cols-2 gap-space-sm">
            {course.notions.map((n, i) => (
              <Card key={i} className="p-space-sm flex flex-col gap-1">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-label-sm font-bold flex-shrink-0 ${style.soft}`}>
                  {(n.term || '?')[0]?.toUpperCase()}
                </span>
                <p className="text-label-md text-on-surface leading-snug">{n.term}</p>
                <p className="text-caption text-on-surface-variant leading-snug">{n.short}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* --- Réviser --- */}
      <Section icon="school" title="Réviser ce cours">
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
      </Section>
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <span className="flex items-center gap-1.5 bg-surface-container-low rounded-xl px-2.5 py-1.5">
      <Icon name={icon} size={15} className="text-primary" />
      <span className="text-label-md font-bold text-on-surface leading-none">{value}</span>
      <span className="text-caption text-on-surface-variant leading-none">{label}</span>
    </span>
  );
}

function ToolChip({ icon, label, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full text-label-md font-semibold transition-colors active:scale-[0.97] ${
        primary ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
      }`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
