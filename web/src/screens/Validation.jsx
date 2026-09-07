import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, patch, post } from '../api.js';
import { BackBar, Btn, Card, Icon, ScreenLoader, SubjectChip, useToast } from '../components/ui.jsx';

export default function Validation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [course, setCourse] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get(`/courses/${id}`).then((c) => {
      setCourse(c);
      setForm({
        title: c.title,
        summary: c.summary || '',
        keyPoints: (c.keyPoints || []).join('\n'),
        analogy: c.analogy?.body || '',
      });
    });
  }, [id]);

  if (!course || !form) return <ScreenLoader />;

  async function save() {
    setBusy(true);
    try {
      const updated = await patch(`/courses/${id}`, {
        title: form.title,
        summary: form.summary,
        keyPoints: form.keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
        analogy: { title: course.analogy?.title, body: form.analogy },
      });
      setCourse(updated);
      setEdit(false);
      toast('Modifications enregistrées', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await post(`/courses/${id}/publish`);
      toast('Notes publiées pour le groupe 🎉', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-md py-space-sm">
      <BackBar
        label="Recommencer"
        to="/add-notes"
        right={<span className="text-caption font-semibold text-secondary bg-secondary-fixed px-2 py-1 rounded-full">Prêt pour la tablée</span>}
      />

      <header>
        <h1 className="text-headline-lg-mobile font-bold text-primary">Tes notes sont prêtes 🎉</h1>
        <p className="text-body-sm text-on-surface-variant">
          Vérifie la synthèse générée{course.generatedBy === 'heuristique' ? ' (mode local, sans IA)' : ' par Claude'} avant de la partager.
        </p>
      </header>

      <Card className="p-space-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SubjectChip colorKey={course.subject?.colorKey} label={course.subject?.name} />
          <span className="text-caption text-primary flex items-center gap-1">
            <Icon name="auto_fix_high" size={13} /> Auto-structuré
          </span>
        </div>
        {edit ? (
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="text-headline-md font-bold text-primary bg-surface-container-low rounded-lg px-2 py-1 outline-none"
          />
        ) : (
          <h2 className="text-headline-md font-bold text-primary">{course.title}</h2>
        )}
        <p className="text-caption text-on-surface-variant">{course.pages?.length || 0} page·s manuscrites jointes</p>
      </Card>

      <Block icon="subject" title="Résumé synthétique" valid>
        {edit ? (
          <textarea
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            rows={7}
            className="w-full p-2 rounded-xl bg-surface-container-low text-body-sm outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          (course.summary || '').split('\n\n').map((p, i) => (
            <p key={i} className="text-body-sm text-on-surface-variant leading-relaxed mb-2 last:mb-0">{p}</p>
          ))
        )}
      </Block>

      <Block icon="star" title={`${(course.keyPoints || []).length} points essentiels « À retenir »`} valid>
        {edit ? (
          <textarea
            value={form.keyPoints}
            onChange={(e) => setForm((f) => ({ ...f, keyPoints: e.target.value }))}
            rows={4}
            className="w-full p-2 rounded-xl bg-surface-container-low text-body-sm outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <ul className="list-disc pl-4 text-body-sm text-on-surface-variant space-y-1">
            {(course.keyPoints || []).map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        )}
      </Block>

      <Block icon="lightbulb" title="Analogie « Comprendre simplement »" valid>
        {edit ? (
          <textarea
            value={form.analogy}
            onChange={(e) => setForm((f) => ({ ...f, analogy: e.target.value }))}
            rows={4}
            className="w-full p-2 rounded-xl bg-surface-container-low text-body-sm outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <p className="text-body-sm text-on-secondary-fixed-variant italic bg-secondary-fixed/40 rounded-xl p-3">
            « {course.analogy?.body} »
          </p>
        )}
      </Block>

      <div className="grid grid-cols-2 gap-space-sm">
        <MiniStat icon="style" value={course.flashcardCount} label="Flashcards" sub="Répétition espacée" />
        <MiniStat icon="quiz" value={course.quiz?.questionCount || 0} label="Quiz de groupe" sub="QCM prêts" />
      </div>

      <div className="bg-surface-container-low rounded-2xl p-space-md flex items-start gap-2">
        <Icon name="notifications_active" size={18} className="text-secondary flex-shrink-0 mt-0.5" />
        <p className="text-body-sm text-on-surface-variant">
          Une notification discrète sera envoyée au groupe : « {course.author?.name?.split(' ')[0]} a déposé les notes de {course.subject?.name}. »
        </p>
      </div>

      <div className="flex flex-col gap-space-sm">
        <Btn onClick={publish} disabled={busy} icon="rocket_launch" className="w-full">
          Publier pour le groupe
        </Btn>
        {edit ? (
          <Btn variant="ghost" onClick={save} disabled={busy} icon="save" className="w-full">
            Enregistrer les modifications
          </Btn>
        ) : (
          <Btn variant="ghost" onClick={() => setEdit(true)} icon="tune" className="w-full">
            Modifier manuellement l'ensemble
          </Btn>
        )}
      </div>
    </div>
  );
}

function Block({ icon, title, valid, children }) {
  return (
    <Card className="p-space-md">
      <div className="flex items-center gap-2 mb-2">
        {valid && (
          <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
            <Icon name="check" size={14} />
          </span>
        )}
        <p className="text-label-md font-bold text-on-surface flex items-center gap-1.5">
          <Icon name={icon} size={16} className="text-secondary" /> {title}
        </p>
      </div>
      {children}
    </Card>
  );
}

function MiniStat({ icon, value, label, sub }) {
  return (
    <Card className="p-space-md">
      <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center">
        <Icon name={icon} size={16} />
      </span>
      <p className="text-headline-md font-bold text-primary mt-2">{value}</p>
      <p className="text-label-md text-on-surface">{label}</p>
      <p className="text-caption text-on-surface-variant">{sub}</p>
    </Card>
  );
}
