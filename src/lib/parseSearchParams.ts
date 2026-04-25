// Hardened query-string parser for SMS / QR / email entry points.
// Returns a discriminated union so callers can render a branded
// expired-link state instead of crashing or showing a blank screen.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParamSpec = "uuid" | "email" | "string";

export type ParseResult<T extends Record<string, ParamSpec>> =
  | { ok: true; values: { [K in keyof T]: string } }
  | { ok: false; reason: "missing" | "invalid"; field: string };

export function parseParams<T extends Record<string, ParamSpec>>(
  search: URLSearchParams,
  spec: T,
): ParseResult<T> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(spec)) {
    const raw = search.get(key)?.trim();
    if (!raw) return { ok: false, reason: "missing", field: key };
    const kind = spec[key];
    if (kind === "uuid" && !UUID_RE.test(raw)) return { ok: false, reason: "invalid", field: key };
    if (kind === "email" && !EMAIL_RE.test(raw)) return { ok: false, reason: "invalid", field: key };
    out[key] = raw;
  }
  return { ok: true, values: out as { [K in keyof T]: string } };
}

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value);
}

export function isEmail(value: string | null | undefined): boolean {
  return !!value && EMAIL_RE.test(value);
}
