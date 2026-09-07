import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export default function OriginalNotes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, loading } = useApi(`/courses/${id}`, [id]);
  const [active, setActive] = useState(0);

  if (loading || !course) return <ScreenLoader />;
  const pages = course.pages || [];
  const page = pages[active];

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Retour au cours" to={`/courses/${id}`} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-md font-bold text-primary">Notes manuscrites originales</h1>
          <p className="text-caption text-on-surface-variant">
            {course.subject?.name} • {formatDate(course.date)} • {course.author?.name?.split(' ')[0]}
          </p>
        </div>
        <span className="text-caption font-semibold bg-surface-container-high px-2 py-1 rounded-full">
          {pages.length ? `Page ${active + 1}/${pages.length}` : '—'}
        </span>
      </div>

      {page ? (
        <Card className="p-space-md">
          <div className="flex items-center justify-between mb-2">
            <SubjectChip colorKey={course.subject?.colorKey} label={page.label || `Page ${active + 1}`} />
            {page.quality && (
              <span className="text-caption text-primary flex items-center gap-1">
                <Icon name="check_circle" size={13} /> {page.quality}
              </span>
            )}
          </div>
          {page.imageUrl ? (
            <img src={page.imageUrl} alt={page.label} className="w-full rounded-xl bg-surface-container" />
          ) : (
            <div className="w-full aspect-[4/3] rounded-xl bg-[repeating-linear-gradient(#eef4e8_0_24px,#e2e9dc_24px_25px)] flex items-center justify-center text-outline">
              <Icon name="draw" size={40} />
            </div>
          )}
          <div className="mt-3 bg-surface-container-low rounded-xl p-3">
            <p className="text-caption uppercase tracking-wider text-on-surface-variant font-bold mb-1">Transcription OCR</p>
            <p className="text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{page.ocrText || '—'}</p>
          </div>
        </Card>
      ) : (
        <Card className="p-space-md text-body-sm text-on-surface-variant">Aucune page scannée pour ce cours.</Card>
      )}

      {pages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-28 rounded-xl p-2 text-left transition-all ${
                i === active ? 'bg-primary-fixed ring-2 ring-primary' : 'bg-surface-container-low'
              }`}
            >
              <div className="w-full aspect-[4/3] rounded-lg bg-surface-container mb-1 flex items-center justify-center text-outline">
                <Icon name="description" size={18} />
              </div>
              <p className="text-caption font-semibold text-on-surface truncate">P.{i + 1} — {p.label}</p>
            </button>
          ))}
        </div>
      )}

      <Btn onClick={() => navigate(`/courses/${id}`)} iconRight="arrow_forward" className="w-full">
        Voir la fiche rédigée correspondante
      </Btn>
    </div>
  );
}
