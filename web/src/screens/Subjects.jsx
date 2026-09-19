import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../lib/useApi.js';
import { Card, Icon, ScreenLoader, Section, SubjectChip, subjectStyle } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export default function Subjects() {
  const { group } = useAuth();
  const navigate = useNavigate();
  const gid = group?.id;
  const subjects = useApi(gid ? `/groups/${gid}/subjects` : null, [gid]);
  const courses = useApi(gid ? `/groups/${gid}/courses?limit=8` : null, [gid]);

  if (subjects.loading || !subjects.data) return <ScreenLoader />;

  return (
    <div className="flex flex-col gap-space-lg py-space-md">
      <header className="flex flex-col gap-1">
        <span className="text-caption uppercase tracking-wider text-primary font-bold">Espace partagé</span>
        <h1 className="text-headline-lg-mobile font-bold text-primary">Mes matières</h1>
        <p className="text-body-sm text-on-surface-variant">La tablée d'étude de {group.name}. Chaque note est relue ensemble.</p>
      </header>

      <Section title={`Matières suivies · ${subjects.data.length}`}>
        <div className="flex flex-col gap-space-sm">
          {subjects.data.map((s) => (
            <Card
              key={s.id}
              as="button"
              onClick={() => navigate(`/subjects/${s.id}`)}
              className="p-space-md flex flex-col gap-2 text-left"
            >
              <div className="flex items-center justify-between">
                <SubjectChip colorKey={s.colorKey} label={s.name} />
                <span className="text-caption text-on-surface-variant">{s.courseCount} cours</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">{s.description}</p>
              <div className="flex items-center justify-between text-caption text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="style" size={14} /> {s.flashcardCount} fiches partagées
                </span>
                {s.lastCourse && (
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    Consulter <Icon name="arrow_forward" size={14} />
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <button
        onClick={() => navigate('/review')}
        className="bg-secondary-fixed rounded-2xl p-space-md flex items-center gap-space-sm shadow-sm active:scale-[0.99] transition-transform text-left"
      >
        <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
          <Icon name="bolt" size={20} />
        </span>
        <div className="flex-1">
          <p className="text-label-md font-bold text-on-secondary-fixed">Session flash à {group.members?.length || 4}</p>
          <p className="text-caption text-on-secondary-fixed-variant">Quelques questions rapides avant le prochain cours</p>
        </div>
        <span className="h-9 px-3 rounded-xl bg-secondary text-on-secondary text-label-sm font-semibold flex items-center">Lancer</span>
      </button>

      <Section title="Timeline des cours récents" icon="history">
        <div className="flex flex-col">
          {(courses.data || []).map((c, i, arr) => {
            const st = subjectStyle(c.subject?.colorKey);
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold text-white ${st.dot}`}>
                    {new Date(c.date).getDate() || '•'}
                  </span>
                  {i < arr.length - 1 && <span className="w-px flex-1 bg-outline-variant my-1" />}
                </div>
                <div className="flex-1 pb-space-md">
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-on-surface-variant">{formatDate(c.date)}</span>
                    <span className={`text-caption font-semibold px-2 py-0.5 rounded-full ${st.soft}`}>{c.subject?.name || '—'}</span>
                  </div>
                  <p className="text-label-md text-on-surface group-hover:text-primary transition-colors">{c.title}</p>
                  <p className="text-caption text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <Icon name="person" size={13} /> Déposé par {c.author?.name?.split(' ')[0] || '—'} · {c.flashcardCount} fiches
                  </p>
                </div>
              </Link>
            );
          })}
          {courses.data && courses.data.length === 0 && (
            <p className="text-body-sm text-on-surface-variant">Aucun cours publié pour l'instant.</p>
          )}
        </div>
      </Section>
    </div>
  );
}
