const { EmbedBuilder, MessageFlags } = require("discord.js");
const { COLORS } = require("../config/soulSociety");
const QUESTION_BUTTON_ID = "interview_questions";
function payload() {
    return {
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
        embeds: [new EmbedBuilder().setColor(COLORS.primary)
            .setTitle("📋 Guide de l’entretien • La Soul Society")
            .setDescription(`**① PRÉSENTATION / ENTRETIEN**
1. Présente-toi rapidement.
2. Pourquoi cette famille plutôt qu’une autre ?
3. Comment as-tu connu cette famille ?
4. Quel est ton objectif au sein de cette famille ?
5. Es-tu sûr de pouvoir être actif au sein de la famille ?

**② PHASE DE TEST**
• Ajoute **T SOUL** à la fin de ton pseudo pendant la phase de test.
• Aucune bannière n’est autorisée pendant cette période.
• La phase de test dure **1 à 2 semaines**, selon ton activité.
• Une forte activité sur le serveur ou en jeu peut réduire sa durée.
• Les sanctions sont plus sévères pendant le test : **aucune faute de comportement n’est tolérée**.
• Tu dois être présent sur les serveurs School principaux : **School Famille & School**.

**③ SYSTÈME DE SANCTIONS**
Chaque infraction entraîne une sanction selon sa gravité :
• **1er, 2e ou 3e avertissement** : parfois simplement oral, selon la situation.
• **Sanction sérieuse** : rétrogradation d’un grade ou retour direct au rang de Membre test.
• **Mesure grave** : retrait de tous les grades et passage en Visiteur ou Ancien membre. Il faut attendre **au moins 2 semaines** avant de postuler à nouveau, et seulement si la famille estime ton retour possible.

**④ SALONS & OBLIGATIONS**
■ **Test d’activité**
Un bot publie un message dans le salon dédié. Tu as **24 h pour réagir**. Passé ce délai, tu seras considéré comme inactif et convoqué.

■ **Sanction en jeu**
Tout ban, jail ou warn reçu en jeu doit être signalé à la famille dans le salon prévu. Si la famille découvre la sanction avant que tu ne l’aies déclarée, des sanctions seront prises.

■ **Pseudo**
Respecte le modèle indiqué en remplaçant les informations par les tiennes.

■ **Absence**
Toute absence de plus de **24 h** nécessite un billet d’absence. Si tu ne peux pas assister à une réunion, tu dois également déclarer ton absence ; sans cela, tu recevras un blâme.

■ **Auto-rôles**
Coche tous les emojis du salon d’auto-rôles pour recevoir toutes les notifications.

■ **Tag du serveur**
Le tag du serveur est **obligatoire** : il doit rester activé en permanence.`)
            .setFooter({ text: "La Soul Society • Questions et règles à présenter au candidat" })]
    };
}
module.exports = { payload, QUESTION_BUTTON_ID };
