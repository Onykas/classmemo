import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './env.js';

/*
 * Fine wrapper autour de node:sqlite (intégré à Node ≥ 22) pour offrir une API
 * proche de better-sqlite3 : db.prepare(sql).get/all/run, db.exec, db.transaction.
 * Évite toute dépendance native à compiler.
 */

const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

function isPlainObject(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    !(v instanceof Uint8Array) &&
    !(typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) &&
    !(v instanceof Date)
  );
}

// node:sqlite attend l'objet de paramètres nommés en PREMIER, puis les
// paramètres positionnels. better-sqlite3 fait l'inverse -> on normalise.
function normalize(args) {
  if (args.length && isPlainObject(args[args.length - 1])) {
    return [args[args.length - 1], ...args.slice(0, -1)];
  }
  return args;
}

function prepare(sql) {
  const st = raw.prepare(sql);
  try {
    st.setAllowBareNamedParameters(true);
  } catch {
    /* version plus ancienne : ignore */
  }
  return {
    get: (...a) => st.get(...normalize(a)),
    all: (...a) => st.all(...normalize(a)),
    run: (...a) => st.run(...normalize(a)),
  };
}

export const db = {
  prepare,
  exec: (sql) => raw.exec(sql),
  transaction(fn) {
    return (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          raw.exec('ROLLBACK');
        } catch {
          /* rien */
        }
        throw err;
      }
    };
  },
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
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  subject_label TEXT,
  max_members INTEGER DEFAULT 4,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'membre',
  presence TEXT DEFAULT 'offline',
  activity TEXT,
  last_seen TEXT,
  joined_at TEXT DEFAULT (datetime('now')),
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
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS course_pages (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  image_url TEXT,
  label TEXT,
  ocr_text TEXT,
  quality TEXT DEFAULT 'Net',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  subject_id TEXT,
  group_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tag TEXT DEFAULT 'Notion clé',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  flashcard_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ease REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  due_date TEXT,
  last_grade INTEGER,
  last_reviewed TEXT,
  PRIMARY KEY (flashcard_id, user_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT DEFAULT 'Quiz de groupe',
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'topic',
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS missed_days (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_courses_group ON courses(group_id, status);
CREATE INDEX IF NOT EXISTS idx_pages_course ON course_pages(course_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_group ON flashcards(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_events_group ON calendar_events(group_id, date);
`;

db.exec(SCHEMA);

export const j = (v) => (v == null ? null : JSON.stringify(v));
export const parseJson = (s, fallback = null) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};
