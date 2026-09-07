import { useMemo, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { get, patch, post } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, Sheet, SubjectChip, subjectStyle, useToast } from '../components/ui.jsx';
import { MONTH_NAMES, formatDayDate } from '../lib/format.js';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const STATUS = {
  missing: { dot: 'bg-error', label: 'À compléter' },
  scheduled: { dot: 'bg-secondary-container', label: 'Prévu / attente' },
  todo: { dot: 'bg-secondary-container', label: 'Prévu / attente' },
  validated: { dot: 'bg-primary-container', label: 'Fiche disponible' },
};

export default function CalendarScreen() {
  const { group, user } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(now.toISOString().slice(0, 10));
  const [sheet, setSheet] = useState(false);

  const monthStr = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
  const { data: events, loading, reload } = useApi(
    group ? `/groups/${group.id}/events?month=${monthStr}` : null,
    [group?.id, monthStr],
  );

  const byDate = useMemo(() => {
    const map = {};
    for (const e of events || []) (map[e.date] ||= []).push(e);
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${monthStr}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [cursor, monthStr]);

  function shift(delta) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  async function claim(ev) {
    try {
      await patch(`/events/${ev.id}`, { scribeId: 'me', status: ev.status === 'missing' ? 'scheduled' : ev.status });
      toast('Tu prends les notes pour cette séance ✍️', 'success');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (loading && !events) return <ScreenLoader />;
  const dayEvents = byDate[selected] || [];
  const missing = (events || []).find((e) => e.status === 'missing');

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Accueil" to="/" />
      <header className="flex items-center justify-between">
        <div>
          <span className="text-caption uppercase tracking-wider text-primary font-bold">Emploi du temps partagé</span>
          <h1 className="text-headline-lg-mobile font-bold text-primary">Calendrier</h1>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-high rounded-full px-1 py-1">
          <button onClick={() => shift(-1)} className="w-8 h-8 rounded-full flex items-center justify-center"><Icon name="chevron_left" size={18} /></button>
          <span className="text-label-md font-semibold px-1 capitalize">{MONTH_NAMES[cursor.m]} {cursor.y}</span>
          <button onClick={() => shift(1)} className="w-8 h-8 rounded-full flex items-center justify-center"><Icon name="chevron_right" size={18} /></button>
        </div>
      </header>

      <Card className="p-space-md">
        <div className="grid grid-cols-7 text-center text-caption text-on-surface-variant mb-1">
          {WEEK.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((date, i) => {
            if (!date) return <span key={i} />;
            const day = Number(date.slice(-2));
            const isSel = date === selected;
            const evs = byDate[date] || [];
            return (
              <button
                key={i}
                onClick={() => setSelected(date)}
                className={`h-10 mx-auto w-10 rounded-full flex flex-col items-center justify-center text-body-sm relative ${
                  isSel ? 'bg-primary text-on-primary font-bold' : 'text-on-surface'
                }`}
              >
                {day}
                {evs.length > 0 && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {evs.slice(0, 3).map((e, k) => (
                      <span key={k} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-on-primary' : STATUS[e.status]?.dot || 'bg-outline'}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-caption text-on-surface-variant">
          {Object.entries({ validated: 'Fiche disponible', scheduled: 'En attente', missing: 'À compléter' }).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${STATUS[k].dot}`} /> {label}</span>
          ))}
        </div>
      </Card>

      {missing && (
        <div className="bg-error-container/40 rounded-2xl p-space-md flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-error text-on-error flex items-center justify-center flex-shrink-0">
            <Icon name="priority_high" size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-label-md font-semibold text-on-error-container truncate">{missing.title}</p>
            <p className="text-caption text-on-error-container/80">Notes manquantes — qui s'en occupe ?</p>
          </div>
          <button onClick={() => claim(missing)} className="h-9 px-3 rounded-xl bg-surface-container-lowest text-primary text-label-sm font-semibold">
            Je prends
          </button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-headline-sm font-semibold capitalize flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" /> {formatDayDate(selected)}
          </h2>
          <span className="text-caption text-on-surface-variant">{dayEvents.length} cours</span>
        </div>
        <div className="flex flex-col gap-space-sm">
          {dayEvents.map((e) => {
            const st = subjectStyle(e.colorKey);
            return (
              <Card key={e.id} className="p-space-md flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <SubjectChip colorKey={e.colorKey} label={e.subjectLabel} />
                  <span className="text-caption text-on-surface-variant flex items-center gap-1">
                    <Icon name="schedule" size={13} /> {e.startTime}–{e.endTime}
                  </span>
                </div>
                <h3 className="text-headline-sm font-semibold text-primary">{e.title}</h3>
                {e.description && <p className="text-body-sm text-on-surface-variant">{e.description}</p>}
                <div className="flex items-center justify-between text-caption">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${st.soft}`}>
                    {STATUS[e.status]?.label || e.status}
                  </span>
                  {e.scribe ? (
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Icon name="edit_note" size={14} /> {e.scribe.name.split(' ')[0]}
                    </span>
                  ) : (
                    <button onClick={() => claim(e)} className="text-primary font-semibold flex items-center gap-1">
                      <Icon name="pan_tool_alt" size={14} /> Je prends les notes
                    </button>
                  )}
                </div>
                {e.courseId && (
                  <a href={`/courses/${e.courseId}`} className="text-primary text-label-md font-semibold flex items-center gap-1">
                    Ouvrir la fiche <Icon name="arrow_forward" size={14} />
                  </a>
                )}
              </Card>
            );
          })}
          {dayEvents.length === 0 && <p className="text-body-sm text-on-surface-variant">Aucune séance ce jour-là.</p>}
        </div>
      </section>

      <Btn variant="ghost" icon="add" onClick={() => setSheet(true)} className="w-full">Ajouter une séance</Btn>

      <NewEventSheet
        open={sheet}
        onClose={() => setSheet(false)}
        date={selected}
        groupId={group.id}
        onCreated={() => {
          setSheet(false);
          reload();
        }}
      />
    </div>
  );
}

function NewEventSheet({ open, onClose, date, groupId, onCreated }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', subjectLabel: '', colorKey: 'psm', date, startTime: '09:00', endTime: '11:00', location: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function create() {
    try {
      await post(`/groups/${groupId}/events`, f);
      toast('Séance ajoutée', 'success');
      onCreated();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle séance">
      <div className="flex flex-col gap-space-sm">
        <input placeholder="Titre du cours" value={f.title} onChange={set('title')} className="h-12 px-3 rounded-xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary" />
        <input placeholder="Matière (libellé)" value={f.subjectLabel} onChange={set('subjectLabel')} className="h-12 px-3 rounded-xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary" />
        <div className="flex gap-2">
          {['psm', 'iot', 'gestion', 'ux'].map((k) => (
            <button key={k} onClick={() => setF((s) => ({ ...s, colorKey: k }))} className={f.colorKey === k ? '' : 'opacity-50'}>
              <SubjectChip colorKey={k} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={f.date} onChange={set('date')} className="h-12 px-2 rounded-xl bg-surface-container-low outline-none text-body-sm" />
          <input type="time" value={f.startTime} onChange={set('startTime')} className="h-12 px-2 rounded-xl bg-surface-container-low outline-none text-body-sm" />
          <input type="time" value={f.endTime} onChange={set('endTime')} className="h-12 px-2 rounded-xl bg-surface-container-low outline-none text-body-sm" />
        </div>
        <input placeholder="Lieu" value={f.location} onChange={set('location')} className="h-12 px-3 rounded-xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary" />
        <Btn onClick={create} disabled={f.title.trim().length < 2} className="w-full">Ajouter au calendrier</Btn>
      </div>
    </Sheet>
  );
}
