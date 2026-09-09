import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Chargeur .env minimal (évite une dépendance).
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || 'classmemo-dev-secret-change-me';
export const DEFAULT_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

// Notifications push (Web Push / VAPID). Générer une paire : `npm -w server run vapid`,
// puis renseigner VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (et VAPID_SUBJECT) dans l'env.
// Absentes -> les rappels push sont simplement désactivés.
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@classmemo.app';
// Fuseau horaire de référence pour l'heure des rappels (par défaut : Kinshasa).
export const REMINDER_TZ = process.env.REMINDER_TZ || 'Africa/Kinshasa';

// PostgreSQL en prod (Neon/Render). Absent en local -> PGlite (fichier server/pgdata).
export const DATABASE_URL = process.env.DATABASE_URL || '';

// En production, on peut monter un disque persistant et pointer DATA_DIR dessus
// (ex. DATA_DIR=/data). Par défaut : le dossier server/.
export const DATA_DIR = process.env.DATA_DIR || ROOT;
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'classmemo.db');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads');

// Dossier du build front à servir (single-origin). Par défaut : web/dist du repo.
export const WEB_DIST = process.env.WEB_DIST || path.resolve(ROOT, '..', 'web', 'dist');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
