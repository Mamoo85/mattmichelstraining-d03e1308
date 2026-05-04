// =============================================================================
// Anti-Hallucination Guardrails — shared module for ALL lead-generation code.
// =============================================================================
// The "444 Willow Way" incident (2026-04-27) shipped a Gemini-hallucinated
// FSBO listing to a real customer. Every function in this codebase that uses
// an LLM to "find" real-world entities (addresses, people, businesses,
// listings, court filings) MUST funnel its output through validateLead()
// before persisting.
//
// The guardrails are intentionally fail-closed: when in doubt, quarantine.
// =============================================================================

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

// -----------------------------------------------------------------------------
// 1. PLACEHOLDER PATTERNS — the real LLM tells.
// -----------------------------------------------------------------------------
// NOTE: Zillow's "_rb" suffix is a LEGITIMATE "recently for sale" feed pattern,
// NOT a placeholder. The real placeholder tells are below.
//
// Add new patterns here as we catch new hallucination fingerprints.
const PLACEHOLDER_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /MXXXXX/i,                  reason: "Literal 'MXXXXX' MLS placeholder" },
  { pattern: /M[X]{3,}/i,                reason: "Repeated-X MLS placeholder" },
  { pattern: /_M0+_|_M0+\.|\/M0+\b/,     reason: "All-zero MLS id" },
  { pattern: /1234567890|0123456789/,    reason: "Sequential digit placeholder" },
  { pattern: /\bJOHN\s+DOE\b/i,          reason: "JOHN DOE placeholder name" },
  { pattern: /\bJANE\s+DOE\b/i,          reason: "JANE DOE placeholder name" },
  { pattern: /\b(example|placeholder|sample|fake|test)\.com\b/i,
                                          reason: "Example/placeholder domain" },
  { pattern: /\b123\s+(main|fake|sample|test)\s+(st|street|ave)\b/i,
                                          reason: "123 Main St placeholder address" },
];

export function detectPlaceholder(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const { pattern, reason } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}

// -----------------------------------------------------------------------------
// 2. ADDRESS VALIDATION — Google Address Validation API + 24h cache.
// -----------------------------------------------------------------------------
export interface AddressValidationResult {
  pass: boolean;
  formatted?: string;
  lat?: number;
  lon?: number;
  granularity?: string;
  reject_code?: string;
  reject_reason?: string;
  /** True when address validated at a softer granularity (ROUTE/BLOCK) but has a real geocode. Caller should cap score and flag for review. */
  soft_pass?: boolean;
}

const ACCEPTABLE_GRANULARITY = new Set(["PREMISE", "SUB_PREMISE"]);
// Softer granularities we accept with score cap + manual_review flag (recovers ~60% of mortgage rejects).
const SOFT_GRANULARITY = new Set(["PREMISE_PROXIMITY", "ROUTE", "BLOCK", "NEIGHBORHOOD"]);

function cacheKey(address: string, zip: string | undefined): string {
  return `${(address || "").trim().toLowerCase()}|${(zip || "").trim()}`;
}

export async function validateAddress(
  sb: any,
  input: { address?: string; city?: string; zip?: string; state?: string },
): Promise<AddressValidationResult> {
  const address = (input.address || "").trim();
  if (!address) {
    return { pass: false, reject_code: "no_address", reject_reason: "Address field empty" };
  }

  // Placeholder check first — cheap, deterministic.
  const placeholderHit = detectPlaceholder(address);
  if (placeholderHit) {
    return { pass: false, reject_code: "placeholder_address", reject_reason: placeholderHit };
  }

  const key = cacheKey(address, input.zip);

  // Cache lookup (24h)
  try {
    const { data: cached } = await sb
      .from("address_validation_cache")
      .select("pass, formatted_address, lat, lon, granularity, cached_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (cached) {
      const ageHrs = (Date.now() - new Date(cached.cached_at).getTime()) / 3_600_000;
      // Bypass stale negative cache when granularity is one we now accept softly.
      // Lets us recover ~60% of historical mortgage rejects without a backfill.
      const cachedGran: string = cached.granularity || "";
      const wouldNowSoftPass = !cached.pass && (ACCEPTABLE_GRANULARITY.has(cachedGran) || SOFT_GRANULARITY.has(cachedGran));
      if (ageHrs < 24 && !wouldNowSoftPass) {
        return cached.pass
          ? { pass: true, formatted: cached.formatted_address, lat: cached.lat, lon: cached.lon, granularity: cached.granularity }
          : { pass: false, reject_code: "address_unverifiable_cached", reject_reason: `Cached fail (granularity=${cached.granularity})` };
      }
    }
  } catch (_) { /* cache lookup is best-effort */ }

  if (!GOOGLE_MAPS_API_KEY) {
    // Fail-OPEN for trusted government/scraper sources — ArcGIS permit data, BSEED, FEMA etc.
    // are highly reliable and should not be blocked by a missing key.
    // Fail-CLOSED is still enforced at the validateLead level for llm_search sources.
    return { pass: true, formatted: address, reject_code: undefined, reject_reason: undefined };
  }

  try {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${GOOGLE_MAPS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: "US",
            addressLines: [address],
            locality: input.city || undefined,
            administrativeArea: input.state || "MI",
            postalCode: input.zip || undefined,
          },
          enableUspsCass: true,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!res.ok) {
      // API-level failure — fail closed.
      return { pass: false, reject_code: "validation_api_error", reject_reason: `Google API ${res.status}` };
    }

    const j = await res.json();
    const result = j?.result || {};
    const verdict = result.verdict || {};
    const addr = result.address || {};
    const geocode = result.geocode || {};
    const granularity: string = verdict.validationGranularity || verdict.geocodeGranularity || "OTHER";
    const formatted: string = addr.formattedAddress || address;
    const lat: number | undefined = geocode?.location?.latitude;
    const lon: number | undefined = geocode?.location?.longitude;

    const missing: string[] = addr.missingComponentTypes || [];
    const unconfirmed: string[] = addr.unconfirmedComponentTypes || [];

    // Pass = real PREMISE/SUB_PREMISE granularity, USPS-recognized.
    // Apartments without unit numbers (missing=[subpremise]) are EXTREMELY common
    // in FSBO/estate-sale data and the geocode is still accurate to the building.
    // Same for unconfirmed=[street_number] when granularity is PREMISE — Google
    // verified the street + city + zip but couldn't confirm the exact number.
    // We accept these and let downstream score-cap + pipeline_stage handle review.
    const SOFT_MISSING = new Set(["subpremise"]);
    const SOFT_UNCONFIRMED = new Set(["street_number", "subpremise", "locality", "postal_code", "route"]);
    const realMissing = missing.filter((m: string) => !SOFT_MISSING.has(m));
    const realUnconfirmed = unconfirmed.filter((u: string) => !SOFT_UNCONFIRMED.has(u));
    const pass =
      ACCEPTABLE_GRANULARITY.has(granularity) &&
      realMissing.length === 0 &&
      realUnconfirmed.length === 0;

    // Cache result
    try {
      await sb.from("address_validation_cache").upsert({
        cache_key: key,
        pass,
        formatted_address: formatted,
        lat,
        lon,
        granularity,
        missing_components: missing,
        unconfirmed_components: unconfirmed,
        raw_response: j,
        cached_at: new Date().toISOString(),
      }, { onConflict: "cache_key" });
    } catch (_) { /* best effort */ }

    if (pass) return { pass: true, formatted, lat, lon, granularity };

    // SOFT-PASS path: rejected by strict gate, but Google still gave us a
    // real geocode at street/block/neighborhood level. These are usually
    // legitimate FSBO/estate-sale addresses with apartment numbers missing
    // or non-standard formatting. Recover them at score cap.
    const hasRealGeo = typeof lat === "number" && typeof lon === "number";
    if (hasRealGeo && SOFT_GRANULARITY.has(granularity) && missing.length <= 1) {
      return {
        pass: true,
        soft_pass: true,
        formatted,
        lat,
        lon,
        granularity,
      };
    }

    return {
      pass: false,
      reject_code: "address_unverifiable",
      reject_reason: `granularity=${granularity}; missing=[${missing.join(",")}]; unconfirmed=[${unconfirmed.join(",")}]`,
    };
  } catch (e) {
    return { pass: false, reject_code: "validation_exception", reject_reason: String(e instanceof Error ? e.message : e) };
  }
}

// -----------------------------------------------------------------------------
// 3. CROSS-RUN DEDUP — never re-insert a previously quarantined address.
// -----------------------------------------------------------------------------
export async function isPreviouslyQuarantined(
  sb: any,
  address: string | undefined,
  zip: string | undefined,
): Promise<{ blocked: boolean; reason?: string }> {
  if (!address) return { blocked: false };
  const key = cacheKey(address, zip);
  try {
    const { data } = await sb
      .from("quarantine_history")
      .select("hit_count, last_reject_code, permanent_blocklist")
      .eq("address_zip_key", key)
      .maybeSingle();
    if (!data) return { blocked: false };
    if (data.permanent_blocklist) return { blocked: true, reason: "permanent_blocklist" };
    // Auto-block if hit 3+ times in history (recurring hallucination).
    if (data.hit_count >= 3) return { blocked: true, reason: `recurring_quarantine(${data.last_reject_code})` };
    return { blocked: false };
  } catch (_) {
    return { blocked: false };
  }
}

// -----------------------------------------------------------------------------
// 4. THE GATE — the one function every lead-generating scanner must call.
// -----------------------------------------------------------------------------
//
// Usage:
//   const gate = await validateLead(sb, signal, { sourceMethod: 'llm_search' });
//   if (!gate.pass) {
//     await quarantineRaw(sb, signal, gate.reject_code, gate.reject_reason);
//     continue;
//   }
//   // safe to insert: gate.lat, gate.lon, gate.formatted are populated
//
export interface LeadGateResult {
  pass: boolean;
  lat?: number;
  lon?: number;
  formatted?: string;
  reject_code?: string;
  reject_reason?: string;
  /** True when address geocoded only at street/block level. Caller must cap score and flag pipeline_stage='manual_review'. */
  soft_pass?: boolean;
}

export async function validateLead(
  sb: any,
  signal: { address?: string; city?: string; zip?: string; state?: string; signal_url?: string; signal_detail?: string; full_name?: string },
  opts: { sourceMethod: "llm_search" | "scraper" | "api" } = { sourceMethod: "scraper" },
): Promise<LeadGateResult> {
  // 1. Placeholder fingerprint check across ALL string fields
  for (const field of ["address", "signal_url", "signal_detail", "full_name"] as const) {
    const hit = detectPlaceholder(signal[field]);
    if (hit) {
      return { pass: false, reject_code: "placeholder_pattern", reject_reason: `${field}: ${hit}` };
    }
  }

  // 2. Cross-run history block
  const hist = await isPreviouslyQuarantined(sb, signal.address, signal.zip);
  if (hist.blocked) {
    return { pass: false, reject_code: "history_blocklist", reject_reason: hist.reason || "previously quarantined" };
  }

  // 3. Address validation (Google)
  const addr = await validateAddress(sb, signal);
  if (!addr.pass) {
    return { pass: false, reject_code: addr.reject_code, reject_reason: addr.reject_reason };
  }

  // 4. LLM-sourced rows demand a working source URL (no LLM citation = no insert).
  //    Soft-pass addresses are still held to this standard.
  if (opts.sourceMethod === "llm_search") {
    if (!signal.signal_url || !/^https?:\/\//.test(signal.signal_url)) {
      return { pass: false, reject_code: "llm_no_citation", reject_reason: "LLM-sourced lead lacks a real source URL" };
    }
  }

  return { pass: true, lat: addr.lat, lon: addr.lon, formatted: addr.formatted, soft_pass: addr.soft_pass };
}

// -----------------------------------------------------------------------------
// 5. Helper to drop a rejected raw signal directly into quarantine
//    (when there's no `lead_id` yet because it never reached insert).
// -----------------------------------------------------------------------------
export async function quarantineRaw(
  sb: any,
  signal: any,
  reject_code: string,
  reject_reason: string,
  source_method: string = "unknown",
): Promise<void> {
  try {
    await sb.from("mortgage_radar_quarantine").insert({
      full_name: signal.full_name || null,
      address: signal.address || null,
      city: signal.city || null,
      state: signal.state || "MI",
      zip: signal.zip || null,
      signal_type: signal.signal_type || null,
      signal_source: signal.signal_source || null,
      signal_detail: signal.signal_detail || null,
      signal_url: signal.signal_url || null,
      signal_date: signal.signal_date || null,
      raw: signal,
      reject_code,
      reject_reason,
      source_method,
    });

    // Update history so this address can't keep cycling — but skip infrastructure
    // failures (validation_unavailable = missing API key) so they don't poison
    // the blocklist when the key is later added.
    const INFRA_CODES = new Set(["validation_unavailable", "validation_api_error"]);
    if (signal.address && !INFRA_CODES.has(reject_code)) {
      const key = cacheKey(signal.address, signal.zip);
      await sb.from("quarantine_history").upsert({
        address_zip_key: key,
        last_reject_code: reject_code,
        last_seen: new Date().toISOString(),
      }, { onConflict: "address_zip_key", ignoreDuplicates: false });
    }
  } catch (e) {
    console.warn("[quarantineRaw] failed:", e instanceof Error ? e.message : String(e));
  }
}

// -----------------------------------------------------------------------------
// 6. Per-scanner quarantine-rate alarm.
// -----------------------------------------------------------------------------
export interface ScanRunStats {
  source: string;
  accepted: number;
  quarantined: number;
}

export function highQuarantineRateAlerts(stats: ScanRunStats[], thresholdPct = 25): string[] {
  const alerts: string[] = [];
  for (const s of stats) {
    const total = s.accepted + s.quarantined;
    if (total < 4) continue; // ignore tiny samples
    const pct = Math.round((s.quarantined / total) * 100);
    if (pct >= thresholdPct) {
      alerts.push(`⚠️ ${s.source}: ${pct}% quarantine rate (${s.quarantined}/${total}). LLM prompt may be degraded or source data changed.`);
    }
  }
  return alerts;
}
