import { NavLink } from 'react-router-dom';
import { Icon } from './ui.jsx';

const TABS = [
  { to: '/', icon: 'home', label: 'Accueil', end: true },
  { to: '/subjects', icon: 'menu_book', label: 'Cours' },
  { to: '/review', icon: 'psychology', label: 'Révision', key: 'review' },
  { to: '/notifications', icon: 'notifications', label: 'Notifs', key: 'notifs' },
  { to: '/profile', icon: 'person', label: 'Profil' },
];

export default function BottomNav({ dueCount = 0, unread = 0 }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-nav-top ring-1 ring-black/[0.05]">
      <div className="max-w-app mx-auto flex justify-around items-center h-[4.25rem] px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-xl transition-all active:scale-95 ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon name={t.icon} fill={isActive} size={22} />
                  {t.key === 'review' && dueCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-secondary-container" />
                  )}
                  {t.key === 'notifs' && unread > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-error text-on-error text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="text-label-sm leading-none">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
