// /testanim : teste une animation en direct (MP, salons, déplacements, confirmation, panneau). Voir systems/qgAnimationLive.js.
const live = require("../systems/qgAnimationLive");
module.exports = { data: live.data, execute: interaction => live.test(interaction) };
