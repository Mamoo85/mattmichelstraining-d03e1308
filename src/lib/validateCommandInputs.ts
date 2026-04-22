/**
 * Client-side validation for AdminCommandBar inputs.
 * Blocks malformed prompts, recipients, counts, and queue payloads
 * BEFORE they reach the admin-command edge function.
 *
 * Mirror of the server-side guards — fails fast with a user-readable reason.
 */

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/; // E.164-ish, allow with/without +

const PROMPT_MIN = 4;
const PROMPT_MAX = 1000;
const COUNT_MAX = 100;          // hard cap on "find N" / "draft N"
const BODY_MAX = 5000;
const SUBJECT_MAX = 200;
const QUEUE_MAX = 50;           // max drafts queued in one call
const TONE_ALLOWED = new Set(["direct", "warm", "urgent", "curious"]);
const CHANNEL_ALLOWED = new Set(["email", "sms"]);
const PRODUCT_ALLOWED = new Set([
  "demand_radar",
  "talent_radar",
  "contractor_leads",
  "fielddesk",
  "missed_call_catch",
]);

/** Pull every "<digits>" that looks like a count target out of the prompt. */
function extractCounts(prompt: string): number[] {
  const matches = prompt.match(/\b\d{1,5}\b/g);
  if (!matches) return [];
  return matches.map((m) => parseInt(m, 10)).filter((n) => Number.isFinite(n));
}

export function validatePrompt(promptRaw: string): ValidationResult {
  const prompt = (promptRaw || "").trim();
  if (prompt.length < PROMPT_MIN) {
    return { ok: false, reason: `Prompt is too short (min ${PROMPT_MIN} chars).` };
  }
  if (prompt.length > PROMPT_MAX) {
    return { ok: false, reason: `Prompt is too long (max ${PROMPT_MAX} chars).` };
  }
  // Block obvious destructive intent — server enforces too, but fail fast here.
  if (/\b(drop|truncate|delete\s+from|alter\s+table)\b/i.test(prompt)) {
    return { ok: false, reason: "Prompt contains destructive SQL keywords." };
  }
  // Cap any numeric "find N" / "draft N" target.
  for (const n of extractCounts(prompt)) {
    if (n > COUNT_MAX) {
      return {
        ok: false,
        reason: `Count ${n} exceeds max of ${COUNT_MAX}. Lower the number and re-run.`,
      };
    }
  }
  return { ok: true };
}

export function validateRecipient(r: {
  to_email?: string;
  to_phone?: string;
  to_name?: string;
}): ValidationResult {
  if (!r.to_email && !r.to_phone) {
    return { ok: false, reason: "Recipient needs either an email or a phone." };
  }
  if (r.to_email && !EMAIL_RE.test(r.to_email.trim())) {
    return { ok: false, reason: `Invalid email: ${r.to_email}` };
  }
  if (r.to_phone && !PHONE_RE.test(r.to_phone.replace(/[\s\-()]/g, ""))) {
    return { ok: false, reason: `Invalid phone: ${r.to_phone}` };
  }
  if (r.to_name && r.to_name.length > 200) {
    return { ok: false, reason: "Recipient name too long (max 200)." };
  }
  return { ok: true };
}

export function validateRegenerateParams(params: {
  product?: string;
  tone?: string;
  channel?: string;
  angle?: string | null;
}): ValidationResult {
  if (params.product && !PRODUCT_ALLOWED.has(params.product)) {
    return { ok: false, reason: `Unknown product: ${params.product}` };
  }
  if (params.tone && !TONE_ALLOWED.has(params.tone)) {
    return { ok: false, reason: `Tone must be one of: ${[...TONE_ALLOWED].join(", ")}` };
  }
  if (params.channel && !CHANNEL_ALLOWED.has(params.channel)) {
    return { ok: false, reason: `Channel must be email or sms.` };
  }
  if (params.angle && params.angle.length > 300) {
    return { ok: false, reason: "Angle too long (max 300 chars)." };
  }
  return { ok: true };
}

export function validateQueuePayload(
  drafts: Array<{ to_email?: string; to_phone?: string; subject?: string; body?: string }>,
): ValidationResult {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return { ok: false, reason: "Nothing to queue." };
  }
  if (drafts.length > QUEUE_MAX) {
    return { ok: false, reason: `Too many drafts (${drafts.length}). Max ${QUEUE_MAX} per queue.` };
  }
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (!d.body || !d.body.trim()) {
      return { ok: false, reason: `Draft #${i + 1} has empty body.` };
    }
    if (d.body.length > BODY_MAX) {
      return { ok: false, reason: `Draft #${i + 1} body too long (max ${BODY_MAX}).` };
    }
    if (d.subject && d.subject.length > SUBJECT_MAX) {
      return { ok: false, reason: `Draft #${i + 1} subject too long (max ${SUBJECT_MAX}).` };
    }
    const recipientCheck = validateRecipient({ to_email: d.to_email, to_phone: d.to_phone });
    if (!recipientCheck.ok) {
      return { ok: false, reason: `Draft #${i + 1}: ${recipientCheck.reason}` };
    }
  }
  return { ok: true };
}
