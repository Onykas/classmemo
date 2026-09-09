import { useEffect, useState, useCallback } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get } from '../api.js';
import { Avatar, AvatarStack, Icon } from './ui.jsx';
import BottomNav from './BottomNav.jsx';
import InstallPrompt from './InstallPrompt.jsx';

export default function AppShell() {
  const { user, group, members, socket } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [dueCount, setDueCount] = useState(0);

  const loadBadges = useCallback(async () => {
    try {
      const n = await get('/notifications');
      setUnread(n.unread || 0);
    } catch { /* ignore */ }
    if (group) {
      try {
        const s = await get(`/review/summary?groupId=${group.id}`);
        setDueCount(s.dueCards || 0);
      } catch { /* ignore */ }
    }
  }, [group]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  useEffect(() => {
    if (!socket) return;
    const bump = () => setUnread((u) => u + 1);
    socket.on('notification', bump);
    return () => socket.off('notification', bump);
  }, [socket]);

  return (
    <div className="min-h-full bg-surface">
      <header className="fixed top-0 inset-x-0 z-40 bg-surface/85 backdrop-blur-xl shadow-[0_1px_12px_rgba(28,38,33,0.04)]">
        <div className="max-w-app mx-auto h-16 px-space-md flex items-center justify-between pt-[env(safe-area-inset-top)]">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="flex items-center gap-1.5">
                <span className="text-label-md font-bold text-primary">ClassMemo</span>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
              </span>
              <span className="text-caption text-on-surface-variant truncate">
                {group ? `${group.name} • ${members.length} membre${members.length > 1 ? 's' : ''}` : 'Aucune tablée'}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="hidden sm:block">
              <AvatarStack users={members.filter((m) => m.id !== user?.id)} size={20} max={3} />
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="relative p-0.5 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
              aria-label="Profil"
            >
              <Avatar user={user} size={32} />
              <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-surface" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-app mx-auto px-space-md pt-[4.5rem] pb-safe-bottom-nav min-h-full">
        <InstallPrompt />
        <Outlet context={{ reloadBadges: loadBadges }} />
      </main>

      <BottomNav dueCount={dueCount} unread={unread} />
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-16 text-on-surface-variant">
      <Icon name={icon} size={40} className="text-outline" />
      <p className="text-headline-sm font-semibold text-on-surface">{title}</p>
      {children && <p className="text-body-sm max-w-[15rem]">{children}</p>}
    </div>
  );
}
