# Mettre ClassMemo en ligne

ClassMemo est **une seule application** : le serveur Node sert aussi le front compilé.
Il faut donc juste héberger ce serveur Node quelque part, avec **un disque persistant**
(pour la base SQLite `classmemo.db` et les images uploadées, montés sur `/data`).

Aucune config front à changer : le navigateur parle au serveur sur la même adresse.

## Variables d'environnement

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATA_DIR` | dossier du disque persistant (ex. `/data`) | oui en prod |
| `JWT_SECRET` | secret de session (chaîne aléatoire longue) | oui |
| `ANTHROPIC_API_KEY` | clé Claude par défaut (sinon mode heuristique local, ou clé par utilisateur dans Profil) | non |
| `PORT` | fourni par l'hébergeur en général | non |

---

## Option A — Railway (le plus simple, ~5 $/mois)

1. Créer un compte sur https://railway.app
2. **New Project → Deploy from GitHub repo** (ou *Empty project* puis `railway up` depuis ce dossier avec la CLI).
3. Railway détecte le `Dockerfile` automatiquement.
4. Onglet **Variables** : ajouter `DATA_DIR=/data`, `JWT_SECRET=<colle une longue chaîne aléatoire>`, éventuellement `ANTHROPIC_API_KEY`.
5. Onglet **Settings → Volumes** : *New Volume*, mount path `/data`.
6. **Deploy**. Railway donne une URL `https://classmemo-production.up.railway.app` → à partager.

## Option B — Fly.io (~3 $/mois, sans GitHub)

Prérequis : installer `flyctl` (https://fly.io/docs/flyctl/install) et `fly auth login`.

```bash
cd classmemo
fly launch --no-deploy --copy-config --name classmemo   # garde le fly.toml existant
fly volumes create classmemo_data --size 1 --region cdg
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly secrets set ANTHROPIC_API_KEY=sk-ant-...             # facultatif
fly deploy
```

URL : `https://classmemo.fly.dev`.

## Option C — Render.com (clic, ~7 $/mois pour le disque)

1. Pousser le code sur GitHub (voir plus bas).
2. https://dashboard.render.com → **New + → Blueprint** → sélectionner le dépôt.
3. Render lit `render.yaml` : crée le service web + le disque `/data` + `JWT_SECRET`.
4. Renseigner `ANTHROPIC_API_KEY` si voulu, puis **Apply**.
5. URL : `https://classmemo.onrender.com`.

> Le plan gratuit de Render **ne permet pas de disque persistant** : la base serait
> remise à zéro à chaque redémarrage. Prendre le plan *Starter* payant.

---

## Pousser sur GitHub (nécessaire pour Render / option GitHub de Railway)

```bash
cd classmemo
git init
git add .
git commit -m "ClassMemo — application complète"
git branch -M main
git remote add origin https://github.com/<ton-compte>/classmemo.git
git push -u origin main
```

Le `.gitignore` exclut déjà `node_modules`, la base locale et les uploads.

---

## Données de démo en production (facultatif)

Par défaut la base en ligne est **vide** : le premier utilisateur s'inscrit, crée une
tablée, partage le code `CLAS-XXXX` aux autres. C'est le fonctionnement voulu.

Pour injecter le jeu de démo (efface tout !) une fois déployé :

- Railway : `railway run npm run seed`
- Fly : `fly ssh console -C "node --disable-warning=ExperimentalWarning server/src/seed.js"`
- Render : *Shell* du service → `npm run seed`

---

## Tester l'image en local avec Docker

```bash
docker build -t classmemo .
docker run -p 4000:4000 -e JWT_SECRET=dev -v classmemo_data:/data classmemo
# → http://localhost:4000
```
