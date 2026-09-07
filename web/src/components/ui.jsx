import { createContext, useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initials } from '../lib/format.js';

/* ---------- Icônes ---------- */
export function Icon({ name, className = '', fill = false, size }) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? 'ms-fill ' : ''}${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  );
}

/* ---------- Matières ---------- */
export const SUBJECT = {
  psm: { label: 'PSM', chip: 'bg-subj-psm/10 text-subj-psm border border-subj-psm/30', dot: 'bg-subj-psm', soft: 'bg-subj-psm/10 text-subj-psm' },
  iot: { label: 'IoT', chip: 'bg-subj-iot/10 text-subj-iot border border-subj-iot/30', dot: 'bg-subj-iot', soft: 'bg-subj-iot/10 text-subj-iot' },
  gestion: { label: 'Gestion de projet', chip: 'bg-subj-gestion/10 text-subj-gestion border border-subj-gestion/30', dot: 'bg-subj-gestion', soft: 'bg-subj-gestion/10 text-subj-gestion' },
  ux: { label: "Design d'interaction", chip: 'bg-subj-ux/10 text-subj-ux border border-subj-ux/30', dot: 'bg-subj-ux', soft: 'bg-subj-ux/10 text-subj-ux' },
};
export const subjectStyle = (k) => SUBJECT[k] || SUBJECT.psm;

export function SubjectChip({ colorKey, label, className = '' }) {
  const s = subjectStyle(colorKey);
  return (
    <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-label-sm font-semibold ${s.chip} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label || s.label}
    </span>
  );
}

/* ---------- Avatars ---------- */
export function Avatar({ user, size = 32, ring = false, className = '' }) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  const [broken, setBroken] = useState(false);
  if (user?.avatarUrl && !broken) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        onError={() => setBroken(true)}
        className={`rounded-full object-cover flex-shrink-0 ${ring ? 'ring-2 ring-surface-container-lowest' : ''} ${className}`}
        style={dim}
      />
    );
  }
  return (
    <span
      className={`rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center flex-shrink-0 ${ring ? 'ring-2 ring-surface-container-lowest' : ''} ${className}`}
      style={dim}
    >
      {initials(user?.name || '?')}
    </span>
  );
}

export function AvatarStack({ users = [], size = 24, max = 4 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <div key={u.id} className="relative">
          <Avatar user={u} size={size} ring />
          {u.presence === 'active' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-surface-container-lowest" />
          )}
        </div>
      ))}
      {extra > 0 && (
        <span
          className="rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center ring-2 ring-surface-container-lowest"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/* ---------- Blocs ---------- */
export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`bg-surface-container-lowest rounded-2xl shadow-card ring-1 ring-black/[0.04] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Section({ title, action, children, icon }) {
  return (
    <section className="flex flex-col gap-space-xs">
      {(title || action) && (
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-1.5">
            {icon && <Icon name={icon} className="text-secondary" fill size={20} />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ variant = 'primary', className = '', icon, iconRight, children, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-label-md text-label-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100';
  const styles = {
    primary: 'h-12 px-4 bg-primary text-on-primary hover:bg-primary-container shadow-card',
    secondary: 'h-11 px-4 bg-primary/10 text-primary hover:bg-primary/15',
    amber: 'h-12 px-4 bg-secondary text-on-secondary hover:opacity-95 shadow-card',
    ghost: 'h-11 px-3 bg-surface-container-high text-primary hover:bg-surface-container-highest',
    subtle: 'h-10 px-3 text-primary hover:bg-primary/10',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={18} />}
    </button>
  );
}

export function BackBar({ label = 'Retour', to, right }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => (to ? navigate(to) : navigate(-1))}
        className="inline-flex items-center gap-1.5 h-9 pr-3 pl-1 rounded-full text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <Icon name="arrow_back" size={20} />
        {label}
      </button>
      {right}
    </div>
  );
}

export function Spinner({ className = '', size = 24 }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-primary/20 border-t-primary animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function ScreenLoader({ label = 'Chargement…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-on-surface-variant">
      <Spinner size={30} />
      <p className="text-body-sm">{label}</p>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-inverse-surface/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-app bg-surface-container-lowest rounded-t-3xl shadow-float p-space-lg pb-space-2xl cm-pop max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-4" />
        {title && <h3 className="text-headline-sm font-semibold mb-3">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'info') => {
    const tid = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { tid, message, type }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.tid !== tid)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed left-0 right-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.tid}
            className={`cm-pop pointer-events-auto max-w-app w-full rounded-xl px-4 py-3 text-body-sm font-medium shadow-float ${
              t.type === 'error'
                ? 'bg-error text-on-error'
                : t.type === 'success'
                  ? 'bg-primary text-on-primary'
                  : 'bg-inverse-surface text-inverse-on-surface'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
