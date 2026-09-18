// Dated events supplement the historical totals; never redistribute undated history.
const RETENTION = 32 * 86400000;
class Ledger {
    constructor(data = {}, now = Date.now()) { this.data = { since: now, members: {}, ...data }; this.live = new Map(); }
    member(id, now) { return this.data.members[id] ||= { messages: 0, voiceMs: 0, times: [], spans: [], firstObservedAt: now, observedAt: now, grade: null, gradeSince: null, baseMessages: 0, baseVoiceMs: 0 }; }
    checkpoint(id, now) { const start = this.live.get(id); if (start == null) return; const m = this.member(id, now); if (now > start) { m.voiceMs += now - start; m.spans.push([start, now]); } this.live.set(id, now); }
    sync(id, grade, now) { this.checkpoint(id, now); const m = this.member(id, now); if (m.grade !== grade) { const initial = m.initialized !== true; m.grade = grade; m.gradeSince = initial ? null : now; m.observedAt = now; m.baseMessages = m.messages; m.baseVoiceMs = m.voiceMs; } m.initialized = true; return m; }
    message(id, grade, now) { const m = this.sync(id, grade, now); m.messages++; m.times.push(now); }
    voice(id, grade, present, now) { this.sync(id, grade, now); if (present) { if (!this.live.has(id)) this.live.set(id, now); } else this.live.delete(id); }
    totals(id, since = 0, now = Date.now()) {
        const m = this.data.members[id]; if (!m) return { messages: 0, voiceMs: 0 };
        let voiceMs = since ? m.spans.reduce((sum, [a,b]) => sum + Math.max(0, Math.min(b, now) - Math.max(a, since)), 0) : m.voiceMs;
        const start = this.live.get(id); if (start != null) voiceMs += Math.max(0, now - Math.max(start, since));
        return { messages: since ? m.times.filter(t => t >= since && t <= now).length : m.messages, voiceMs };
    }
    gradeTotals(id, now = Date.now()) { const m = this.data.members[id]; if (!m) return null; const total = this.totals(id, 0, now); return { messages: total.messages - m.baseMessages, voiceMs: total.voiceMs - m.baseVoiceMs, since: m.gradeSince || m.observedAt, partial: !m.gradeSince }; }
    flush(now = Date.now()) { for (const id of this.live.keys()) this.checkpoint(id, now); for (const m of Object.values(this.data.members)) { m.times = m.times.filter(t => t >= now - RETENTION); m.spans = m.spans.filter(s => s[1] >= now - RETENTION); } return this.data; }
}
module.exports = { Ledger };
