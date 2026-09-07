import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../lib/useApi.js';
import { BackBar, Card, Icon, ScreenLoader, SubjectChip } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export default function CumulativeSummary() {
  const { group } = useAuth();
  const gid = group?.id;
  const subjects = useApi(gid ? `/groups/${gid}/subjects` : null, [gid]);
  const courses = useApi(gid ? `/groups/${gid}/courses?limit=40` : null, [gid]);
  const [subjectId, setSubjectId] = useState(null);

  const list = useMemo(() => {
    const all = (courses.data || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1));
    return subjectId ? all.filter((c) => c.subject?.id === subjectId) : all;
  }, [courses.data, subjectId]);

  if (subjects.loading || courses.loading) return <ScreenLoader />;

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Accueil" to="/" />
      <header>
        <span className="text-caption uppercase tracking-wider text-primary font-bold flex items-center gap-1">
          <Icon name="account_tree" size={14} /> Fil conducteur partagé
        </span>
        <h1 className="text-headline-lg-mobile font-bold text-primary mt-1">Vue globale du cours</h1>
        <p className="text-body-sm text-on-surface-variant">Les notions connectées pas à pas depuis le premier jour.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={subjectId == null} onClick={() => setSubjectId(null)} label="Tout" />
        {(subjects.data || []).map((s) => (
          <Chip key={s.id} active={subjectId === s.id} onClick={() => setSubjectId(s.id)} label={s.name} />
        ))}
      </div>

      <div className="flex flex-col">
        {list.map((c, i) => (
          <div key={c.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  i === list.length - 1 ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'
                }`}
              >
                <Icon name={i === list.length - 1 ? 'radio_button_checked' : 'check'} size={18} />
              </span>
              {i < list.length - 1 && <span className="w-px flex-1 bg-outline-variant my-1" />}
            </div>
            <Card className="flex-1 mb-space-md p-space-md">
              <div className="flex items-center justify-between">
                <span className="text-caption font-bold text-on-surface-variant">Module {String(i + 1).padStart(2, '0')}</span>
                <span className="text-caption text-on-surface-variant">{formatDate(c.date)}</span>
              </div>
              <Link to={`/courses/${c.id}`} className="text-headline-sm font-semibold text-primary hover:underline block mt-0.5">
                {c.title}
              </Link>
              <div className="mt-2 bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
                <Icon name="lightbulb" size={16} className="text-secondary flex-shrink-0" fill />
                <div className="flex-1 min-w-0">
                  <p className="text-caption text-on-surface-variant">Notion charnière</p>
                  <p className="text-label-md text-on-surface truncate">{c.subject?.name || '—'}</p>
                </div>
                <SubjectChip colorKey={c.subject?.colorKey} label={c.subject?.name} />
              </div>
            </Card>
          </div>
        ))}
        {list.length === 0 && <p className="text-body-sm text-on-surface-variant">Aucun cours pour cette matière.</p>}
      </div>

      <div className="bg-surface-container-low rounded-2xl p-space-md flex gap-3">
        <span className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
          <Icon name="lightbulb" size={18} fill />
        </span>
        <div>
          <p className="text-label-md font-semibold">Le saviez-vous ?</p>
          <p className="text-body-sm text-on-surface-variant">
            Relire une notion dans les 24 h après le cours multiplie par 3 sa rétention à long terme (courbe de l'oubli d'Ebbinghaus).
          </p>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 h-9 px-3 rounded-full text-label-md font-semibold transition-colors ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  );
}
