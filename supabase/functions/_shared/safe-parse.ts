// Sprint E — Waterfall Hardening: strict-typed defensive parsers.
//
// Why hand-rolled instead of zod?
//   - Zero new runtime deps (no zod bundle on every cold start of 50+ enrichment
//     functions).
//   - Per DWA Defensive Programming Protocol: every parse is explicit, every
//     failure mode is named, no swallowed errors, no blind index access.
//
// Every parser returns a discriminated `ParseResult` so callers can branch:
//   if (!parsed.ok) { trace.push({ stage, ok: false, reason: parsed.reason }) }
//
// Never throws. Never blocks. If a provider returns garbage, we return a
// well-typed `{ ok: false, reason: "…" }` instead of letting `data?.x?.y[0]`
// short-circuit through and silently skip the stage.

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

// ── Primitive guards ────────────────────────────────────────────────────────
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asObject(v: unknown): Record<string, unknown> {
  return isObject(v) ? v : {};
}

// ── safeJson: never throws on a malformed body ─────────────────────────────
// Some providers return HTML error pages with 200, partial JSON on 5xx, or
// an empty body. We treat all of those as a parse miss instead of an exception.
export async function safeJson(res: Response): Promise<ParseResult<unknown>> {
  try {
    const text = await res.text();
    if (!text || text.length === 0) return { ok: false, reason: "empty_body" };
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, reason: `non_json:${text.slice(0, 80)}` };
    }
  } catch (e) {
    return { ok: false, reason: `read_failed:${(e as Error).message}` };
  }
}

// ── Email contract ──────────────────────────────────────────────────────────
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export interface ParsedEmail {
  email: string;
  confidence?: number;
  first?: string;
  last?: string;
  position?: string;
}

export function asEmail(v: unknown): string | null {
  const s = asNonEmptyString(v);
  if (!s) return null;
  if (s.length > 254) return null; // RFC 5321
  return EMAIL_RX.test(s) ? s.toLowerCase() : null;
}

// ── Provider-specific parsers (no `any`, no blind chains) ──────────────────

/** Hunter `domain-search` → array of email entries, defensively parsed. */
export function parseHunterDomainSearch(raw: unknown): ParseResult<ParsedEmail[]> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const data = asObject(raw.data);
  const emails = asArray(data.emails);
  if (emails.length === 0) return { ok: false, reason: "no_emails" };
  const out: ParsedEmail[] = [];
  for (const item of emails) {
    if (!isObject(item)) continue;
    const email = asEmail(item.value);
    if (!email) continue;
    out.push({
      email,
      confidence: asFiniteNumber(item.confidence) ?? undefined,
      first: asNonEmptyString(item.first_name) ?? undefined,
      last: asNonEmptyString(item.last_name) ?? undefined,
      position: asNonEmptyString(item.position) ?? undefined,
    });
  }
  if (out.length === 0) return { ok: false, reason: "no_valid_emails" };
  return { ok: true, value: out };
}

/** Snov `domain-emails-with-info` → array under `data.emails` OR `emails`. */
export function parseSnovDomainSearch(raw: unknown): ParseResult<ParsedEmail[]> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  // Snov v2 wraps in {data:{emails:[…]}}, v1 just has emails on top level.
  const data = isObject(raw.data) ? raw.data : raw;
  const emails = asArray(data.emails);
  if (emails.length === 0) return { ok: false, reason: "no_emails" };
  const out: ParsedEmail[] = [];
  for (const item of emails) {
    if (!isObject(item)) continue;
    const email = asEmail(item.email);
    if (!email) continue;
    const smtp = asNonEmptyString(item.smtp_status);
    out.push({
      email,
      confidence: smtp === "valid" ? 80 : 55,
      first: asNonEmptyString(item.first_name) ?? undefined,
      last: asNonEmptyString(item.last_name) ?? undefined,
    });
  }
  if (out.length === 0) return { ok: false, reason: "no_valid_emails" };
  return { ok: true, value: out };
}

/** Snov verifier — `data.result` (v2) or `result` (v1). */
export function parseSnovVerifier(raw: unknown): ParseResult<"deliverable" | "risky" | "undeliverable" | "unknown"> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const data = isObject(raw.data) ? raw.data : raw;
  const result = asNonEmptyString(data.result);
  if (!result) return { ok: false, reason: "no_result_field" };
  if (result === "deliverable" || result === "risky" || result === "undeliverable") {
    return { ok: true, value: result };
  }
  return { ok: true, value: "unknown" };
}

/** Apollo `people/match` → optional `person` object. */
export function parseApolloMatch(raw: unknown): ParseResult<ParsedEmail> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const person = asObject(raw.person);
  const email = asEmail(person.email);
  if (!email) return { ok: false, reason: "no_email" };
  return {
    ok: true,
    value: {
      email,
      confidence: 70,
      first: asNonEmptyString(person.first_name) ?? undefined,
      last: asNonEmptyString(person.last_name) ?? undefined,
      position: asNonEmptyString(person.title) ?? undefined,
    },
  };
}

/** PDL `person/enrich` (company match). */
export function parsePdlPersonEnrich(raw: unknown): ParseResult<ParsedEmail> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const data = asObject(raw.data);
  const work = asEmail(data.work_email);
  if (work) return { ok: true, value: { email: work, confidence: 75 } };
  const personals = asArray(data.personal_emails);
  for (const p of personals) {
    const e = asEmail(p);
    if (e) return { ok: true, value: { email: e, confidence: 65 } };
  }
  const recommended = asEmail(data.recommended_personal_email);
  if (recommended) return { ok: true, value: { email: recommended, confidence: 60 } };
  return { ok: false, reason: "no_email" };
}

/** PDL `person/search` (name-only) → first hit in `data[0]`. */
export function parsePdlPersonSearch(
  raw: unknown,
): ParseResult<{ email?: string; phone?: string; confidence: number }> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const arr = asArray(raw.data);
  const first = arr[0];
  if (!isObject(first)) return { ok: false, reason: "no_hit" };
  const email = asEmail(first.work_email)
    ?? asEmail(asArray(first.personal_emails)[0])
    ?? asEmail(first.recommended_personal_email);
  const phone =
    asNonEmptyString(first.mobile_phone)
    ?? asNonEmptyString(asArray(first.phone_numbers)[0]);
  if (!email && !phone) return { ok: false, reason: "no_contact" };
  return { ok: true, value: { email: email ?? undefined, phone: phone ?? undefined, confidence: 60 } };
}

/** Snov OAuth token response. */
export function parseSnovToken(raw: unknown): ParseResult<{ token: string; expiresInSec: number }> {
  if (!isObject(raw)) return { ok: false, reason: "not_object" };
  const token = asNonEmptyString(raw.access_token);
  if (!token) return { ok: false, reason: "no_access_token" };
  const expiresIn = asFiniteNumber(raw.expires_in) ?? 3600;
  return { ok: true, value: { token, expiresInSec: expiresIn } };
}

// ── enrichment_trace defensive parser ──────────────────────────────────────
// `prospect.enrichment_trace` is a JSONB column. It SHOULD be an array of
// `{stage, ok, …}` objects, but historical rows have nulls, objects, strings.
// This guard never throws and always returns an array we can append to.
export function parseEnrichmentTrace(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter(isObject);
}
