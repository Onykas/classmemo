# ClassMemo

Compagnon de révision collaborative pour petites tablées d'étude (3–4 étudiant·es).
Basé sur le design system **Serene Study Guild** (export Stitch).

Chaîne complète et fonctionnelle :

1. **Dépôt des notes** — photo des feuillets manuscrits + OCR français dans le navigateur (`tesseract.js`).
2. **Analyse IA** — génération d'un résumé, d'une analogie, de flashcards, d'un quiz QCM et d'une capsule pédagogique via l'API Claude (repli sur un générateur heuristique local si aucune clé n'est fournie).
3. **Validation & publication** — relecture éditable puis partage au groupe (notification + message dans le salon).
4. **Révision** — flashcards en répétition espacée **SM-2**, quiz noté.
5. **Vie de groupe** — présence temps réel, chat multi-fils (Socket.IO), calendrier partagé avec attribution du scribe, écran « Qu'est-ce que j'ai raté », notifications.

## Stack

| Côté | Techno |
|---|---|
| Front | React 18 + Vite + Tailwind + React Router + socket.io-client + tesseract.js |
| API | Node + Express + better-sqlite3 + JWT + Socket.IO + `@anthropic-ai/sdk` |
| Données | SQLite (`server/classmemo.db`, créé au 1er lancement) |

## Prérequis

- **Node.js ≥ 20** (le serveur utilise `node --watch`).
- Connexion internet au 1er usage de l'OCR (téléchargement du modèle `fra` tesseract) et pour les appels API Claude.

## Installation

```bash
cd classmemo
npm install            # installe la racine + les workspaces server/ et web/
npm run seed           # crée la base + le jeu de démo (tablée PSM, 4 comptes)
npm run dev            # lance l'API (:4000) et le front (:5173) ensemble
```

Puis ouvrir **http://localhost:5173**.

> **Mettre en ligne pour de vrai** (URL à partager avec des amis) : voir **[DEPLOY.md](DEPLOY.md)**.
> Le serveur sert aussi le front compilé : c'est **un seul service** à héberger (Railway / Fly.io / Render),
> avec un petit disque persistant pour la base et les images.

### Comptes de démonstration

Mot de passe commun : `demo1234`

| E-mail | Rôle |
|---|---|
| `thomas@classmemo.app` | Scribe |
| `emma@classmemo.app` | Valideuse |
| `lucas@classmemo.app` | IoT |
| `lea@classmemo.app` | UX |

Tablée : **PSM 2026** — code d'invitation `CLAS-8942`.

## Clé API Claude

Optionnelle. Deux façons de la fournir :

- **Par utilisateur** : Profil → Réglages pédagogiques → *Clé API Anthropic* (recommandé, stockée par compte).
- **Globale** : copier `server/.env.example` en `server/.env` et renseigner `ANTHROPIC_API_KEY`.

Sans clé, l'analyse bascule automatiquement sur un générateur heuristique local (résumé, notions, flashcards et quiz extraits du texte OCR) : l'app reste 100 % fonctionnelle hors ligne.

Le modèle utilisé se choisit dans le profil (`claude-opus-5` par défaut, `claude-sonnet-5`, `claude-haiku-4-5`).

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | API + front en parallèle |
| `npm run dev:server` / `npm run dev:web` | l'un ou l'autre |
| `npm run seed` | réinitialise la base avec le jeu de démo |
| `npm run build` | build de production du front (`web/dist`) |
| `npm start` | API seule (mode production) |

## Structure

```
server/src
  index.js          entrée Express + Socket.IO
  db.js             schéma SQLite
  auth.js           JWT + bcrypt
  anthropic.js      génération IA + repli heuristique
  sm2.js            répétition espacée
  realtime.js       présence + diffusion temps réel
  routes/           auth, groups, subjects, courses, review, quiz,
                    calendar, chat, notifications, me, home
  seed.js           jeu de démo
web/src
  auth.jsx          session + socket
  api.js            fetch + JWT
  components/        AppShell, BottomNav, ui (design system)
  screens/          15 écrans (Accueil, Matières, Détail cours, Notes
                    manuscrites, Ajout de notes, Analyse, Validation,
                    Révision, Capsule, Fil conducteur, Rattrapage,
                    Calendrier, Entraide, Notifications, Profil)
```

## Remarques

- L'OCR tourne entièrement dans le navigateur ; aucune image n'est envoyée à un tiers.
- Les uploads d'images sont stockés localement dans `server/uploads/`.
- `better-sqlite3` est un module natif : si l'installation échoue sous Windows, installer les *Build Tools* (`npm i -g windows-build-tools`) ou utiliser une version LTS de Node.
