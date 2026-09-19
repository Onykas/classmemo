import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip, subjectStyle } from '../components/ui.jsx';
import { relativeTime } from '../lib/format.js';

const STATUS = {
  draft: { label: 'Brouillon', tone: 'bg-surface-container text-on-surface-variant', dot: 'bg-outline' },
  analyzing: { label: 'Analyse en cours…', tone: 'bg-secondary-fixed text-on-secondary-fixed-variant', dot: 'bg-secondary animate-pulse' },
  ready: { label: 'À valider', tone: 'bg-secondary-fixed text-on-secondary-fixed-variant', dot: 'bg-secondary' },
  published: { label: 'Publié', tone: 'bg-primary-fixed/70 text-on-primary-fixed-variant', dot: 'bg-primary' },
};

function openCourse(navigate, c) {
  if (c.status === 'analyzing') navigate(`/courses/${c.id}/analyzing`);
  else if (c.status === 'ready') navigate(`/courses/${c.id}/validate`);
  else navigate(`/courses/${c.id}`);
}

export default function SubjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: subject, loading } = useApi(`/subjects/${id}`, [id]);

  if (loading || !subject) return <ScreenLoader />;
  const style = subjectStyle(subject.colorKey);

  return (
    <div className="flex flex-col gap-space-lg py-space-sm">
      <BackBar label="Mes matières" to="/subjects" />

      <Card className="relative overflow-hidden p-space-md flex flex-col gap-space-sm">
        <span className={`absolute inset-x-0 top-0 h-1.5 ${style.dot}`} />
        <div className="pt-1">
          <SubjectChip colorKey={subject.colorKey} label={subject.name} />
          <h1 className="text-headline-lg-mobile font-bold text-primary leading-tight mt-2">{subject.name}</h1>
          {subject.description && <p className="text-body-sm text-on-surface-variant mt-1">{subject.description}</p>}
        </div>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="flex items-center gap-1.5 bg-surface-container-low rounded-xl px-2.5 py-1.5">
            <Icon name="auto_stories" size={15} className="text-primary" />
            <span className="text-label-md font-bold text-on-surface leading-none">{subject.courseCount}</span>
            <span className="text-caption text-on-surface-variant leading-none">cours</span>
          </span>
          <span className="flex items-center gap-1.5 bg-surface-container-low rounded-xl px-2.5 py-1.5">
            <Icon name="style" size={15} className="text-primary" />
            <span className="text-label-md font-bold text-on-surface leading-none">{subject.flashcardCount}</span>
            <span className="text-caption text-on-surface-variant leading-none">fiches</span>
          </span>
        </div>
      </Card>

      <Btn onClick={() => navigate(`/add-notes?subjectId=${id}`)} icon="add" className="w-full">
        Ajouter un cours à « {subject.name} »
      </Btn>

      {subject.courses?.length > 0 ? (
        <div className="flex flex-col gap-space-sm">
          {subject.courses.map((c) => {
            const st = STATUS[c.status] || STATUS.draft;
            return (
              <Card
                key={c.id}
                as="button"
                onClick={() => openCourse(navigate, c)}
                className="p-space-md flex flex-col gap-1.5 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-headline-sm font-semibold text-on-surface truncate">{c.title}</p>
                  <span className={`flex-shrink-0 flex items-center gap-1 text-caption font-semibold px-2 py-0.5 rounded-full ${st.tone}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>
                {c.teacher && (
                  <p className="text-caption text-on-surface-variant flex items-center gap-1">
                    <Icon name="person" size={13} /> {c.teacher}
                  </p>
                )}
                <div className="flex items-center gap-3 text-caption text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Icon name="event_repeat" size={13} /> {c.sessionCount || 1} séance{(c.sessionCount || 1) > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="style" size={13} /> {c.flashcardCount} fiches
                  </span>
                  {(c.publishedAt || c.createdAt) && (
                    <span className="flex items-center gap-1">
                      <Icon name="update" size={13} /> {relativeTime(c.publishedAt || c.createdAt)}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-space-lg flex flex-col items-center text-center gap-2">
          <Icon name="auto_stories" size={32} className="text-outline" />
          <p className="text-label-md font-semibold text-on-surface">Aucun cours pour l'instant</p>
          <p className="text-caption text-on-surface-variant max-w-[16rem]">
            Ajoute le premier cours de cette matière avec le bouton ci-dessus.
          </p>
        </Card>
      )}
    </div>
  );
}
