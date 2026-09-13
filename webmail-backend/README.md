# Mail Interne — Backend

API qui gère les comptes et les messages du Mail Interne. Fonctionne comme une vraie boîte mail : n'importe qui inscrit peut envoyer un message à n'importe quel autre username, tout est stocké dans une vraie base de données partagée.

⚠️ Comme le bot Discord, **ce backend doit tourner en permanence** — il ne peut pas être sur GitHub Pages.

## 1. Créer la base de données (Supabase — gratuit)

1. Va sur https://supabase.com → crée un compte → "New Project"
2. Donne un nom, choisis un mot de passe de base de données (note-le), choisis une région proche
3. Une fois le projet créé, va dans **SQL Editor** (menu de gauche) → "New query"
4. Colle tout le contenu de `schema.sql` (fourni dans ce dossier) → **Run**. Ça crée les tables `users` et `messages`.
5. Va dans **Project Settings → Database → Connection string → URI**. Copie cette chaîne (elle contient déjà `postgresql://...`) — c'est ta `DATABASE_URL`.

## 2. Configurer le backend

```bash
cd webmail-backend
npm install
cp .env.example .env
```

Ouvre `.env` et remplis :
- `DATABASE_URL` avec la chaîne récupérée sur Supabase (remplace `motdepasse` par le vrai mot de passe que tu as choisi à l'étape 1)
- `JWT_SECRET` avec n'importe quelle longue phrase aléatoire (sert à sécuriser les connexions)

## 3. Tester en local (optionnel)

```bash
npm start
```

## 4. Héberger sur Render

Même méthode que pour le bot Discord :

1. Mets le dossier `webmail-backend/` sur GitHub
2. Sur render.com → "New +" → "Web Service" → connecte le dépôt
3. Root Directory : `webmail-backend` (si dans un sous-dossier d'un dépôt plus large)
4. Build Command : `npm install` — Start Command : `npm start`
5. Dans "Environment", ajoute les variables `DATABASE_URL` et `JWT_SECRET` (les mêmes que dans ton `.env`)
6. Crée le service. Tu obtiens une URL du type `https://ton-mail-backend.onrender.com`

## 5. Relier le site à ce backend

Une fois l'URL obtenue, ouvre `mail-interne.html` et remplace `COLLE_URL_DU_BACKEND_MAIL_ICI` par cette URL (voir le commentaire dans le fichier).

## Comment ça marche pour un joueur

1. Il va sur "Mail Interne" → crée un compte avec un identifiant (ex: `j.dupont`) et un mot de passe
2. Son adresse affichée devient `j.dupont@martiniquerp-gouv`
3. Il peut écrire à n'importe qui en tapant l'identifiant du destinataire (pas besoin du `@martiniquerp-gouv`, juste la partie avant)
4. Les messages reçus et envoyés sont visibles dans son inbox, stockés sur le serveur — donc visibles depuis n'importe quel appareil, tant qu'il se reconnecte avec son identifiant/mot de passe

## Limite du plan gratuit Render à connaître

Comme pour le bot Discord, un service gratuit Render se met en veille après un moment d'inactivité et met quelques secondes à se "réveiller" au premier appel. Rien de grave, juste un petit délai possible sur la première requête après une pause.
