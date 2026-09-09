import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Btn, Icon, useToast } from '../components/ui.jsx';

const DEMO = [
  { email: 'thomas@classmemo.app', name: 'Thomas' },
  { email: 'emma@classmemo.app', name: 'Emma' },
  { email: 'lucas@classmemo.app', name: 'Lucas' },
  { email: 'lea@classmemo.app', name: 'Léa' },
];

export default function Login() {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email.trim(), form.password);
      else await register(form.email.trim(), form.password, form.name.trim());
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function quick(email) {
    setBusy(true);
    try {
      await login(email, 'demo1234');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-space-lg py-space-2xl max-w-app mx-auto">
      <div className="flex flex-col items-center gap-2 mb-8">
        <img src="/icon.svg" alt="ClassMemo" className="w-16 h-16" />
        <h1 className="text-headline-lg-mobile font-bold text-primary">ClassMemo</h1>
        <p className="text-body-sm text-on-surface-variant text-center max-w-[16rem]">
          Le sanctuaire d'étude bienveillant de ta petite tablée.
        </p>
      </div>

      <form onSubmit={submit} className="w-full flex flex-col gap-space-sm bg-surface-container-lowest rounded-2xl shadow-card ring-1 ring-black/[0.04] p-space-lg">
        <div className="flex bg-surface-container rounded-xl p-1 text-label-md font-semibold">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 h-9 rounded-lg transition-colors ${mode === m ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              {m === 'login' ? 'Connexion' : 'Créer un compte'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <Field icon="badge" placeholder="Ton prénom et nom" value={form.name} onChange={set('name')} />
        )}
        <Field icon="mail" type="email" placeholder="E-mail" value={form.email} onChange={set('email')} required />
        <Field icon="lock" type="password" placeholder="Mot de passe" value={form.password} onChange={set('password')} required />

        <Btn type="submit" disabled={busy} className="mt-1 w-full">
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </Btn>
      </form>

      <div className="w-full mt-6">
        <p className="text-caption uppercase tracking-wider text-on-surface-variant text-center mb-2">Comptes de démonstration</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              onClick={() => quick(d.email)}
              disabled={busy}
              className="h-11 rounded-xl bg-surface-container-high text-primary text-label-md font-semibold hover:bg-surface-container-highest transition-colors active:scale-[0.98]"
            >
              {d.name}
            </button>
          ))}
        </div>
        <p className="text-caption text-on-surface-variant text-center mt-2">
          Tablée « PSM 2026 » • code <span className="font-semibold">CLAS-8942</span>
        </p>
      </div>
    </div>
  );
}

function Field({ icon, ...rest }) {
  return (
    <label className="flex items-center gap-2 h-12 px-3 rounded-xl bg-surface-container-lowest ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-primary transition-all">
      <Icon name={icon} size={18} className="text-on-surface-variant" />
      <input
        {...rest}
        className="flex-1 bg-transparent outline-none text-body-md placeholder:text-on-surface-variant/60"
      />
    </label>
  );
}
