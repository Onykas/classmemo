import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get, post, upload } from '../api.js';
import { recognize } from '../lib/ocr.js';
import { downscaleImage } from '../lib/image.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip, useToast } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

let localSeq = 0;

export default function AddNotes() {
  const { group } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);

  const [subjects, setSubjects] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [mode, setMode] = useState('existing'); // 'existing' = séance d'un cours en cours, 'new' = nouveau cours
  const [courseId, setCourseId] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [teacher, setTeacher] = useState('');
  const [note, setNote] = useState('');
  const [addNote, setAddNote] = useState(true);
  const [pages, setPages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    get(`/groups/${group.id}/subjects`).then((s) => {
      setSubjects(s);
      setSubjectId(s[0]?.id || null);
    });
    get(`/groups/${group.id}/courses?status=all&limit=100`).then((list) => {
      setCourses(list);
      setCourseId(list[0]?.id || null);
      setMode(list.length ? 'existing' : 'new');
    });
  }, [group.id]);

  if (!subjects) return <ScreenLoader />;
  const subject = subjects.find((s) => s.id === subjectId);
  const existingCourse = courses.find((c) => c.id === courseId) || null;

  async function addSubject() {
    const name = window.prompt('Nom de la matière (ex. Anatomie, Droit civil…) :');
    if (!name?.trim()) return;
    try {
      const s = await post(`/groups/${group.id}/subjects`, { name: name.trim() });
      setSubjects((list) => [...list, s]);
      setSubjectId(s.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function addTextPage() {
    const localId = `t${++localSeq}`;
    setPages((p) => [
      ...p,
      { localId, file: null, previewUrl: null, ocrText: '', progress: 1, status: 'text', label: `Texte ${p.filter((x) => !x.file).length + 1}` },
    ]);
  }

  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const original of files) {
      const localId = `p${++localSeq}`;
      const file = await downscaleImage(original);
      const previewUrl = URL.createObjectURL(file);
      setPages((p) => [
        ...p,
        { localId, file, previewUrl, ocrText: '', progress: 0, status: 'ocr', label: `Page ${p.length + 1}` },
      ]);
      recognize(file, (progress) =>
        setPages((p) => p.map((x) => (x.localId === localId ? { ...x, progress } : x))),
      ).then((text) =>
        setPages((p) =>
          p.map((x) => (x.localId === localId ? { ...x, ocrText: text, status: text ? 'done' : 'empty' } : x)),
        ),
      );
    }
  }

  const setPage = (localId, patch) =>
    setPages((p) => p.map((x) => (x.localId === localId ? { ...x, ...patch } : x)));
  const removePage = (localId) => setPages((p) => p.filter((x) => x.localId !== localId));

  const targetOk = mode === 'new' ? !!subjectId : !!courseId;
  const canSubmit =
    targetOk &&
    pages.length > 0 &&
    pages.every((p) => p.status !== 'ocr') &&
    pages.every((p) => p.file || (p.ocrText || '').trim()) &&
    !submitting;

  async function submit() {
    setSubmitting(true);
    try {
      let cid;
      let sessionId;
      if (mode === 'new') {
        const course = await post('/courses', {
          groupId: group.id,
          subjectId,
          title: title.trim() || `${subject?.name || 'Cours'} — ${formatDate(date)}`,
          teacher: teacher.trim() || null,
          date,
          location: location.trim() || null,
        });
        cid = course.id;
        sessionId = course.currentSessionId;
      } else {
        cid = courseId;
        const s = await post(`/courses/${cid}/sessions`, { date, note: addNote ? note.trim() || null : null });
        sessionId = s.id;
      }
      for (const p of pages) {
        const fd = new FormData();
        if (p.file) fd.append('image', p.file, p.file.name);
        if (sessionId) fd.append('sessionId', sessionId);
        fd.append('label', p.label);
        fd.append('ocrText', p.ocrText || '');
        fd.append('quality', p.file ? (p.status === 'done' ? 'Net' : 'À vérifier') : 'Saisi');
        await upload(`/courses/${cid}/pages`, fd);
      }
      await post(`/courses/${cid}/analyze`, { note: addNote ? note.trim() || null : null });
      navigate(`/courses/${cid}/analyzing`, { replace: true });
    } catch (err) {
      toast(err.message, 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar label="Retour" to="/" right={<span className="text-caption font-semibold bg-surface-container-high px-2 py-1 rounded-full">Préparation</span>} />

      <header>
        <h1 className="text-headline-lg-mobile font-bold text-primary">Déposer des notes</h1>
        <p className="text-body-sm text-on-surface-variant">Partage tes croquis et synthèses avec {group.name}.</p>
      </header>

      <div className="bg-surface-container-low rounded-2xl p-space-md flex items-start gap-space-sm">
        <span className="w-11 h-11 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center flex-shrink-0">
          <Icon name="edit_note" size={22} />
        </span>
        <div>
          <p className="text-label-md font-bold text-on-surface flex items-center gap-2">
            C'est ton tour aujourd'hui <span className="text-caption font-semibold bg-primary-fixed text-primary px-2 py-0.5 rounded-full">Scribe</span>
          </p>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            L'équipe relira et annotera la fiche dès sa génération pour valider les notions clés.
          </p>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="flex bg-surface-container rounded-xl p-1 text-label-md font-semibold">
          {[
            ['existing', 'Séance d’un cours'],
            ['new', 'Nouveau cours'],
          ].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 h-9 rounded-lg transition-colors ${
                mode === m ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'existing' ? (
        <>
          <Field label="Ajouter la séance au cours">
            <div className="flex flex-col gap-1.5">
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCourseId(c.id)}
                  className={`flex items-center justify-between px-3 h-12 rounded-xl text-left transition-colors ${
                    courseId === c.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-label-md font-semibold">{c.title}</span>
                    <span className={`block text-caption ${courseId === c.id ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                      {c.teacher ? c.teacher + ' · ' : ''}{c.sessionCount || 0} séance·s
                    </span>
                  </span>
                  {courseId === c.id && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date de la séance">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md w-full"
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Matière du cours">
            <div className="flex gap-2 flex-wrap items-center">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSubjectId(s.id)}
                  className={`transition-all ${subjectId === s.id ? '' : 'opacity-55'}`}
                >
                  <SubjectChip colorKey={s.colorKey} label={s.name} />
                </button>
              ))}
              <button
                onClick={addSubject}
                className="h-8 px-3 rounded-full bg-surface-container-high text-primary text-label-md font-semibold flex items-center gap-1"
              >
                <Icon name="add" size={16} /> Matière
              </button>
            </div>
            {subjects.length === 0 && (
              <p className="text-caption text-on-surface-variant mt-1">Ajoute une matière pour classer ce cours.</p>
            )}
          </Field>

          <Field label="Titre du cours">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Conception PSM…"
              className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md w-full"
            />
          </Field>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Enseignant·e (facultatif)">
              <input
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="M. Tajariol"
                className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md w-full"
              />
            </Field>
            <Field label="Date de la séance">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md w-full"
              />
            </Field>
          </div>

          <Field label="Lieu (facultatif)">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Amphi B…"
              className="h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] outline-none focus:ring-2 focus:ring-primary text-body-md w-full"
            />
          </Field>
        </>
      )}

      <Field label="Notes du cours" hint={pages.length ? `${pages.length} bloc·s` : 'OCR local (français)'}>
        <div className="bg-surface-container-low rounded-2xl p-space-md flex flex-col items-center text-center gap-2">
          <span className="w-12 h-12 rounded-full bg-surface-container-highest text-primary flex items-center justify-center">
            <Icon name="document_scanner" size={24} />
          </span>
          <p className="text-label-md font-semibold text-on-surface">Ajoute le contenu du cours</p>
          <p className="text-caption text-on-surface-variant max-w-[17rem]">
            Photo de tes feuillets (transcription automatique) ou saisie du texte à la main. Tu peux combiner plusieurs blocs.
          </p>
          <div className="flex gap-2 mt-1 flex-wrap justify-center">
            <Btn icon="add_a_photo" onClick={() => fileRef.current?.click()}>Photo</Btn>
            <Btn variant="ghost" icon="keyboard" onClick={addTextPage}>Écrire le texte</Btn>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        </div>
      </Field>

      {pages.length > 0 && (
        <div className="flex flex-col gap-space-sm">
          {pages.map((p) => (
            <Card key={p.localId} className="p-space-sm">
              <div className="flex gap-3">
                {p.previewUrl ? (
                  <img src={p.previewUrl} alt="" className="w-20 h-20 rounded-xl object-cover bg-surface-container flex-shrink-0" />
                ) : (
                  <span className="w-20 h-20 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 text-primary">
                    <Icon name="keyboard" size={24} />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <input
                      value={p.label}
                      onChange={(e) => setPage(p.localId, { label: e.target.value })}
                      className="text-label-md font-semibold bg-transparent outline-none w-32"
                    />
                    <button onClick={() => removePage(p.localId)} className="text-error">
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                  <p className="text-caption text-on-surface-variant mt-0.5">
                    {p.status === 'ocr'
                      ? `Transcription… ${Math.round((p.progress || 0) * 100)}%`
                      : p.status === 'text'
                        ? 'Texte saisi à la main'
                        : p.status === 'empty'
                          ? 'Aucun texte détecté — saisis-le à la main'
                          : 'Texte transcrit ✓'}
                  </p>
                  {p.status === 'ocr' && (
                    <div className="h-1 bg-surface-container rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${(p.progress || 0) * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={p.ocrText}
                onChange={(e) => setPage(p.localId, { ocrText: e.target.value })}
                rows={p.file ? 4 : 6}
                placeholder={p.file ? 'Transcription de la page…' : 'Écris ou colle le contenu du cours ici…'}
                className="w-full mt-2 p-2 rounded-xl bg-surface-container-low text-body-sm outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </Card>
          ))}
        </div>
      )}

      <Card className="p-space-md">
        <label className="flex items-center gap-2 text-label-md font-semibold">
          <input type="checkbox" checked={addNote} onChange={(e) => setAddNote(e.target.checked)} className="w-4 h-4 accent-primary" />
          Ajouter un mot pour le groupe
        </label>
        {addNote && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Précise un point clé ou une question pour l'équipe…"
            className="w-full mt-2 p-2 rounded-xl bg-surface-container-low text-body-sm outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        )}
      </Card>

      <Btn onClick={submit} disabled={!canSubmit} iconRight="arrow_forward" className="w-full">
        {submitting
          ? 'Envoi…'
          : mode === 'existing'
            ? 'Ajouter la séance & mettre à jour la fiche'
            : "Créer le cours & lancer l'analyse"}
      </Btn>
      <p className="text-caption text-on-surface-variant flex items-center gap-1 justify-center text-center">
        <Icon name="bolt" size={13} />
        {mode === 'existing'
          ? "L'IA régénère résumé, flashcards & quiz sur toutes les séances"
          : 'Génération automatique : résumé, flashcards & quiz interactif'}
      </p>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-label-md font-semibold text-on-surface">{label}</span>
        {hint && <span className="text-caption text-on-surface-variant">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
