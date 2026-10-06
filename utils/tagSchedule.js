const HOUR = 3600000;
function nextAction(warning, now) {
    if (!warning.firstWarningSent) return 'first';
    const elapsed = now - warning.startedAt;
    if (elapsed >= 72 * HOUR) return warning.derankRecorded ? null : 'derank';
    if (elapsed >= 48 * HOUR) return warning.secondSanctionApplied ? null : 'warn2';
    if (elapsed >= 24 * HOUR) return warning.sanctionApplied ? null : 'warn1';
    if (elapsed >= 12 * HOUR && !warning.halfReminderSent) return 'half';
    return null;
}
module.exports = { nextAction };
