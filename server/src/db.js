/*
 * Couche base de données PostgreSQL.
 *  - En prod : variable DATABASE_URL -> pool `pg` (Neon, Render, etc.).
 *  - En local : pas de DATABASE_URL -> PGlite (PostgreSQL en WASM, fichier local),
 *    zéro installation.
 * API async unifiée : db.get / db.all / db.run / db.exec / db.tx.
 * On garde une syntaxe proche de l'ancien code : placeholders `?` (positionnels)
 * et `@nom` (nommés), réécrits en `$n` pour Postgres.
 */
import path from 'node:path';
import { DATABASE_URL, ROOT } from './env.js';

const isPlainObject = (v) =>
  v != null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !(typeof Buffer !== 'undefined' && Buffer.isBuffer(v));

// Réécrit `?` et `@nom` en `$1, $2, …` et construit le tableau de valeurs.
function build(sql, args) {
  let named = null;
  let positional = args;
  if (args.length && isPlainObject(args[args.length - 1])) {
    named = args[args.length - 1];
    positional = args.slice(0, -1);
  }
  const values = [];
  const nameIdx = new Map();

  let text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, name) => {
    if (!named || !(name in named)) return m;
    if (!nameIdx.has(name)) {
      values.push(named[name]);
      nameIdx.set(name, values.length);
    }
    return '$' + nameIdx.get(name);
  });

  let p = 0;
  text = text.replace(/\?/g, () => {
    values.push(positional[p++]);
    return '$' + values.length;
  });

  return { text, values };
}

// --- Choix du driver ---

let driver;

if (DATABASE_URL) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: /sslmode=disable/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    max: 8,
  });
  driver = {
    query: (text, values) => pool.query(text, values),
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await fn((sql, ...a) => {
          const { text, values } = build(sql, a);
          return client.query(text, values);
        });
        await client.query('COMMIT');
        return r;
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* rien */
        }
        throw e;
      } finally {
        client.release();
      }
    },
  };
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || path.join(ROOT, 'pgdata');
  const lite = new PGlite(dir);
  await lite.waitReady;
  driver = {
    query: (text, values) => lite.query(text, values),
    exec: (sql) => lite.exec(sql),
    async tx(fn) {
      return lite.transaction(async (t) =>
        fn((sql, ...a) => {
          const { text, values } = build(sql, a);
          return t.query(text, values);
        }),
      );
    },
  };
}

export const db = {
  async get(sql, ...args) {
    const { text, values } = build(sql, args);
    const { rows } = await driver.query(text, values);
    return rows[0] ?? null;
  },
  async all(sql, ...args) {
    const { text, values } = build(sql, args);
    const { rows } = await driver.query(text, values);
    return rows;
  },
  async run(sql, ...args) {
    const { text, values } = build(sql, args);
    return driver.query(text, values);
  },
  exec: (sql) => driver.exec(sql),
  tx: (fn) => driver.tx(fn),
};

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_label TEXT DEFAULT 'Étudiant·e',
  avatar_url TEXT,
  anthropic_key TEXT,
  model TEXT DEFAULT 'claude-opus-5',
  reminder_freq TEXT DEFAULT '2/jour',
  evening_reminder INTEGER DEFAULT 1,
  sr_enabled INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  subject_label TEXT,
  max_members INTEGER DEFAULT 4,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'membre',
  presence TEXT DEFAULT 'offline',
  activity TEXT,
  last_seen TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color_key TEXT DEFAULT 'psm',
  description TEXT,
  modules_count INTEGER DEFAULT 0,
  semester TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  subject_id TEXT,
  title TEXT NOT NULL,
  date TEXT,
  session_label TEXT,
  location TEXT,
  status TEXT DEFAULT 'draft',
  analysis_step INTEGER DEFAULT 0,
  generated_by TEXT,
  author_id TEXT,
  summary TEXT,
  key_points TEXT,
  analogy_title TEXT,
  analogy_body TEXT,
  notions TEXT,
  reading_time INTEGER DEFAULT 5,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS course_pages (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  image_url TEXT,
  image_data TEXT,
  label TEXT,
  ocr_text TEXT,
  quality TEXT DEFAULT 'Net',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  subject_id TEXT,
  group_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tag TEXT DEFAULT 'Notion clé',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  flashcard_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ease REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  due_date TEXT,
  last_grade INTEGER,
  last_reviewed TIMESTAMPTZ,
  PRIMARY KEY (flashcard_id, user_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT DEFAULT 'Quiz de groupe',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER,
  total INTEGER,
  answers TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capsules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,
  notion TEXT,
  title TEXT,
  simple_translation TEXT,
  body TEXT,
  analogy_title TEXT,
  analogy_body TEXT,
  key_points TEXT,
  challenge_question TEXT,
  challenge_options TEXT,
  challenge_correct_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  course_id TEXT,
  subject_label TEXT,
  color_key TEXT DEFAULT 'psm',
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  scribe_id TEXT,
  status TEXT DEFAULT 'todo',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'topic',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  user_id TEXT,
  kind TEXT DEFAULT 'user',
  body TEXT,
  attachment_url TEXT,
  card_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  meta TEXT,
  read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS missed_days (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_group ON courses(group_id, status);
CREATE INDEX IF NOT EXISTS idx_pages_course ON course_pages(course_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_group ON flashcards(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_events_group ON calendar_events(group_id, date);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
`;

// Ajouts de colonnes sur des tables déjà créées (montée de version en douceur).
const ALTERS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_last TEXT`,
];

export async function migrate() {
  await db.exec(SCHEMA);
  for (const sql of ALTERS) {
    try {
      await db.exec(sql);
    } catch (err) {
      console.warn('[migrate] alter ignoré :', err.message);
    }
  }
}

export const j = (v) => (v == null ? null : JSON.stringify(v));
export const parseJson = (s, fallback = null) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

export const TODAY = () => new Date().toISOString().slice(0, 10);
