// Compatibility facade: logs continue through the single central router.
async function sendLog(guild, payload = {}) {
  const logger = guild?.client?.logs;
  if (!logger?.emit) return false;
  return logger.emit(guild, {
    category: 'moderation', type: 'legacy_log', title: payload.title || 'Journal',
    description: payload.description, actor: payload.executant?.id,
    target: payload.cible?.id, fields: payload.fields,
    source: 'Module historique redirigé vers le journal central'
  });
}
module.exports = { sendLog };
