import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get } from '../api.js';
import { ScreenLoader } from '../components/ui.jsx';
import { formatDayDate } from '../lib/format.js';

const PARTS = [
  ['summary', 'Synthèse IA'],
  ['sessions', 'Notes des séances'],
  ['flashcards', 'Flashcards'],
];

export default function CoursePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [parts, setParts] = useState({ summary: true, sessions: true, flashcards: true });
  const [sessionId, setSessionId] = useState('all');

  useEffect(() => {
    get(`/courses/${id}/full`).then(setCourse);
  }, [id]);

  const shownSessions = useMemo(() => {
    if (!course) return [];
    return sessionId === 'all'
      ? course.sessionsFull
      : course.sessionsFull.filter((s) => s.id === sessionId);
  }, [course, sessionId]);

  if (!course) return <ScreenLoader />;
  const toggle = (k) => setParts((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="print-doc">
      <style>{`
        .print-doc { max-width: 720px; margin: 0 auto; padding: 24px 20px 80px; color: #1c2621; font-size: 14px; line-height: 1.6; }
        .print-doc h1 { font-size: 24px; font-weight: 800; color: #134231; margin: 0 0 2px; }
        .print-doc h2 { font-size: 17px; font-weight: 700; color: #134231; margin: 26px 0 8px; border-bottom: 1px solid #d8e2dc; padding-bottom: 3px; }
        .print-doc h3 { font-size: 14px; font-weight: 700; margin: 16px 0 4px; }
        .print-doc .muted { color: #5b6b63; font-size: 12px; }
        .print-doc ul { margin: 4px 0 4px 18px; padding: 0; }
        .print-doc .card { border: 1px solid #d8e2dc; border-radius: 10px; padding: 10px 12px; margin: 6px 0; }
        .print-doc .fc { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .print-doc .fc > div { border: 1px solid #d8e2dc; border-radius: 8px; padding: 8px 10px; }
        .toolbar { position: sticky; top: 0; background: #f4f7f5; border: 1px solid #d8e2dc; border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .toolbar button, .toolbar select { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd6d0; background: #fff; cursor: pointer; }
        .toolbar .primary { background: #134231; color: #fff; border-color: #134231; font-weight: 600; }
        .toolbar .chip { border-radius: 999px; }
        .toolbar .chip.on { background: #134231; color: #fff; border-color: #134231; }
        @media print {
          .no-print { display: none !important; }
          .print-doc { padding: 0; max-width: none; }
          h2 { break-after: avoid; }
          .card, .fc > div { break-inside: avoid; }
        }
      `}</style>

      <div className="toolbar no-print">
        <button onClick={() => navigate(`/courses/${id}`)}>← Retour</button>
        {PARTS.map(([k, label]) => (
          <button key={k} className={`chip ${parts[k] ? 'on' : ''}`} onClick={() => toggle(k)}>
            {label}
          </button>
        ))}
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="all">Toutes les séances</option>
          {course.sessionsFull.map((s) => (
            <option key={s.id} value={s.id}>
              {s.date ? formatDayDate(s.date) : s.label}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => window.print()}>
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <h1>{course.title}</h1>
      <p className="muted">
        {course.subject?.name}
        {course.teacher ? ` · ${course.teacher}` : ''} · {course.sessionCount} séance
        {course.sessionCount > 1 ? 's' : ''}
        {course.sessionsFull.length > 0 &&
          ` · du ${formatDayDate(course.sessionsFull[0].date)} au ${formatDayDate(
            course.sessionsFull[course.sessionsFull.length - 1].date,
          )}`}
      </p>

      {parts.summary && course.summary && (
        <>
          <h2>Synthèse du cours</h2>
          {String(course.summary)
            .split('\n\n')
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          {course.keyPoints?.length > 0 && (
            <>
              <h3>À retenir</h3>
              <ul>
                {course.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </>
          )}
          {course.notions?.length > 0 && (
            <>
              <h3>Notions clés</h3>
              <ul>
                {course.notions.map((n, i) => (
                  <li key={i}>
                    <b>{n.term}</b> — {n.short}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {parts.sessions && (
        <>
          <h2>Notes des séances</h2>
          {shownSessions.map((s) => (
            <div key={s.id} className="card">
              <h3>
                {s.date ? formatDayDate(s.date) : s.label}
                {s.author ? <span className="muted"> · {s.author}</span> : null}
              </h3>
              {s.note && <p className="muted">Mot : {s.note}</p>}
              {s.pages.map((p) => (
                <p key={p.id} style={{ whiteSpace: 'pre-wrap' }}>
                  {p.ocrText || <span className="muted">(page image sans transcription)</span>}
                </p>
              ))}
              {s.pages.length === 0 && <p className="muted">Aucune note pour cette séance.</p>}
            </div>
          ))}
        </>
      )}

      {parts.flashcards && course.flashcards?.length > 0 && (
        <>
          <h2>Flashcards ({course.flashcards.length})</h2>
          <div className="fc">
            {course.flashcards.map((f, i) => (
              <div key={i}>
                <p style={{ fontWeight: 700, margin: 0 }}>{f.front}</p>
                <p style={{ margin: '4px 0 0' }}>{f.back}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
