import { nanoid } from 'nanoid';
import { db, j } from './db.js';
import { hashPassword } from './auth.js';

const id = () => nanoid(12);
const PW = hashPassword('demo1234');
const av = (email) => `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`;

console.log('Réinitialisation de la base ClassMemo…');

const tables = [
  'missed_days', 'notifications', 'chat_messages', 'chat_threads', 'calendar_events',
  'capsules', 'quiz_attempts', 'quiz_questions', 'quizzes', 'flashcard_reviews', 'flashcards',
  'course_pages', 'courses', 'subjects', 'group_members', 'groups', 'users',
];
const wipe = db.transaction(() => {
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
});
wipe();

// ---------- Utilisateurs ----------
const users = {
  thomas: { id: id(), email: 'thomas@classmemo.app', name: 'Thomas Martin', role: 'Master 1 Design & Numérique' },
  emma: { id: id(), email: 'emma@classmemo.app', name: 'Emma Roussel', role: 'Master 1 · Valideuse' },
  lucas: { id: id(), email: 'lucas@classmemo.app', name: 'Lucas Baptiste', role: 'Master 1 · IoT' },
  lea: { id: id(), email: 'lea@classmemo.app', name: 'Léa Fontaine', role: 'Master 1 · UX' },
};
const insUser = db.prepare(
  'INSERT INTO users (id, email, password_hash, name, role_label, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
);
for (const u of Object.values(users)) insUser.run(u.id, u.email, PW, u.name, u.role, av(u.email));

// ---------- Tablée ----------
const groupId = id();
db.prepare(
  'INSERT INTO groups (id, name, code, subject_label, created_by) VALUES (?, ?, ?, ?, ?)',
).run(groupId, 'Tablée PSM 2026', 'CLAS-8942', 'Master 1 Design & Numérique', users.thomas.id);

const insMember = db.prepare(
  'INSERT INTO group_members (group_id, user_id, role, presence, activity, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
);
const nowIso = new Date().toISOString();
insMember.run(groupId, users.thomas.id, 'scribe', 'active', "Scribe aujourd'hui", nowIso);
insMember.run(groupId, users.emma.id, 'valideuse', 'active', 'Connectée · Valideuse', nowIso);
insMember.run(groupId, users.lucas.id, 'membre', 'pause', 'En pause révision (15m)', nowIso);
insMember.run(groupId, users.lea.id, 'membre', 'offline', 'Revue il y a 3h', null);

// ---------- Matières ----------
const subjects = {
  psm: { id: id(), name: 'Systèmes Mobiles', color: 'psm', desc: 'Architecture, capteurs & Swift', modules: 3 },
  iot: { id: id(), name: 'Réseaux & Microcontrôleurs', color: 'iot', desc: 'Protocoles MQTT & LoRaWAN', modules: 2 },
  gestion: { id: id(), name: 'Scrum & Pilotage POC', color: 'gestion', desc: "Rituels d'équipe & sprints", modules: 5 },
  ux: { id: id(), name: 'Ergonomie Mobile & Accessibilité', color: 'ux', desc: 'Tests utilisateurs & micro-copies', modules: 4 },
};
const insSubject = db.prepare(
  'INSERT INTO subjects (id, group_id, name, color_key, description, modules_count, semester) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
for (const s of Object.values(subjects)) {
  insSubject.run(s.id, groupId, s.name, s.color, s.desc, s.modules, 'Semestre 1 · 2026');
}

// ---------- Cours publié : Conception de projet & Démarche POC ----------
const courseId = id();
const summary = [
  "La démarche POC (Proof of Concept) est une étape de validation expérimentale préliminaire. Elle vise à tester la viabilité technique d'une idée critique avant tout engagement financier lourd.",
  "Contrairement au prototype industriel ou au MVP, le POC ne se destine pas aux utilisateurs finaux mais répond à un doute technologique précis formulé par l'équipe projet.",
  "En cycle itératif, le POC conditionne directement l'arbitrage du comité de pilotage vers la phase d'implémentation opérationnelle.",
].join('\n\n');
const keyPoints = [
  'Un POC teste exclusivement la faisabilité technique, jamais la rentabilité finale ou le design produit.',
  "Toujours isoler une seule hypothèse risquée par prototype pour éviter les biais de diagnostic.",
  "Les retours d'usage concrets du POC conditionnent le feu vert du sprint suivant.",
];
const notions = [
  { term: 'POC', short: 'Validation rapide de viabilité technique' },
  { term: 'MVP', short: 'Produit minimum testant la valeur utilisateur' },
  { term: 'RFID', short: 'Identification par radiofréquence' },
  { term: 'Prototypage', short: 'Itérations de maquettes exploratoires' },
];
db.prepare(
  `INSERT INTO courses (id, group_id, subject_id, title, date, session_label, location, status, analysis_step,
     generated_by, author_id, summary, key_points, analogy_title, analogy_body, notions, reading_time, published_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 4, 'claude', ?, ?, ?, ?, ?, ?, 5, datetime('now'))`,
).run(
  courseId,
  groupId,
  subjects.psm.id,
  'Conception de projet & Démarche POC',
  '2026-09-07',
  'Cours magistral & Travaux dirigés',
  'Amphithéâtre B',
  users.emma.id,
  summary,
  j(keyPoints),
  "L'analogie de l'équipe",
  "Imagine que tu veuilles construire une voiture volante : avant de monter toute la carrosserie en carbone, tu fixes d'abord un moteur sur une maquette en bois pour vérifier que ça décolle. C'est exactement ça, un POC.",
  j(notions),
);

const insPage = db.prepare(
  'INSERT INTO course_pages (id, course_id, position, image_url, label, ocr_text, quality) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
insPage.run(id(), courseId, 0, null, 'Schémas & Flux',
  "I. Validation Idée & Étude Faisabilité. L'objectif n'est pas de tout coder : tester l'hypothèse risquée en premier. Schéma POC -> MVP.", 'Net');
insPage.run(id(), courseId, 1, null, 'Focus POC',
  "Proof of Concept : faisabilité technique, jetabilité totale (code sale), durée 48h à 1 semaine max. Ne teste pas le prix de vente.", 'Net');
insPage.run(id(), courseId, 2, null, 'Définitions',
  "MVP : utilisable par de vrais gens, feedback boucle continue. RFID : identification radiofréquence, cycle de vie du tag. Prototypage : itérations rapides.", 'Net');

// ---------- Flashcards ----------
const insCard = db.prepare(
  'INSERT INTO flashcards (id, course_id, subject_id, group_id, front, back, tag) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const cards = [
  ['POC', 'Preuve de concept : vérifie la faisabilité technique d\'une hypothèse risquée, code jetable, 48h à 1 semaine.', 'Notion clé'],
  ['MVP', 'Produit minimum viable : première version utilisable par de vrais utilisateurs pour mesurer la valeur perçue.', 'Notion clé'],
  ['Différence POC / MVP', 'Le POC valide la technique (interne, jetable). Le MVP valide la valeur utilisateur (public, itératif).', 'Comparaison'],
  ['Hypothèse risquée', 'Le point le plus incertain du projet : on l\'isole et on le teste en premier par un POC dédié.', 'Méthode'],
  ['RFID', 'Identification par radiofréquence : lecture sans contact d\'un tag, utilisée pour le suivi d\'objets.', 'Vocabulaire'],
];
for (const [front, back, tag] of cards) insCard.run(id(), courseId, subjects.psm.id, groupId, front, back, tag);

// ---------- Quiz ----------
const quizId = id();
db.prepare('INSERT INTO quizzes (id, course_id, title) VALUES (?, ?, ?)').run(quizId, courseId, 'Quiz de groupe');
const insQ = db.prepare(
  'INSERT INTO quiz_questions (id, quiz_id, position, question, options, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const quiz = [
  ['Un POC sert avant tout à valider…', ['La rentabilité du produit', 'La faisabilité technique', "L'identité visuelle", 'Le prix de vente optimal'], 1,
    "Le POC répond à un doute technologique précis, pas à une question de marché."],
  ['Quelle est la bonne durée pour un POC ?', ['Plusieurs mois', '48h à une semaine', 'Un semestre', 'Aucune limite'], 1,
    'Le POC doit rester court et jetable pour lever vite une incertitude.'],
  ['Le MVP se distingue du POC parce qu\'il…', ['Est testé par de vrais utilisateurs', 'Utilise du code sale', 'Reste interne à l\'équipe', 'Ne produit aucun feedback'], 0,
    'Le MVP est mis entre les mains d\'utilisateurs réels pour mesurer la valeur.'],
  ['Combien d\'hypothèses risquées teste-t-on par POC ?', ['Toutes en même temps', 'Une seule', 'Au moins trois', 'Aucune'], 1,
    'On isole une hypothèse pour éviter les biais de diagnostic.'],
  ['Que conditionne le résultat du POC ?', ['Le budget marketing', 'Le feu vert du sprint suivant', 'Le choix du logo', 'La date de sortie'], 1,
    "Les retours du POC alimentent l'arbitrage du comité de pilotage."],
];
quiz.forEach(([q, opts, correct, expl], i) => insQ.run(id(), quizId, i, q, j(opts), correct, expl));

// ---------- Capsule pédagogique ----------
db.prepare(
  `INSERT INTO capsules (id, course_id, notion, title, simple_translation, body, analogy_title, analogy_body,
     key_points, challenge_question, challenge_options, challenge_correct_index)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  id(),
  courseId,
  'POC — Proof of Concept',
  'POC — Proof of Concept',
  'Preuve de concept',
  "Un POC permet de vérifier concrètement qu'une idée ou une solution technique peut fonctionner dans le monde réel, avant d'engager du temps, du budget et des ressources dans son développement complet.",
  "L'analogie du café connecté",
  "Tu inventes une tasse chauffante connectée. Au lieu de concevoir le moule céramique parfait et l'application mobile finale, tu branches juste une petite résistance chauffante à un capteur sur une plaque d'essai. Objectif unique : vérifier si le liquide reste chaud.",
  j([
    "Ultra-rapide à concevoir : l'esthétique compte pour 0 %, seule la faisabilité importe.",
    'Éphémère : conçu pour être modifié, adapté ou jeté sans aucun regret.',
    'Ciblé : répond à UNE seule question technique critique.',
  ]),
  "Un POC sert-il à tester le prix de vente optimal d'un produit ?",
  j(['Non, il valide uniquement la technique', "Oui, c'est une étude de marché miniature"]),
  0,
);

// ---------- Calendrier (septembre 2026) ----------
const insEvent = db.prepare(
  `INSERT INTO calendar_events (id, group_id, course_id, subject_label, color_key, title, description, date, start_time, end_time, location, scribe_id, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
insEvent.run(id(), groupId, null, 'Gestion de projet', 'gestion', 'Innovation et modèles agiles',
  "Notes manquantes — qui s'en occupe ?", '2026-09-02', '10:00', '12:00', 'Salle 210', null, 'missing');
insEvent.run(id(), groupId, courseId, 'PSM', 'psm', 'Conception de projet & POC',
  'Architecture logicielle, personas et cadrage des livrables finaux.', '2026-09-07', '09:00', '12:00', 'Amphithéâtre B', users.emma.id, 'validated');
insEvent.run(id(), groupId, null, 'Atelier IoT', 'iot', 'Protocole MQTT & Capteurs ESP32',
  "Câblage des capteurs température et envoi de télémétrie.", '2026-09-07', '14:00', '17:00', 'Lab 304', users.lucas.id, 'scheduled');
insEvent.run(id(), groupId, null, 'IoT', 'iot', 'Introduction aux architectures IoT',
  'Panorama des protocoles basse consommation.', '2026-09-08', '09:00', '11:00', 'Amphi C', users.lucas.id, 'scheduled');
insEvent.run(id(), groupId, null, 'Gestion de projet', 'gestion', 'Revue Scrum & rétrospective',
  'Bilan du sprint et planification.', '2026-09-09', '16:00', '17:30', 'Salle 210', users.lea.id, 'scheduled');
insEvent.run(id(), groupId, null, 'PSM', 'psm', 'Du POC au MVP',
  'Transition des tests de faisabilité vers le livrable.', '2026-09-14', '09:00', '12:00', 'Amphithéâtre B', null, 'scheduled');

// ---------- Chat ----------
const threadDefault = id();
const threadPoc = id();
const threadIot = id();
db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Salon PSM', 'default')").run(threadDefault, groupId);
db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, 'Doutes sur le POC', 'topic')").run(threadPoc, groupId);
db.prepare("INSERT INTO chat_threads (id, group_id, name, kind) VALUES (?, ?, ?, 'topic')").run(threadIot, groupId, "Notes d'IoT");

const insMsg = db.prepare(
  `INSERT INTO chat_messages (id, thread_id, group_id, user_id, kind, body, card_ref, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
);
insMsg.run(id(), threadDefault, groupId, null, 'system',
  `Emma a déposé les notes : « Conception de projet & Démarche POC »`,
  JSON.stringify({ courseId, title: 'Conception de projet & Démarche POC', excerpt: summary.slice(0, 120) }), '-3 hours');
insMsg.run(id(), threadPoc, groupId, users.emma.id, 'user',
  "Salut l'équipe ! J'ai bien vérifié la définition du POC avec le prof : c'est bien uniquement la faisabilité technique.", null, '-140 minutes');
insMsg.run(id(), threadPoc, groupId, users.lucas.id, 'user',
  "Super merci Emma ! Est-ce que quelqu'un a compris la différence exacte avec le MVP ? Je mélange toujours les critères…", null, '-138 minutes');
insMsg.run(id(), threadPoc, groupId, users.thomas.id, 'user',
  "Regarde la métaphore de la voiture volante dans la capsule, ça m'a trop aidé !",
  JSON.stringify({ courseId, title: 'Capsule POC #01', excerpt: "Le POC valide si l'hélice tourne. Le MVP vérifie si les passagers paieraient…" }), '-136 minutes');
insMsg.run(id(), threadPoc, groupId, null, 'bot',
  "Suggestion bienveillante : voulez-vous une mini-carte comparative POC vs MVP tirée de votre cours magistral ?", null, '-135 minutes');

// ---------- Notifications (pour Thomas) ----------
const insNotif = db.prepare(
  `INSERT INTO notifications (id, user_id, group_id, kind, title, body, meta, read, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
);
insNotif.run(id(), users.thomas.id, groupId, 'capsule', 'Tu te souviens du POC ?',
  "« Un POC ne valide pas la rentabilité mais la faisabilité technique. Teste ta mémoire avec ce mini-défi de 15 s ! »",
  JSON.stringify({ courseId }), 0, '-18 minutes');
insNotif.run(id(), users.thomas.id, groupId, 'course', 'Notes de Conception de projet déposées',
  'Emma a partagé la transcription et 5 flashcards pour le cours de ce matin.',
  JSON.stringify({ courseId }), 0, '-1 hours');
insNotif.run(id(), users.thomas.id, groupId, 'question', 'Lucas pose une question',
  "« Est-ce que quelqu'un a compris la différence exacte avec le MVP ? » — dans le salon #Doutes sur le POC.",
  JSON.stringify({ threadId: threadPoc }), 0, '-3 hours');
insNotif.run(id(), users.thomas.id, groupId, 'reminder', "3 flashcards d'IoT arrivent à échéance",
  "Pour maintenir ta mémorisation active sans surcharge, une courte série t'attend.",
  null, 1, '-5 hours');

console.log('✔ Seed terminé.');
console.log('  Tablée : Tablée PSM 2026  ·  code CLAS-8942');
console.log('  Comptes démo (mot de passe : demo1234) :');
for (const u of Object.values(users)) console.log(`   - ${u.email}`);
