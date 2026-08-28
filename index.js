/* =====================================================================
   BOT DISCORD — Permis de détention d'arme
   -----------------------------------------------------------------
   Ce bot fait 2 choses :
   1. Reçoit les demandes du formulaire du site (via une petite API HTTP)
      et poste un message avec boutons "Accepter" / "Refuser" dans un
      salon Discord de ta préfecture.
   2. Quand un modérateur clique sur un bouton, le bot envoie un message
      privé (DM) à la personne concernée pour l'informer de la décision.

   Ce fichier doit tourner en PERMANENCE (ce n'est pas un site statique).
   Il ne peut pas être hébergé sur GitHub Pages. Voir README.md pour les
   options d'hébergement gratuites/simples.
===================================================================== */

const express = require('express');
const cors = require('cors');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
require('dotenv').config();

// ---- Configuration (voir .env) ----
const BOT_TOKEN = process.env.BOT_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !REVIEW_CHANNEL_ID) {
  console.error("Erreur : BOT_TOKEN ou REVIEW_CHANNEL_ID manquant dans le fichier .env");
  process.exit(1);
}

// ---- Client Discord ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Stocke temporairement les infos de chaque demande (en mémoire).
// Pour un vrai usage prolongé, remplace ça par une vraie base de données.
const demandesEnCours = new Map();

client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
});

// ---- Gestion des clics sur les boutons Accepter / Refuser ----
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, demandeId] = interaction.customId.split(':'); // ex: "accepter:abc123"
  const demande = demandesEnCours.get(demandeId);

  if (!demande) {
    await interaction.reply({ content: "Cette demande n'est plus disponible (redémarrage du bot ?).", ephemeral: true });
    return;
  }

  const estAcceptee = action === 'accepter';
  const decisionTexte = estAcceptee ? "✅ ACCEPTÉE" : "❌ REFUSÉE";

  // Met à jour le message dans le salon (retire les boutons, affiche la décision)
  const embedMisAJour = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(estAcceptee ? 0x18753c : 0xce0500)
    .addFields({ name: "Décision", value: `${decisionTexte} — par ${interaction.user.tag}` });

  await interaction.update({ embeds: [embedMisAJour], components: [] });

  // Essaie d'envoyer un message privé à la personne concernée
  if (!demande.discordUserId) {
    await interaction.followUp({
      content: "⚠️ Aucun ID Discord n'a été renseigné dans cette demande (ancien formulaire ?) — impossible d'envoyer le DM automatiquement.",
      ephemeral: true
    });
    demandesEnCours.delete(demandeId);
    return;
  }

  try {
    const user = await client.users.fetch(demande.discordUserId);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Réponse à votre demande — Permis de détention d'arme")
          .setDescription(
            estAcceptee
              ? "Votre demande de permis de détention d'arme a été **acceptée**. Vous serez recontacté(e) pour la suite de la procédure."
              : "Votre demande de permis de détention d'arme a été **refusée**. Vous pouvez contacter la préfecture pour plus d'informations."
          )
          .setColor(estAcceptee ? 0x18753c : 0xce0500)
      ]
    });
  } catch (err) {
    // Le DM peut échouer si le bot n'a pas de serveur en commun avec la personne,
    // si ses messages privés sont fermés, ou si l'ID Discord saisi est invalide/inexistant.
    await interaction.followUp({
      content: "⚠️ Impossible d'envoyer un message privé à cette personne (DMs fermés, bot pas sur un serveur commun, ou ID Discord invalide).",
      ephemeral: true
    });
  }

  demandesEnCours.delete(demandeId);
});

client.login(BOT_TOKEN);

// ---- API HTTP qui reçoit les demandes envoyées par le formulaire du site ----
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/permis-arme', async (req, res) => {
  try {
    const donnees = req.body;

    // Le formulaire doit envoyer un champ "discord_pseudo" ET idéalement
    // un champ "discord_id" (l'identifiant numérique Discord, plus fiable
    // qu'un pseudo pour retrouver la personne). Voir note dans README.md.
    const demandeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    demandesEnCours.set(demandeId, {
      discordUserId: donnees.discord_id || null,
      pseudo: donnees.discord_pseudo || "Non précisé",
    });

    const embed = new EmbedBuilder()
      .setTitle("Demande — Permis de détention d'arme")
      .setColor(0x1212b3)
      .addFields(
        { name: "Vous êtes", value: donnees.profil || "—", inline: true },
        { name: "Catégorie d'arme", value: donnees.categorie || "—", inline: true },
        { name: "Date de naissance", value: donnees.date_naissance || "—", inline: true },
        { name: "Nom", value: donnees.nom || "—", inline: true },
        { name: "Prénom", value: donnees.prenom || "—", inline: true },
        { name: "Pseudo Discord", value: donnees.discord_pseudo || "—", inline: true },
        { name: "ID Discord", value: donnees.discord_id || "—", inline: true },
        { name: "Adresse", value: `${donnees.adresse || "—"} ${donnees.code_postal || ""} ${donnees.ville || ""}`.trim() },
        { name: "Sujet", value: donnees.sujet || "—" },
        { name: "Message", value: donnees.message || "—" }
      )
      .setTimestamp();

    const boutons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accepter:${demandeId}`).setLabel("Accepter").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`refuser:${demandeId}`).setLabel("Refuser").setStyle(ButtonStyle.Danger)
    );

    const salon = await client.channels.fetch(REVIEW_CHANNEL_ID);
    await salon.send({ embeds: [embed], components: [boutons] });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.listen(PORT, () => {
  console.log(`API en écoute sur le port ${PORT}`);
});
