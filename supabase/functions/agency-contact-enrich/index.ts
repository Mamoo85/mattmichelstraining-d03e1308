/**
 * agency-contact-enrich
 *
 * Resolves the decision-maker (name + verified email) for a Metro Detroit
 * staffing agency using a 4-stage waterfall, then caches the result in
 * `agency_contact_enrichments` so repeat lookups are free.
 *
 * Stages: Apollo (org + title search) → Hunter.io (domain search) →
 * Snov.io (domain search) → pattern guess (first.last@domain).
 *
 * Admin-only. Returns { ok, contact, cached, trace }.
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
  source: "apollo" | "hunter" | "snov" | "pattern" | "none";
  domain: string | null;
}

const TITLE_KEYWORDS_BY_HINT: Record<string, string[]> = {
  default: ["Director of Recruiting", "VP of Recruiting", "Branch Manager", "Director of Operations", "Recruiting Manager"],
  branch: ["Branch Manager", "Branch Director", "Regional Director"],
  vp: ["VP of Recruiting", "Vice President", "VP Operations"],
  director: ["Director of Recruiting", "Director of Operations", "Strategic Partner"],
};

async function apolloPeopleSearch(domain: string, agencyName: string, titles: string[]): Promise<any | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({
        per_page: 5,
        page: 1,
        person_titles: titles,
        q_organization_domains: domain ? [domain] : undefined,
        organization_names: !domain ? [agencyName] : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data?.people || data?.contacts || [])[0];
    if (!hit) return null;
    return {
      first: hit.first_name || null,
      last: hit.last_name || null,
      title: hit.title || null,
      email: hit.email || null,
      linkedin: hit.linkedin_url || null,
      verified: !!hit.email && hit.email_status !== "unverified",
    };
  } catch (_) { return null; }
}

async function hunterDomainSearch(domain: string): Promise<any | null> {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&type=personal&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails || [];
    // Prefer recruiting / branch / director titles
    const ranked = emails
      .map((e: any) => ({
        ...e,
        score: rankTitle(e.position || ""),
      }))
      .sort((a: any, b: any) => b.score - a.score);
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

function rankTitle(t: string): number {
  const s = t.toLowerCase();
  if (/director of recruit|vp.*recruit|head of talent/.test(s)) return 100;
  if (/recruit/.test(s)) return 80;
  if (/branch manager|branch director|regional director/.test(s)) return 70;
  if (/director|vp|vice president/.test(s)) return 50;
  return 10;
}

let snovToken: { value: string; expiresAt: number } | null = null;
async function snovGetToken(): Promise<string | null> {
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET) return null;
  if (snovToken && snovToken.expiresAt > Date.now()) return snovToken.value;
  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: SNOV_CLIENT_ID,
        client_secret: SNOV_CLIENT_SECRET,
      }),
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
    const ranked = list
      .map((e: any) => ({ ...e, score: rankTitle(e.position || e.jobTitle || "") }))
      .sort((a: any, b: any) => b.score - a.score);
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

function patternGuess(domain: string, contactHint: string | null): any | null {
  if (!domain || !contactHint) return null;
  // We don't have a real name yet — pattern guess only works when we have a name.
  // Skip when no name is known.
  const parts = (contactHint || "").trim().split(/\s+/);
  if (parts.length < 2) return null;
  const first = parts[0].toLowerCase().replace(/[^a-z]/g, "");
  const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "");
  if (!first || !last) return null;
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    title: null,
    email: `${first}.${last}@${domain}`,
    linkedin: null,
    verified: false,
  };
}

async function resolveDomain(agencyName: string, providedDomain?: string): Promise<string | null> {
  if (providedDomain) return providedDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  // Try Apollo organization search to pull the canonical website
  if (APOLLO_API_KEY) {
    try {
      const res = await fetch("https://api.apollo.io/api/v1/organizations/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
        body: JSON.stringify({ q_organization_name: agencyName, per_page: 1 }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json();
        const org = (data?.organizations || [])[0];
        const site = org?.website_url || org?.primary_domain;
        if (site) return site.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
      }
    } catch (_) { /* ignore */ }
  }
  return null;
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
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    const domain = await resolveDomain(agency_name, provided_domain);
    trace.push(`domain:${domain || "none"}`);

    const result: ContactResult = {
      contact_first_name: null,
      contact_last_name: null,
      contact_full_name: null,
      contact_title: null,
      contact_email: null,
      contact_linkedin: null,
      email_status: "failed",
      source: "none",
      domain,
    };

    // Stage 1: Apollo
    const apollo = await apolloPeopleSearch(domain || "", agency_name, titles);
    trace.push(`apollo:${apollo?.email ? "hit" : "miss"}`);
    if (apollo?.email) {
      result.contact_first_name = apollo.first;
      result.contact_last_name = apollo.last;
      result.contact_full_name = [apollo.first, apollo.last].filter(Boolean).join(" ") || null;
      result.contact_title = apollo.title;
      result.contact_email = apollo.email;
      result.contact_linkedin = apollo.linkedin;
      result.email_status = apollo.verified ? "verified" : "guessed";
      result.source = "apollo";
    }

    // Stage 2: Hunter
    if (!result.contact_email && domain) {
      const hunter = await hunterDomainSearch(domain);
      trace.push(`hunter:${hunter?.email ? "hit" : "miss"}`);
      if (hunter?.email) {
        result.contact_first_name = hunter.first;
        result.contact_last_name = hunter.last;
        result.contact_full_name = [hunter.first, hunter.last].filter(Boolean).join(" ") || null;
        result.contact_title = hunter.title;
        result.contact_email = hunter.email;
        result.contact_linkedin = hunter.linkedin;
        result.email_status = hunter.verified ? "verified" : "guessed";
        result.source = "hunter";
      }
    }

    // Stage 3: Snov
    if (!result.contact_email && domain) {
      const snov = await snovDomainSearch(domain);
      trace.push(`snov:${snov?.email ? "hit" : "miss"}`);
      if (snov?.email) {
        result.contact_first_name = snov.first;
        result.contact_last_name = snov.last;
        result.contact_full_name = [snov.first, snov.last].filter(Boolean).join(" ") || null;
        result.contact_title = snov.title;
        result.contact_email = snov.email;
        result.contact_linkedin = snov.linkedin;
        result.email_status = snov.verified ? "verified" : "guessed";
        result.source = "snov";
      }
    }

    // Stage 4: pattern guess (only if we have a name from Apollo but no email)
    // Apollo sometimes returns names without emails — pattern-guess against the resolved domain.
    if (!result.contact_email && domain && apollo?.first && apollo?.last) {
      const guess = patternGuess(domain, `${apollo.first} ${apollo.last}`);
      trace.push(`pattern:${guess?.email ? "hit" : "miss"}`);
      if (guess?.email) {
        result.contact_first_name = guess.first;
        result.contact_last_name = guess.last;
        result.contact_full_name = `${guess.first} ${guess.last}`;
        result.contact_title = apollo.title;
        result.contact_email = guess.email;
        result.email_status = "guessed";
        result.source = "pattern";
      }
    }

    // Persist (upsert)
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
      meta: { trace, role_hint },
    }, { onConflict: "agency_name" });

    return new Response(JSON.stringify({ ok: true, cached: false, contact: result, trace }), {
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
