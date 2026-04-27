/**
 * agency-contact-enrich (v2)
 *
 * Resolves the decision-maker (name + verified email) for a Metro Detroit
 * staffing agency using a multi-stage waterfall, then caches the result in
 * `agency_contact_enrichments` so repeat lookups are free.
 *
 * Stages:
 *   1. Apollo organizations/enrich  (resolve canonical domain + org_id)
 *   2. Apollo people/match          (unlocks personal email on standard plan)
 *   3. Apollo mixed_people/search   (filtered by org_id + titles)
 *   4. Hunter.io domain-search      (highest-rank recruiter)
 *   5. Snov.io domain-search        (verified personal emails)
 *   6. Pattern guess                (first.last@domain, requires real name)
 *
 * IMPORTANT: returns a `trace` array even on miss so the UI can show
 * the operator EXACTLY which stage failed and why.
 *
 * Admin-only.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_CLIENT_ID = Deno.env.get("SNOV_CLIENT_ID") || "";
const SNOV_CLIENT_SECRET = Deno.env.get("SNOV_CLIENT_SECRET") || "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface ContactResult {
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_full_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_linkedin: string | null;
  email_status: "verified" | "guessed" | "failed";
  source: "apollo_match" | "apollo_search" | "hunter" | "snov" | "pattern" | "none";
  domain: string | null;
}

const TITLE_KEYWORDS_BY_HINT: Record<string, string[]> = {
  default: ["Director of Recruiting", "VP of Recruiting", "Branch Manager", "Director of Operations", "Recruiting Manager"],
  branch: ["Branch Manager", "Branch Director", "Regional Director"],
  vp: ["VP of Recruiting", "Vice President", "VP Operations"],
  director: ["Director of Recruiting", "Director of Operations", "Strategic Partner"],
};

function rankTitle(t: string): number {
  const s = t.toLowerCase();
  if (/director of recruit|vp.*recruit|head of talent|chief talent/.test(s)) return 100;
  if (/recruit/.test(s)) return 80;
  if (/branch manager|branch director|regional director/.test(s)) return 70;
  if (/director|vp|vice president/.test(s)) return 50;
  return 10;
}

function cleanDomain(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase() || null;
}

// ── Apollo: resolve org (domain + org_id) ────────────────────────────────────
async function apolloOrgEnrich(domainOrName: { domain?: string | null; name?: string | null }): Promise<{ org_id: string | null; domain: string | null; raw: any } | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const url = new URL("https://api.apollo.io/api/v1/organizations/enrich");
    if (domainOrName.domain) url.searchParams.set("domain", domainOrName.domain);
    else if (domainOrName.name) url.searchParams.set("organization_name", domainOrName.name);
    else return null;
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { org_id: null, domain: null, raw: { status: res.status } };
    const data = await res.json();
    const org = data?.organization || null;
    return {
      org_id: org?.id || null,
      domain: cleanDomain(org?.primary_domain || org?.website_url),
      raw: org,
    };
  } catch (e) { return { org_id: null, domain: null, raw: { error: String(e) } }; }
}

// ── Apollo people/match — best email unlock on standard plan ─────────────────
async function apolloPeopleMatch(opts: { org_id?: string | null; domain?: string | null; first?: string | null; last?: string | null; title?: string | null }): Promise<any | null> {
  if (!APOLLO_API_KEY) return null;
  if (!opts.first && !opts.last && !opts.title) return null;
  try {
    const body: Record<string, unknown> = {
      reveal_personal_emails: true,
      reveal_phone_number: false,
    };
    if (opts.first) body.first_name = opts.first;
    if (opts.last) body.last_name = opts.last;
    if (opts.org_id) body.organization_id = opts.org_id;
    if (opts.domain) body.domain = opts.domain;
    if (opts.title) body.title = opts.title;
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.person;
    if (!p) return null;
    const email = p.email || (p.personal_emails && p.personal_emails[0]) || null;
    if (!email) return null;
    return {
      first: p.first_name || null,
      last: p.last_name || null,
      title: p.title || null,
      email,
      linkedin: p.linkedin_url || null,
      verified: p.email_status ? p.email_status === "verified" : true,
    };
  } catch (_) { return null; }
}

// ── Apollo people search by org_id + titles ──────────────────────────────────
async function apolloPeopleSearch(opts: { org_id?: string | null; domain?: string | null; agencyName: string; titles: string[] }): Promise<any | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const body: Record<string, unknown> = {
      per_page: 5,
      page: 1,
      person_titles: opts.titles,
    };
    if (opts.org_id) body.organization_ids = [opts.org_id];
    else if (opts.domain) body.q_organization_domains = [opts.domain];
    else body.organization_names = [opts.agencyName];

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.people || data?.contacts || [];
    if (list.length === 0) return null;
    // Best candidate by title rank
    const ranked = list.map((p: any) => ({ p, score: rankTitle(p.title || "") })).sort((a: any, b: any) => b.score - a.score);
    const hit = ranked[0].p;
    return {
      first: hit.first_name || null,
      last: hit.last_name || null,
      title: hit.title || null,
      email: hit.email || null, // often null on standard plan — that's expected
      linkedin: hit.linkedin_url || null,
      verified: !!hit.email && hit.email_status !== "unverified",
    };
  } catch (_) { return null; }
}

// ── Hunter ───────────────────────────────────────────────────────────────────
async function hunterDomainSearch(domain: string): Promise<any | null> {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&type=personal&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails || [];
    const ranked = emails.map((e: any) => ({ ...e, score: rankTitle(e.position || "") })).sort((a: any, b: any) => b.score - a.score);
    const hit = ranked[0];
    if (!hit?.value) return null;
    return {
      first: hit.first_name || null,
      last: hit.last_name || null,
      title: hit.position || null,
      email: hit.value,
      linkedin: hit.linkedin || null,
      verified: hit.confidence ? hit.confidence >= 70 : true,
    };
  } catch (_) { return null; }
}

// ── Snov ─────────────────────────────────────────────────────────────────────
let snovToken: { value: string; expiresAt: number } | null = null;
async function snovGetToken(): Promise<string | null> {
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET) return null;
  if (snovToken && snovToken.expiresAt > Date.now()) return snovToken.value;
  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: SNOV_CLIENT_ID, client_secret: SNOV_CLIENT_SECRET }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.access_token) return null;
    snovToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60_000 };
    return snovToken.value;
  } catch (_) { return null; }
}

async function snovDomainSearch(domain: string): Promise<any | null> {
  if (!domain) return null;
  const token = await snovGetToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=personal&limit=10&access_token=${token}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.emails || data?.data?.emails || [];
    const ranked = list.map((e: any) => ({ ...e, score: rankTitle(e.position || e.jobTitle || "") })).sort((a: any, b: any) => b.score - a.score);
    const hit = ranked[0];
    if (!hit?.email) return null;
    return {
      first: hit.firstName || hit.first_name || null,
      last: hit.lastName || hit.last_name || null,
      title: hit.position || hit.jobTitle || null,
      email: hit.email,
      linkedin: hit.linkedin || null,
      verified: hit.status === "verified" || hit.emailStatus === "valid",
    };
  } catch (_) { return null; }
}

function patternGuess(domain: string, first: string | null, last: string | null): any | null {
  if (!domain || !first || !last) return null;
  const f = first.toLowerCase().replace(/[^a-z]/g, "");
  const l = last.toLowerCase().replace(/[^a-z]/g, "");
  if (!f || !l) return null;
  return {
    first, last, title: null,
    email: `${f}.${l}@${domain}`,
    linkedin: null, verified: false,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Admin gate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const agency_name: string = body?.agency_name;
    const role_hint: string = body?.role_hint || "default";
    const provided_domain: string | undefined = body?.domain;
    const force: boolean = !!body?.force;

    if (!agency_name) {
      return new Response(JSON.stringify({ error: "agency_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache check
    if (!force) {
      const { data: cached } = await sb
        .from("agency_contact_enrichments")
        .select("*")
        .eq("agency_name", agency_name)
        .maybeSingle();
      if (cached?.contact_email) {
        return new Response(JSON.stringify({ ok: true, cached: true, contact: cached, trace: ["cache_hit"] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const trace: string[] = [];
    const titles = TITLE_KEYWORDS_BY_HINT[role_hint] || TITLE_KEYWORDS_BY_HINT.default;
    const providers_status = {
      apollo: !!APOLLO_API_KEY,
      hunter: !!HUNTER_API_KEY,
      snov: !!(SNOV_CLIENT_ID && SNOV_CLIENT_SECRET),
    };
    trace.push(`providers:apollo=${providers_status.apollo ? "on" : "off"},hunter=${providers_status.hunter ? "on" : "off"},snov=${providers_status.snov ? "on" : "off"}`);

    // Stage 1: org enrich (domain + org_id)
    const cleanedProvided = cleanDomain(provided_domain);
    const org = await apolloOrgEnrich({ domain: cleanedProvided, name: agency_name });
    const domain = org?.domain || cleanedProvided || null;
    const org_id = org?.org_id || null;
    trace.push(`org:domain=${domain || "none"},org_id=${org_id ? "yes" : "no"}`);

    const result: ContactResult = {
      contact_first_name: null, contact_last_name: null, contact_full_name: null,
      contact_title: null, contact_email: null, contact_linkedin: null,
      email_status: "failed", source: "none", domain,
    };

    let nameHint: { first: string | null; last: string | null; title: string | null } = { first: null, last: null, title: null };

    // Stage 2: Apollo people/match by title (best chance to unlock email)
    for (const t of titles) {
      const m = await apolloPeopleMatch({ org_id, domain, title: t });
      if (m?.email) {
        result.contact_first_name = m.first;
        result.contact_last_name = m.last;
        result.contact_full_name = [m.first, m.last].filter(Boolean).join(" ") || null;
        result.contact_title = m.title;
        result.contact_email = m.email;
        result.contact_linkedin = m.linkedin;
        result.email_status = m.verified ? "verified" : "guessed";
        result.source = "apollo_match";
        trace.push(`apollo_match[${t}]:hit:${m.email}`);
        break;
      }
    }
    if (!result.contact_email) trace.push(`apollo_match:miss(${titles.length} titles tried)`);

    // Stage 3: Apollo people search — get a NAME even if no email
    if (!result.contact_email || !nameHint.first) {
      const search = await apolloPeopleSearch({ org_id, domain, agencyName: agency_name, titles });
      if (search) {
        nameHint = { first: search.first, last: search.last, title: search.title };
        trace.push(`apollo_search:found_name=${search.first || "?"} ${search.last || "?"} (${search.title || "no title"})${search.email ? ` email=${search.email}` : " no_email"}`);
        if (!result.contact_email && search.email) {
          result.contact_first_name = search.first;
          result.contact_last_name = search.last;
          result.contact_full_name = [search.first, search.last].filter(Boolean).join(" ") || null;
          result.contact_title = search.title;
          result.contact_email = search.email;
          result.contact_linkedin = search.linkedin;
          result.email_status = search.verified ? "verified" : "guessed";
          result.source = "apollo_search";
        }
      } else {
        trace.push(`apollo_search:miss`);
      }
    }

    // Stage 4: Apollo people/match again, this time with the discovered name
    if (!result.contact_email && nameHint.first && nameHint.last) {
      const m = await apolloPeopleMatch({ org_id, domain, first: nameHint.first, last: nameHint.last, title: nameHint.title });
      if (m?.email) {
        result.contact_first_name = m.first || nameHint.first;
        result.contact_last_name = m.last || nameHint.last;
        result.contact_full_name = [result.contact_first_name, result.contact_last_name].filter(Boolean).join(" ") || null;
        result.contact_title = m.title || nameHint.title;
        result.contact_email = m.email;
        result.contact_linkedin = m.linkedin;
        result.email_status = m.verified ? "verified" : "guessed";
        result.source = "apollo_match";
        trace.push(`apollo_match[by_name]:hit:${m.email}`);
      } else {
        trace.push(`apollo_match[by_name]:miss`);
      }
    }

    // Stage 5: Hunter
    if (!result.contact_email && domain) {
      const h = await hunterDomainSearch(domain);
      if (h?.email) {
        result.contact_first_name = h.first;
        result.contact_last_name = h.last;
        result.contact_full_name = [h.first, h.last].filter(Boolean).join(" ") || null;
        result.contact_title = h.title;
        result.contact_email = h.email;
        result.contact_linkedin = h.linkedin;
        result.email_status = h.verified ? "verified" : "guessed";
        result.source = "hunter";
        trace.push(`hunter:hit:${h.email}`);
      } else {
        trace.push(`hunter:miss`);
      }
    } else if (!result.contact_email && !domain) {
      trace.push(`hunter:skipped(no_domain)`);
    }

    // Stage 6: Snov
    if (!result.contact_email && domain) {
      const s = await snovDomainSearch(domain);
      if (s?.email) {
        result.contact_first_name = s.first;
        result.contact_last_name = s.last;
        result.contact_full_name = [s.first, s.last].filter(Boolean).join(" ") || null;
        result.contact_title = s.title;
        result.contact_email = s.email;
        result.contact_linkedin = s.linkedin;
        result.email_status = s.verified ? "verified" : "guessed";
        result.source = "snov";
        trace.push(`snov:hit:${s.email}`);
      } else {
        trace.push(`snov:miss`);
      }
    }

    // Stage 7: pattern guess from discovered name
    const guessFirst = result.contact_first_name || nameHint.first;
    const guessLast = result.contact_last_name || nameHint.last;
    if (!result.contact_email && domain && guessFirst && guessLast) {
      const g = patternGuess(domain, guessFirst, guessLast);
      if (g?.email) {
        result.contact_first_name = g.first;
        result.contact_last_name = g.last;
        result.contact_full_name = `${g.first} ${g.last}`;
        result.contact_title = nameHint.title;
        result.contact_email = g.email;
        result.email_status = "guessed";
        result.source = "pattern";
        trace.push(`pattern:guessed:${g.email}`);
      }
    } else if (!result.contact_email) {
      trace.push(`pattern:skipped(${!domain ? "no_domain" : "no_name"})`);
    }

    // Persist (upsert) — also persist trace so UI can replay it
    await sb.from("agency_contact_enrichments").upsert({
      agency_name,
      contact_first_name: result.contact_first_name,
      contact_last_name: result.contact_last_name,
      contact_full_name: result.contact_full_name,
      contact_title: result.contact_title,
      contact_email: result.contact_email,
      contact_linkedin: result.contact_linkedin,
      email_status: result.email_status,
      source: result.source,
      domain: result.domain,
      enriched_at: new Date().toISOString(),
      meta: { trace, role_hint, providers_status },
    }, { onConflict: "agency_name" });

    return new Response(JSON.stringify({ ok: true, cached: false, contact: result, trace, providers_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[agency-contact-enrich] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
