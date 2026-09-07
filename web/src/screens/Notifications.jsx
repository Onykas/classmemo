import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get, post } from '../api.js';
import { Card, Icon, ScreenLoader } from '../components/ui.jsx';
import { relativeTime } from '../lib/format.js';

const KIND = {
  capsule: { icon: 'lightbulb', tone: 'bg-secondary-fixed text-secondary', label: 'Éclairage express' },
  course: { icon: 'menu_book', tone: 'bg-primary-fixed text-primary', label: 'Nouveau cours' },
  question: { icon: 'forum', tone: 'bg-tertiary-fixed text-tertiary', label: 'Question' },
  reminder: { icon: 'psychology', tone: 'bg-surface-container-high text-primary', label: "Rythme d'ancrage" },
  group: { icon: 'diversity_3', tone: 'bg-surface-container-high text-primary', label: 'Groupe' },
};
const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'pedago', label: 'Pédagogiques', kinds: ['capsule', 'reminder', 'course'] },
  { key: 'group', label: 'Groupe', kinds: ['question', 'group'] },
];

export default function NotificationsScreen() {
  const { socket } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => get('/notifications').then(setData);
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const onN = () => load();
    socket.on('notification', onN);
    return () => socket.off('notification', onN);
  }, [socket]);

  if (!data) return <ScreenLoader />;

  const active = FILTERS.find((f) => f.key === filter);
  const items = data.items.filter((n) => !active.kinds || active.kinds.includes(n.kind));

  async function open(n) {
    if (!n.read) {
      await post(`/notifications/${n.id}/read`);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unread: Math.max(0, d.unread - 1) }));
    }
    if (n.meta?.courseId) navigate(`/courses/${n.meta.courseId}`);
    else if (n.meta?.threadId) navigate('/chat');
    else if (n.kind === 'reminder') navigate('/review');
  }

  async function readAll() {
    await post('/notifications/read-all');
    setData((d) => ({ ...d, items: d.items.map((x) => ({ ...x, read: true })), unread: 0 }));
  }

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-wider text-secondary font-bold">
          {data.unread} nouveauté·s d'équipe
        </span>
        <button onClick={readAll} className="text-label-md font-semibold text-primary flex items-center gap-1">
          <Icon name="done_all" size={15} /> Tout marquer comme lu
        </button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-9 px-3 rounded-full text-label-md font-semibold transition-colors ${
              filter === f.key ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-space-sm">
        {items.map((n) => {
          const k = KIND[n.kind] || KIND.group;
          return (
            <Card
              key={n.id}
              as="button"
              onClick={() => open(n)}
              className={`p-space-md flex gap-3 text-left ${n.read ? 'opacity-70' : ''}`}
            >
              <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${k.tone}`}>
                <Icon name={k.icon} size={20} fill />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold uppercase tracking-wider text-on-surface-variant">{k.label}</span>
                  <span className="text-caption text-on-surface-variant">{relativeTime(n.createdAt)}</span>
                </div>
                <p className="text-label-md text-on-surface mt-0.5">{n.title}</p>
                {n.body && <p className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-3">{n.body}</p>}
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-secondary-container flex-shrink-0 mt-1" />}
            </Card>
          );
        })}
        {items.length === 0 && (
          <p className="text-body-sm text-on-surface-variant text-center py-10">
            Ton espace reste calme et préserve ton attention.
          </p>
        )}
      </div>
    </div>
  );
}
