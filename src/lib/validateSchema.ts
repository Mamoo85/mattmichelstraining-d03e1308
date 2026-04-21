/**
 * Lightweight runtime schema validator for Supabase query results.
 *
 * Detects two failure modes that otherwise show as "empty results":
 *  1. PostgREST 400 errors mentioning a missing/forbidden column.
 *  2. Returned rows that lack expected columns OR contain forbidden ones
 *     (e.g. `status` was renamed/removed but old code still references it).
 */

export type SchemaCheck = {
  expected: string[];          // columns that MUST exist on every row
  forbidden?: string[];        // columns that must NOT exist (catches stale model)
};

export type SchemaValidation =
  | { ok: true }
  | { ok: false; reason: string; missing: string[]; forbidden: string[] };

const COLUMN_ERROR_RE =
  /column\s+["']?([a-zA-Z0-9_.]+)["']?\s+does not exist|could not find the '([a-zA-Z0-9_]+)' column/i;

export function validateSchema(
  rows: any[] | null | undefined,
  error: { message?: string; code?: string } | null,
  check: SchemaCheck,
): SchemaValidation {
  // 1. Surface PostgREST column errors with a clear message.
  if (error) {
    const m = error.message?.match(COLUMN_ERROR_RE);
    if (m) {
      const col = m[1] || m[2];
      return {
        ok: false,
        reason: `Data model mismatch: column "${col}" referenced in the query does not exist on this table. Update the select() to match the current schema.`,
        missing: [col],
        forbidden: [],
      };
    }
    return {
      ok: false,
      reason: `Query failed: ${error.message || "unknown error"}`,
      missing: [],
      forbidden: [],
    };
  }

  // 2. No rows = nothing to validate (legitimately empty table).
  if (!rows || rows.length === 0) return { ok: true };

  const sample = rows[0];
  const keys = new Set(Object.keys(sample || {}));

  const missing = check.expected.filter((c) => !keys.has(c));
  const forbidden = (check.forbidden || []).filter((c) => keys.has(c));

  if (missing.length === 0 && forbidden.length === 0) return { ok: true };

  const parts: string[] = [];
  if (missing.length) parts.push(`missing expected column(s): ${missing.join(", ")}`);
  if (forbidden.length)
    parts.push(`found forbidden column(s) that should be removed from select(): ${forbidden.join(", ")}`);

  return {
    ok: false,
    reason: `Data model mismatch — ${parts.join(" · ")}.`,
    missing,
    forbidden,
  };
}

/** Pre-baked check for the industry_pulse_signals table. */
export const INDUSTRY_PULSE_SIGNALS_CHECK: SchemaCheck = {
  expected: ["id", "signal_type", "detected_at", "source_urls"],
  forbidden: ["status", "source_url"],
};
