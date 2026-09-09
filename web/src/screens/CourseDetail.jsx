import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip } from '../components/ui.jsx';
import { formatDayDate } from '../lib/format.js';

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, loading } = useApi(`/courses/${id}`, [id]);

  if (loading || !course) return <ScreenLoader />;

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Tous les cours" to="/subjects" />

      <Card className="p-space-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SubjectChip colorKey={course.subject?.colorKey} label={course.subject?.name} />
          <span className="text-caption text-on-surface-variant flex items-center gap-1">
            <Icon name="calendar_today" size={13} /> {formatDayDate(course.date)}
          </span>
        </div>
        <h1 className="text-headline-lg-mobile font-bold text-primary">{course.title}</h1>
        {course.teacher && (
          <p className="text-body-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="person" size={14} /> {course.teacher}
          </p>
        )}
        <p className="text-caption text-on-surface-variant flex items-center gap-1">
          <Icon name="verified" size={14} className="text-primary" />
          {course.sessionCount || 1} séance·s • {course.generatedBy === 'claude' ? 'Synthèse par Claude' : 'Synthèse auto'}
        </p>
      </Card>

      {course.sessions?.length > 0 && (
        <Section icon="event_note" title="Séances du cours">
          <Card className="p-space-sm flex flex-col divide-y divide-surface-container">
            {course.sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 p-space-xs">
                <span className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
                  <Icon name="calendar_today" size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-label-md text-on-surface">{s.date ? formatDayDate(s.date) : s.label}</p>
                  {s.note && <p className="text-caption text-on-surface-variant truncate">{s.note}</p>}
                </div>
                <span className="text-caption text-on-surface-variant flex-shrink-0">{s.pageCount} bloc·s</span>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <button
        onClick={() => navigate(`/courses/${id}/print`)}
        className="bg-surface-container-low rounded-2xl p-space-sm flex items-center gap-space-sm text-left hover:bg-surface-container transition-colors"
      >
        <span className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-primary">
          <Icon name="picture_as_pdf" size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-label-md text-on-surface">Télécharger en PDF</p>
          <p className="text-caption text-on-surface-variant truncate">Séance, période ou cours complet · synthèse · flashcards</p>
        </div>
        <Icon name="arrow_forward" size={18} className="text-on-surface-variant" />
      </button>

      {course.pages?.length > 0 && (
        <button
          onClick={() => navigate(`/courses/${id}/original`)}
          className="bg-surface-container-low rounded-2xl p-space-sm flex items-center gap-space-sm text-left hover:bg-surface-container transition-colors"
        >
          <span className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-primary">
            <Icon name="photo_library" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-label-md text-on-surface">Notes manuscrites originales</p>
            <p className="text-caption text-on-surface-variant truncate">{course.pages.length} page·s scannée·s</p>
          </div>
          <Icon name="arrow_forward" size={18} className="text-on-surface-variant" />
        </button>
      )}

      <Section icon="menu_book" title="Résumé">
        <Card className="p-space-md">
          {(course.summary || '').split('\n\n').map((p, i) => (
            <p key={i} className="text-body-md text-on-surface-variant leading-relaxed mb-2 last:mb-0">{p}</p>
          ))}
        </Card>
      </Section>

      {course.keyPoints?.length > 0 && (
        <Section icon="star" title="À retenir" right={<span className="text-caption font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">Essentiel exam</span>}>
          <Card className="p-space-md flex flex-col gap-space-sm">
            {course.keyPoints.map((k, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="check" size={15} />
                </span>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{k}</p>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {course.analogy?.body && (
        <Section icon="lightbulb" title="Comprendre simplement">
          <div className="bg-secondary-fixed/60 rounded-2xl p-space-md border-l-[3px] border-secondary">
            <p className="text-caption uppercase tracking-wider text-secondary font-bold mb-1">{course.analogy.title}</p>
            <p className="text-body-md text-on-secondary-fixed-variant italic leading-relaxed">« {course.analogy.body} »</p>
          </div>
        </Section>
      )}

      {course.notions?.length > 0 && (
        <Section icon="key" title="Notions clés">
          <div className="grid grid-cols-2 gap-space-sm">
            {course.notions.map((n, i) => (
              <Card key={i} className="p-space-sm">
                <p className="text-label-md text-on-surface flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {n.term}
                </p>
                <p className="text-caption text-on-surface-variant mt-0.5">{n.short}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

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

function Section({ icon, title, right, children }) {
  return (
    <section className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-1.5">
          <Icon name={icon} size={18} className="text-secondary" fill /> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}
