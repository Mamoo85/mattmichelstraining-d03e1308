/**
 * D31-D40 Enrichment Router
 * Centralized provider routing, budget gating, circuit-breaker integration,
 * contactability short-circuiting, and HIBP pre-flight email check.
 *
 * Used by candidate-deep-enrich (and any future per-stage workers) to decide:
 *   - which providers to call (per vertical)
 *   - in what order
 *   - whether to skip based on missing prereq fields
 *   - whether to short-circuit when target fields are already populated
 *   - whether to bail on daily budget cap
 *   - whether to skip when circuit breaker is open
 */

import { withBreaker } from "./circuit-breaker.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";

export type Vertical = "healthcare" | "trades" | "industrial" | "default";

export interface ProviderRoute {
  provider: string;
  call_order: number;
  enabled: boolean;
  min_score: number | null;
  requires_field: string | null;
  short_circuit_on: string[] | null;
}

let routeCache: { ts: number; routes: Map<Vertical, ProviderRoute[]> } | null = null;
const CACHE_MS = 5 * 60_000;

async function loadRoutes(sb: any): Promise<Map<Vertical, ProviderRoute[]>> {
  if (routeCache && Date.now() - routeCache.ts < CACHE_MS) return routeCache.routes;
  const { data } = await sb
    .from("enrichment_provider_routes")
    .select("vertical, provider, call_order, enabled, min_score, requires_field, short_circuit_on")
    .eq("enabled", true)
    .order("call_order");
  const map = new Map<Vertical, ProviderRoute[]>();
  for (const r of data || []) {
    const arr = map.get(r.vertical as Vertical) || [];
    arr.push(r);
    map.set(r.vertical as Vertical, arr);
  }
  routeCache = { ts: Date.now(), routes: map };
  return map;
}

/** D40: detect vertical from license type */
export function detectVertical(licenseType?: string | null): Vertical {
  if (!licenseType) return "default";
  const t = licenseType.toLowerCase();
  if (/nurse|nursing|cna|lpn|rn|aide|health|medical|md|do|dds/i.test(t)) return "healthcare";
  if (/electric|plumb|hvac|boiler|mechanical|pipefit|sheetmetal|builder|construction|trade/i.test(t)) return "trades";
  return "default";
}

/** D33: check daily budget before paid call. Returns { allowed, reason }. */
export async function checkBudget(sb: any, provider: string, estimatedCost?: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const { data, error } = await sb.rpc("consume_source_budget", {
      p_provider: provider,
      p_estimated_cost: estimatedCost ?? null,
    });
    if (error) {
      console.warn(`[router] budget rpc error ${provider}:`, error.message);
      return { allowed: true, reason: "rpc_error" }; // fail-open to avoid blocking enrichment
    }
    return { allowed: data?.allowed === true, reason: data?.reason };
  } catch (e) {
    console.warn(`[router] budget exception:`, e);
    return { allowed: true, reason: "exception" };
  }
}

/** D34/D35: contactability short-circuit. */
export function isContactable(merged: Record<string, any>): boolean {
  const email = merged.pdl_personal_email || merged.hunter_email || merged.snov_email
    || merged.lusha_email || merged.clay_email || merged.ninjapear_email || merged.email;
  const phone = merged.pdl_mobile_phone || merged.lusha_phone || merged.clay_phone
    || merged.ninjapear_mobile || merged.npi_business_phone || merged.phone;
  if (!email || typeof email !== "string") return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (!phone || typeof phone !== "string") return false;
  if ((phone.replace(/\D/g, "").length) < 10) return false;
  return true;
}

/** D35: phone-verified gate — true when we already have a verified mobile (PDL/Lusha/NinjaPear). */
export function hasVerifiedPhone(merged: Record<string, any>): boolean {
  const p = merged.pdl_mobile_phone || merged.lusha_phone || merged.ninjapear_mobile;
  if (!p || typeof p !== "string") return false;
  return p.replace(/\D/g, "").length >= 10;
}

/** D36: NPI verify gate — true when healthcare candidate has confirmed NPI match. */
export function hasNPIMatch(merged: Record<string, any>): boolean {
  return !!merged.npi_number;
}

/**
 * D32: wrap a provider call in circuit breaker + budget check.
 * Returns the provider's payload (or {} when skipped/blocked/failed).
 */
export interface RunProviderOpts {
  sb: any;
  provider: string;
  estimatedCost?: number;
  fn: () => Promise<Record<string, unknown>>;
}

export async function runProvider(opts: RunProviderOpts): Promise<{ data: Record<string, unknown>; skipped: boolean; reason?: string }> {
  // Budget first (cheaper than the breaker)
  const budget = await checkBudget(opts.sb, opts.provider, opts.estimatedCost);
  if (!budget.allowed) {
    return { data: {}, skipped: true, reason: `budget:${budget.reason}` };
  }
  const result = await withBreaker(opts.provider, opts.fn);
  if (result.skipped) return { data: {}, skipped: true, reason: "circuit_open" };
  if (!result.ok) return { data: {}, skipped: true, reason: `error:${result.error}` };
  return { data: result.data || {}, skipped: false };
}

/**
 * D31: get the ordered route plan for a candidate.
 * Filters by min_score and requires_field.
 */
export async function planRoute(
  sb: any,
  vertical: Vertical,
  candidate: { score: number | null },
  merged: Record<string, any>,
): Promise<ProviderRoute[]> {
  const all = await loadRoutes(sb);
  const routes = all.get(vertical) || all.get("default") || [];
  return routes.filter((r) => {
    if ((r.min_score ?? 0) > (candidate.score ?? 0)) return false;
    if (r.requires_field && !merged[r.requires_field] && !(candidate as any)[r.requires_field]) return false;
    return true;
  });
}

/** D31: should we stop calling more providers because target fields are already populated? */
export function shouldShortCircuit(route: ProviderRoute, merged: Record<string, any>): boolean {
  if (!route.short_circuit_on || route.short_circuit_on.length === 0) return false;
  return route.short_circuit_on.every((field) => !!merged[field]);
}

/**
 * D37: HIBP email pre-flight check (cheap signal — confirms email actually exists in the wild).
 * Returns null when HIBP key absent. Returns { breaches: number, oldestYear, isPwned } otherwise.
 * NB: HIBP rate-limits to 1 req/1.5s per key — caller should batch carefully.
 */
export async function hibpEmailCheck(email: string): Promise<{ breaches: number; isPwned: boolean } | null> {
  if (!HIBP_API_KEY || !email) return null;
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "user-agent": "M2-Enrichment/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { breaches: 0, isPwned: false };
    if (!res.ok) return null;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    return { breaches: arr.length, isPwned: arr.length > 0 };
  } catch {
    return null;
  }
}

/** D38: sleep for randomized jitter (server-side only, used by jitter scheduler). */
export function jitterSeconds(maxSeconds: number): number {
  return Math.floor(Math.random() * maxSeconds);
}
