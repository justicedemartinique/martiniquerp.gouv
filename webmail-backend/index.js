/* =====================================================================
   API — MAIL INTERNE (@martiniquerp-gouv)
   -----------------------------------------------------------------
   Ce serveur gère les comptes (username + mot de passe) et les
   messages entre eux, stockés dans une vraie base de données
   (PostgreSQL, hébergée gratuitement sur Supabase — voir README.md).

   Ce fichier doit tourner en PERMANENCE (comme le bot Discord).
   Il ne peut pas être hébergé sur GitHub Pages.
===================================================================== */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET || !DATABASE_URL) {
  console.error("Erreur : JWT_SECRET ou DATABASE_URL manquant dans le fichier .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // nécessaire pour Supabase
});

const app = express();
app.use(cors());
app.use(express.json());

// ---- Utilitaires ----

function nettoyerUsername(username) {
  // minuscules, chiffres, points, tirets uniquement — pas de @ (on l'ajoute nous-mêmes)
  return (username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function genererToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

// Middleware : vérifie le token dans l'en-tête Authorization: Bearer xxx
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Non connecté." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Session invalide, reconnecte-toi." });
  }
}

// ---- Inscription ----
app.post('/api/register', async (req, res) => {
  const username = nettoyerUsername(req.body.username);
  const password = req.body.password || '';

  if (username.length < 3) {
    return res.status(400).json({ error: "Identifiant trop court (3 caractères minimum)." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Mot de passe trop court (4 caractères minimum)." });
  }

  try {
    const existant = await pool.query('select id from users where username = $1', [username]);
    if (existant.rows.length > 0) {
      return res.status(409).json({ error: "Cet identifiant est déjà pris." });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'insert into users (username, password_hash) values ($1, $2) returning id, username',
      [username, hash]
    );
    const user = result.rows[0];
    res.status(201).json({ token: genererToken(user), username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ---- Connexion ----
app.post('/api/login', async (req, res) => {
  const username = nettoyerUsername(req.body.username);
  const password = req.body.password || '';

  try {
    const result = await pool.query('select id, username, password_hash from users where username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    const valide = await bcrypt.compare(password, user.password_hash);
    if (!valide) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    res.json({ token: genererToken(user), username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ---- Boîte de réception ----
app.get('/api/inbox', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select m.id, m.subject, m.body, m.is_read, m.created_at, u.username as from_username
       from messages m
       join users u on u.id = m.sender_id
       where m.recipient_id = $1
       order by m.created_at desc`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ---- Messages envoyés ----
app.get('/api/sent', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select m.id, m.subject, m.body, m.created_at, u.username as to_username
       from messages m
       join users u on u.id = m.recipient_id
       where m.sender_id = $1
       order by m.created_at desc`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ---- Détail d'un message (marque comme lu si on est le destinataire) ----
app.get('/api/message/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select m.id, m.subject, m.body, m.is_read, m.created_at,
              su.username as from_username, ru.username as to_username,
              m.sender_id, m.recipient_id
       from messages m
       join users su on su.id = m.sender_id
       join users ru on ru.id = m.recipient_id
       where m.id = $1`,
      [req.params.id]
    );
    const message = result.rows[0];
    if (!message) return res.status(404).json({ error: "Message introuvable." });

    if (message.sender_id !== req.user.id && message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: "Ce message ne t'appartient pas." });
    }

    if (message.recipient_id === req.user.id && !message.is_read) {
      await pool.query('update messages set is_read = true where id = $1', [message.id]);
    }

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ---- Envoyer un message ----
app.post('/api/send', auth, async (req, res) => {
  const destinataire = nettoyerUsername(req.body.to);
  const subject = (req.body.subject || '(Sans objet)').trim();
  const body = (req.body.body || '').trim();

  if (!destinataire) return res.status(400).json({ error: "Destinataire manquant." });
  if (!body) return res.status(400).json({ error: "Le message est vide." });

  try {
    const result = await pool.query('select id from users where username = $1', [destinataire]);
    const recipient = result.rows[0];
    if (!recipient) {
      return res.status(404).json({ error: `Aucun compte trouvé pour "${destinataire}@martiniquerp-gouv".` });
    }

    await pool.query(
      'insert into messages (sender_id, recipient_id, subject, body) values ($1, $2, $3, $4)',
      [req.user.id, recipient.id, subject, body]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.listen(PORT, () => {
  console.log(`API Mail Interne en écoute sur le port ${PORT}`);
});
