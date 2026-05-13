/**
 * Centralized Apollo.io client.
 * - Always sends capitalized `X-Api-Key` header (Apollo is case-sensitive on some proxies)
 * - Pins to /api/v1 base (Apollo deprecated bare /v1 in 2024 — silent 401 in some regions)
 * - Adds 12s timeout, JSON parse safety, and structured error returns
 * - Logs failures with { status, body_preview } so the diagnostics drawer can show them
 */

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const APOLLO_BASE = "https://api.apollo.io/api/v1";
const DEFAULT_TIMEOUT_MS = 12_000;

export interface ApolloResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  endpoint: string;
}

export interface ApolloContact {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  phone_numbers?: Array<{ raw_number: string; type: string }>;
  linkedin_url?: string;
  organization_name?: string;
  organization?: { name?: string; website_url?: string; industry?: string; employee_count?: number };
  city?: string;
  state?: string;
}

export interface ApolloOrganization {
  id?: string;
  name?: string;
  website_url?: string;
  industry?: string;
  employee_count?: number;
  linkedin_url?: string;
  city?: string;
  state?: string;
  founded_year?: number;
  estimated_num_employees?: number;
  keywords?: string[];
}

export function hasApolloKey(): boolean {
  return APOLLO_API_KEY.length > 0;
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Accept": "application/json",
    "X-Api-Key": APOLLO_API_KEY,
    ...(extra || {}),
  };
}

async function callApollo<T = any>(
  endpoint: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<ApolloResult<T>> {
  if (!APOLLO_API_KEY) {
    return { ok: false, status: 0, data: null, error: "APOLLO_API_KEY missing", endpoint };
  }

  const url = endpoint.startsWith("http") ? endpoint : `${APOLLO_BASE}${endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      headers: buildHeaders(init.headers as Record<string, string> | undefined),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? JSON.parse(text) as T : null;
    } catch {
      // not JSON
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: `Apollo ${res.status}: ${text.slice(0, 200)}`,
        endpoint: url,
      };
    }
    return { ok: true, status: res.status, data, endpoint: url };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      endpoint: url,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Core helpers ----

export function apolloPeopleMatch(body: Record<string, unknown>) {
  return callApollo("/people/match", { method: "POST", body: JSON.stringify(body) });
}

export function apolloMixedPeopleSearch(body: Record<string, unknown>) {
  return callApollo("/mixed_people/search", { method: "POST", body: JSON.stringify(body) });
}

export function apolloOrgSearch(body: Record<string, unknown>) {
  return callApollo("/organizations/search", { method: "POST", body: JSON.stringify(body) });
}

export function apolloOrgEnrich(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return callApollo(`/organizations/enrich?${qs}`, { method: "GET" });
}

export function apolloHealth() {
  return callApollo("/auth/health", { method: "GET", timeoutMs: 6_000 });
}

// ---- Backward-compatible wrappers for enrichment functions ----

/**
 * Default decision-maker titles for trade/contractor outreach. Filters out
 * irrelevant junior staff and avoids gatekeepers when used with people search.
 */
export const DECISION_MAKER_TITLES = [
  "owner", "founder", "co-founder", "president", "ceo", "principal",
  "general manager", "operations manager", "managing partner",
  "director of operations", "vp operations",
];

/**
 * Default exclusion titles — strip these post-search. Apollo's `not_titles`
 * sometimes silently drops the call so we filter client-side as a safety net.
 */
export const EXCLUDED_TITLES = [
  "intern", "assistant", "receptionist", "apprentice", "student", "trainee",
];

export async function apolloPeopleSearch(params: {
  name?: string;
  email?: string;
  organization_name?: string;
  person_titles?: string[];
  person_locations?: string[];
  page?: number;
  per_page?: number;
  /** When true (default), only decision-maker titles are returned. */
  decision_makers_only?: boolean;
}): Promise<ApolloContact[]> {
  const { decision_makers_only = true, ...rest } = params;
  const titleFilter = rest.person_titles && rest.person_titles.length > 0
    ? rest.person_titles
    : (decision_makers_only ? DECISION_MAKER_TITLES : undefined);

  const res = await apolloMixedPeopleSearch({
    ...rest,
    ...(titleFilter ? { person_titles: titleFilter } : {}),
  } as Record<string, unknown>);

  if (!res.ok) {
    console.warn(`[apollo.peopleSearch] status=${res.status} error=${(res.error || "").slice(0, 200)}`);
  }

  const people = (res.data?.people || []) as ApolloContact[];
  // Client-side scrub for excluded titles
  return people.filter((p) => {
    const t = (p.title || "").toLowerCase();
    return !EXCLUDED_TITLES.some((bad) => t.includes(bad));
  });
}

export async function apolloOrganizationSearch(params: {
  q_organization_name?: string;
  organization_domains?: string[];
  organization_locations?: string[];
  per_page?: number;
  page?: number;
}): Promise<ApolloOrganization[]> {
  const res = await callApollo("/mixed_companies/search", { method: "POST", body: JSON.stringify(params) });
  return (res.data?.organizations || []) as ApolloOrganization[];
}

export async function apolloOrganizationEnrich(domain: string): Promise<ApolloOrganization | null> {
  if (!domain) return null;
  const res = await apolloOrgEnrich({ domain });
  return (res.data?.organization || null) as ApolloOrganization | null;
}

export { APOLLO_BASE, callApollo };
