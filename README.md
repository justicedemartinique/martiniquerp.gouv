# Bot Discord — Permis de détention d'arme

Ce bot fait le lien entre le formulaire du site et Discord :
- il poste les nouvelles demandes dans un salon avec des boutons **Accepter / Refuser**
- quand un modérateur clique sur un bouton, il envoie automatiquement un **message privé** à la personne concernée

⚠️ **Ce bot doit tourner en permanence** (contrairement au site, qui est juste des fichiers statiques sur GitHub Pages). Il te faut un endroit qui exécute du code Node.js en continu.

## 1. Créer l'application Discord (le bot)

1. Va sur https://discord.com/developers/applications → "New Application"
2. Donne-lui un nom (ex: "Préfecture RP Bot")
3. Dans l'onglet "Bot" → "Reset Token" → copie le token (tu en auras besoin dans `.env`)
4. Toujours dans "Bot" → active **"Message Content Intent"** si tu comptes l'étendre plus tard (pas obligatoire pour la version actuelle)
5. Dans l'onglet "OAuth2" → "URL Generator" :
   - Scopes : coche `bot`
   - Bot Permissions : coche `Send Messages`, `Embed Links`, `Read Message History`
   - Copie l'URL générée en bas, ouvre-la dans ton navigateur, et invite le bot sur ton serveur Discord

## 2. Récupérer l'ID du salon

Dans Discord : Paramètres utilisateur → Avancés → active le **Mode développeur**.
Puis clic droit sur le salon où les demandes doivent apparaître → **Copier l'identifiant**.

## 3. Configurer le bot

```bash
cd discord-bot
npm install
cp .env.example .env
```

Ouvre `.env` et remplis `BOT_TOKEN` et `REVIEW_CHANNEL_ID` avec les valeurs récupérées plus haut.

## 4. Tester en local (optionnel)

```bash
npm start
```

Le bot se connecte à Discord, et une petite API démarre sur `http://localhost:3000`.

## 5. Héberger le bot en permanence

GitHub Pages ne peut pas faire tourner ce bot (il ne fait que servir des fichiers HTML). Il te faut un hébergeur qui exécute du Node.js en continu. Options simples et gratuites/pas chères pour un petit bot RP :

- **Railway** (railway.app) — gratuit avec quota, très simple : connecte ton dépôt GitHub, il détecte le `package.json` automatiquement
- **Render** (render.com) — offre gratuite "Web Service", même principe
- Un **VPS** si tu en as déjà un (OVH, Contabo...) avec `pm2` pour garder le process actif

Sur ces plateformes, tu dois définir les variables d'environnement (`BOT_TOKEN`, `REVIEW_CHANNEL_ID`) dans leur interface (pas besoin d'uploader le `.env`).

## 6. Relier le formulaire du site au bot

Une fois le bot hébergé, tu obtiens une URL publique (ex: `https://ton-bot.up.railway.app`).

Dans `demarches-permis-arme.html`, il faut ajouter l'envoi vers cette API en plus (ou à la place) du webhook. Dis-moi une fois ton bot hébergé et je mettrai à jour le formulaire pour qu'il envoie les données à `https://ton-bot.up.railway.app/api/permis-arme` — c'est cette route qui déclenche les boutons Accepter/Refuser.

## Important : lier le pseudo Discord à un vrai identifiant

Pour que le bot puisse envoyer un DM, il a besoin de l'**ID Discord numérique** de la personne (un pseudo seul ne suffit pas à retrouver quelqu'un de façon fiable). Le formulaire actuel ne demande qu'un pseudo. Deux options :

- Ajouter un champ "ID Discord" dans le formulaire (moins pratique pour l'utilisateur, mais fiable) — dis-moi si tu veux que je l'ajoute
- Utiliser **Discord OAuth2** pour que la personne se connecte avec son compte Discord directement depuis le formulaire (plus fluide mais plus complexe à mettre en place)
