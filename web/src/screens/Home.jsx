import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../lib/useApi.js';
import { Btn, Card, Icon, ScreenLoader, Section, SubjectChip } from '../components/ui.jsx';

const ITEM_ICON = { event: 'calendar_today', course: 'auto_stories', notion: 'sync' };

export default function Home() {
  const { user, group, members } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useApi(group ? `/home?groupId=${group.id}` : null, [group?.id]);

  if (loading || !data) return <ScreenLoader />;
  const { activity, recentCourse, review, today } = data;

  return (
    <div className="flex flex-col gap-space-lg py-space-md">
      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-headline-lg-mobile font-bold text-primary">
            Bonjour {user?.name?.split(' ')[0]} <span className="inline-block">👋</span>
          </h1>
          <div className="flex items-center -space-x-2 bg-surface-container-high px-2 py-1 rounded-full shadow-sm">
            {members.slice(0, 4).map((m) => (
              <span
                key={m.id}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-surface ${
                  m.presence === 'active' ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant opacity-70'
                }`}
              >
                {m.name[0]}
              </span>
            ))}
          </div>
        </div>
        <p className="text-body-md text-on-surface-variant">Voici ce qui se passe dans tes cours aujourd'hui.</p>
      </section>

      <aside className="bg-surface-container-low rounded-2xl p-space-sm flex items-center gap-space-sm shadow-sm">
        <div className="relative w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
          <Icon name="group" size={18} className="text-primary" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-surface-container-low" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-md text-on-surface truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse flex-shrink-0" />
            {activity.text}
          </p>
          <p className="text-caption text-on-surface-variant mt-0.5">
            {group.name} • <span className="text-primary font-semibold">{activity.activeCount}/{activity.total} actifs</span>
          </p>
        </div>
      </aside>

      {recentCourse && (
        <Section title="Cours récent" action={<Link to="/subjects" className="text-label-sm text-primary flex items-center gap-0.5 hover:underline">Tout voir <Icon name="chevron_right" size={15} /></Link>}>
          <Card className="p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <SubjectChip colorKey={recentCourse.subject?.colorKey} label={recentCourse.subject?.name} />
              <span className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full text-caption text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-primary-container" /> Disponible
              </span>
            </div>
            <div>
              <h3 className="text-headline-md font-semibold text-primary">{recentCourse.title}</h3>
              <p className="text-caption text-on-surface-variant flex items-center gap-1 mt-0.5">
                <Icon name="calendar_today" size={14} /> {recentCourse.sessionLabel || 'Version partagée validée'}
              </p>
            </div>
            <p className="text-body-sm text-on-surface-variant line-clamp-2">{recentCourse.summary}</p>
            <div className="flex items-center gap-3 text-caption text-on-surface-variant">
              <span className="flex items-center gap-1"><Icon name="style" size={14} /> {recentCourse.flashcardCount} fiches</span>
              <span className="flex items-center gap-1"><Icon name="schedule" size={14} /> Lecture {recentCourse.readingTime} min</span>
            </div>
            <Btn onClick={() => navigate(`/courses/${recentCourse.id}`)} iconRight="arrow_forward" className="w-full mt-1">
              Ouvrir le cours
            </Btn>
          </Card>
        </Section>
      )}

      {review.spotlight && (
        <Section title="À réviser" icon="psychology" action={<span className="text-caption font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">{review.rhythm}</span>}>
          <div className="bg-secondary-fixed rounded-2xl p-space-md flex flex-col gap-space-sm relative overflow-hidden shadow-sm">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-secondary-container/20" />
            <div className="flex items-start justify-between z-10">
              <span className="px-2.5 py-0.5 rounded-full text-label-sm font-semibold bg-surface-container-lowest text-on-secondary-fixed">
                {review.spotlight.tag}
              </span>
              <span className="flex items-center gap-1 text-on-secondary-fixed-variant text-caption">
                <Icon name="schedule" size={15} />
                {review.spotlight.lastSeenDays != null ? `Vu il y a ${review.spotlight.lastSeenDays} j` : 'Jamais révisée'}
              </span>
            </div>
            <div className="z-10">
              <h3 className="text-headline-sm font-bold text-on-secondary-fixed">{review.spotlight.title}</h3>
              <p className="text-body-sm text-on-secondary-fixed-variant mt-0.5">
                {review.dueCards} carte{review.dueCards > 1 ? 's' : ''} recommandée{review.dueCards > 1 ? 's' : ''} pour ancrer la mémoire à long terme.
              </p>
            </div>
            <div className="z-10 flex items-center gap-space-sm pt-1">
              <Btn variant="amber" onClick={() => navigate('/review')} icon="play_circle" className="flex-1">
                Réviser ({Math.max(1, Math.round(review.dueCards / 2))} min)
              </Btn>
              <button className="h-12 w-12 bg-surface-container-lowest/80 text-on-secondary-fixed rounded-xl flex items-center justify-center active:scale-95">
                <Icon name="snooze" size={18} />
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Aujourd'hui" action={<span className="text-caption text-on-surface-variant">{today.length} petit·s pas</span>}>
        <Card className="p-space-sm flex flex-col divide-y divide-surface-container">
          {today.length === 0 && <p className="text-body-sm text-on-surface-variant p-3">Rien de prévu, souffle un grand coup.</p>}
          {today.map((it, i) => (
            <button
              key={i}
              onClick={() =>
                it.ref?.type === 'course'
                  ? navigate(`/courses/${it.ref.id}`)
                  : it.ref?.type === 'review'
                    ? navigate('/review')
                    : navigate('/calendar')
              }
              className="flex items-start gap-space-sm p-space-xs rounded-xl hover:bg-surface-container-low transition-colors text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center flex-shrink-0">
                <Icon name={ITEM_ICON[it.kind] || 'circle'} size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-caption font-bold uppercase tracking-wider text-tertiary">{it.kind === 'notion' ? 'Notion à revoir' : it.kind === 'course' ? 'Nouveau cours' : 'Séance'}</span>
                  <span className="text-caption text-on-surface-variant">{it.time}</span>
                </div>
                <h4 className="text-label-md text-on-surface truncate">{it.title}</h4>
                <p className="text-caption text-on-surface-variant truncate">{it.subtitle}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-variant self-center" />
            </button>
          ))}
        </Card>
      </Section>

      <button
        onClick={() => navigate('/add-notes')}
        className="w-full h-14 bg-surface-container-high text-primary rounded-2xl text-headline-sm font-semibold flex items-center justify-center gap-space-sm shadow-sm hover:bg-surface-container-highest transition-all active:scale-[0.99]"
      >
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-lg leading-none">＋</span>
        Ajouter des notes de cours
      </button>

      <div className="grid grid-cols-2 gap-space-sm">
        <QuickLink to="/missed" icon="undo" label="Qu'ai-je raté ?" />
        <QuickLink to="/calendar" icon="calendar_month" label="Calendrier" />
        <QuickLink to="/chat" icon="forum" label="Entraide groupe" />
        <QuickLink to="/summary" icon="timeline" label="Fil conducteur" />
      </div>
    </div>
  );
}

function QuickLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 h-14 px-3 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors"
    >
      <span className="w-9 h-9 rounded-xl bg-surface-container-lowest text-primary flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={18} />
      </span>
      <span className="text-label-md font-semibold text-on-surface leading-tight">{label}</span>
    </Link>
  );
}
