import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { get, post } from '../api.js';
import { Avatar, BackBar, Icon, ScreenLoader, useToast } from '../components/ui.jsx';
import { timeOnly } from '../lib/format.js';

export default function GroupChat() {
  const { group, user, members, socket } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [threads, setThreads] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    get(`/groups/${group.id}/threads`).then((t) => {
      setThreads(t);
      setActiveThread(t[0]?.id || null);
    });
  }, [group.id]);

  useEffect(() => {
    if (!activeThread) return;
    get(`/threads/${activeThread}/messages`).then(setMessages);
  }, [activeThread]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (m) => {
      if (m.threadId === activeThread) setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    };
    const onThread = () => get(`/groups/${group.id}/threads`).then(setThreads);
    socket.on('chat:message', onMsg);
    socket.on('chat:thread', onThread);
    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:thread', onThread);
    };
  }, [socket, activeThread, group.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const m = await post(`/threads/${activeThread}/messages`, { body });
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    } catch (e) {
      toast(e.message, 'error');
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function addThread() {
    const name = window.prompt('Nom du nouveau fil :');
    if (!name) return;
    try {
      const t = await post(`/groups/${group.id}/threads`, { name });
      setThreads((list) => [...list, t]);
      setActiveThread(t.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (!threads) return <ScreenLoader />;
  const activeCount = members.filter((m) => m.presence === 'active').length;

  return (
    <div className="flex flex-col py-space-sm" style={{ minHeight: 'calc(100vh - 9rem)' }}>
      <BackBar label="Accueil" to="/" />

      <div className="bg-surface-container-lowest ring-1 ring-black/[0.04] rounded-2xl p-space-md shadow-card mt-2">
        <p className="text-headline-sm font-bold text-primary flex items-center gap-2">
          <Icon name="diversity_3" size={18} /> Entraide {group.name}
        </p>
        <p className="text-caption text-on-surface-variant flex items-center gap-1 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-primary-container" /> {activeCount}/{members.length} co-équipiers connectés
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto py-3">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveThread(t.id)}
            className={`flex-shrink-0 h-9 px-3 rounded-full text-label-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeThread === t.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {t.kind === 'default' ? <Icon name="tag" size={14} /> : <Icon name="push_pin" size={14} />}
            {t.name}
            {t.count > 0 && <span className="text-caption opacity-80">{t.count}</span>}
          </button>
        ))}
        <button onClick={addThread} className="flex-shrink-0 w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center">
          <Icon name="add" size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-space-md pb-4">
        {messages.map((m) => {
          if (m.kind === 'system') {
            return (
              <button
                key={m.id}
                onClick={() => m.cardRef?.courseId && navigate(`/courses/${m.cardRef.courseId}`)}
                className="self-center max-w-[85%] text-center text-caption text-on-surface-variant bg-surface-container-low rounded-full px-3 py-1.5"
              >
                <Icon name="menu_book" size={13} className="mr-1 align-middle" />
                {m.body}
              </button>
            );
          }
          if (m.kind === 'bot') {
            return (
              <div key={m.id} className="bg-secondary-fixed/50 rounded-2xl p-space-md flex gap-2">
                <span className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                  <Icon name="smart_toy" size={16} />
                </span>
                <div>
                  <p className="text-label-md font-bold text-on-secondary-fixed">ClassMemo Bot</p>
                  <p className="text-body-sm text-on-secondary-fixed-variant">{m.body}</p>
                </div>
              </div>
            );
          }
          const mine = m.user?.id === user.id;
          return (
            <div key={m.id} className={`flex gap-2 max-w-[85%] ${mine ? 'self-end flex-row-reverse' : 'self-start'}`}>
              {!mine && <Avatar user={m.user} size={28} />}
              <div>
                <p className={`text-caption text-on-surface-variant mb-0.5 ${mine ? 'text-right' : ''}`}>
                  {mine ? 'Moi' : m.user?.name?.split(' ')[0]} · {timeOnly(m.createdAt)}
                </p>
                <div
                  className={`rounded-2xl px-3 py-2 text-body-sm leading-relaxed ${
                    mine ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-lowest ring-1 ring-black/[0.04] rounded-tl-sm'
                  }`}
                >
                  {m.body}
                  {m.cardRef && (
                    <button
                      onClick={() => m.cardRef.courseId && navigate(`/courses/${m.cardRef.courseId}`)}
                      className={`mt-2 block text-left rounded-xl p-2 text-caption ${mine ? 'bg-primary-container/60' : 'bg-surface-container-low'}`}
                    >
                      <span className="font-semibold flex items-center gap-1"><Icon name="description" size={13} /> {m.cardRef.title}</span>
                      {m.cardRef.excerpt && <span className="opacity-80 block mt-0.5 line-clamp-2">{m.cardRef.excerpt}</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-body-sm text-on-surface-variant text-center py-8">Ouvre la discussion 👋</p>}
      </div>

      <div className="sticky bottom-[4.5rem] bg-surface pt-2">
        <div className="flex items-center gap-2 bg-surface-container-lowest ring-1 ring-black/[0.06] rounded-2xl p-2 shadow-card">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Écrire au groupe…"
            className="flex-1 bg-transparent outline-none px-2 text-body-md"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40"
          >
            <Icon name="arrow_upward" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
