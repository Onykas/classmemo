# Mettre ClassMemo en ligne — gratuitement

ClassMemo = **une seule application** (le serveur Node sert aussi le site).
Hébergement 100 % gratuit, sans carte bancaire :

- **Base de données** : PostgreSQL gratuit chez **Neon** (`neon.tech`)
- **Serveur** : plan **gratuit** de **Render** (`render.com`)

En local, aucune base à installer : sans `DATABASE_URL`, l'app utilise PGlite
(PostgreSQL embarqué, fichier `server/pgdata/`).

---

## Étape 1 — Envoyer le code sur GitHub

Tu es déjà connectée (`gh auth status` → compte `Onykas`). Dans un terminal :

```bash
cd C:\Users\admin\classmemo
gh repo create classmemo --private --source=. --remote=origin --push
```

*(ou : crée un dépôt vide `classmemo` sur github.com, puis
`git remote add origin https://github.com/Onykas/classmemo.git && git push -u origin main`)*

## Étape 2 — Base de données Neon (gratuit, sans carte)

1. Va sur **https://neon.tech** → *Sign up* (avec GitHub, c'est instantané).
2. *Create project* → nom `classmemo`, région **Europe (Frankfurt)**.
3. Sur le tableau de bord, bloc **Connection string** → copie l'URL qui
   commence par `postgresql://…` (garde `?sslmode=require` à la fin).
   Garde-la de côté pour l'étape 3.

## Étape 3 — Serveur Render (plan gratuit)

1. Va sur **https://render.com** → *Sign up* avec GitHub.
2. **New + → Blueprint** → choisis le dépôt `classmemo`.
3. Render lit `render.yaml` et propose le service `classmemo` (plan **Free**).
4. Il demande les valeurs `sync:false` :
   - **`DATABASE_URL`** → colle l'URL Neon de l'étape 2
   - **`ANTHROPIC_API_KEY`** → ta clé Claude si tu en as une, sinon laisse vide
   - (`JWT_SECRET` est généré automatiquement)
5. **Apply**. Premier build ≈ 3–4 min.
6. URL finale : `https://classmemo.onrender.com` (ou proche) → **c'est le lien à partager**.

> Plan gratuit Render : le serveur s'endort après 15 min sans visite et met
> ~30–50 s à se réveiller à la visite suivante. Les données, elles, restent
> chez Neon en permanence.

## Étape 4 — Tes amis

Ils ouvrent le lien sur leur téléphone → menu du navigateur →
**« Ajouter à l'écran d'accueil »**. L'app s'installe avec son icône.
Le premier crée un compte + une **tablée**, et partage le code `CLAS-XXXX`
aux autres pour qu'ils rejoignent.

---

## Données de démonstration (facultatif)

La base en ligne démarre **vide**. Pour y injecter le jeu de démo (⚠️ efface
tout ce qui existe) : dans Render, onglet **Shell** du service →

```bash
npm run seed
```

Comptes créés : `thomas@classmemo.app` … / mot de passe `demo1234` /
tablée `CLAS-8942`.

---

## Alternatives (payantes, toujours allumées)

- **Railway** (~5 $/mois) : *Deploy from GitHub repo*, détecte le `Dockerfile`,
  ajoute `DATABASE_URL` (ou une base Postgres Railway), pas de mise en veille.
- **Fly.io** (~3 $/mois) : `fly launch` + `fly deploy` depuis ce dossier
  (`fly.toml` fourni), `fly secrets set DATABASE_URL=… JWT_SECRET=…`.

## Tester l'image Docker en local

```bash
docker build -t classmemo .
docker run -p 4000:4000 -e JWT_SECRET=dev -e DATABASE_URL="postgresql://…" classmemo
# → http://localhost:4000
```
