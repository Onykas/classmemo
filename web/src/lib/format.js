const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function toDate(v) {
  if (!v) return null;
  const s = typeof v === 'string' && v.includes(' ') && !v.includes('T') ? v.replace(' ', 'T') + 'Z' : v;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(v, { withYear = false } = {}) {
  const d = toDate(v);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function formatDayDate(v) {
  const d = toDate(v);
  if (!d) return '';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relativeTime(v) {
  const d = toDate(v);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return formatDate(v);
}

export function timeOnly(v) {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export const MONTH_NAMES = MONTHS;
export const DAY_NAMES = DAYS;
