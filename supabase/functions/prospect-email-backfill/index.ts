// prospect-email-backfill — Backfill emails on idle prospect_pipeline rows
// Admin-triggered. Walks every prospect with no email + non-archived stage,
// applies the same Hunter → website-scrape waterfall used by contractor-prospector,
// and updates the row in place. Skips rows with no website.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") ?? "";

const log = (s: string, d?: unknown) =>
  console.log(`[email-backfill] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const BLOCKLIST = [
  "example.com","google.com","facebook.com","wix.com","squarespace.com","sentry.io","w3.org",
  "wixpress.com","domain.com","yoursite.com","yourdomain.com","test.com","placeholder",
  "wordpress.com","wordpress.org","github.com","jsdelivr","googleapis.com","gstatic.com",
  "cloudflare","schema.org","gravatar.com","fontawesome","googleusercontent.com",
  "creativecommons.org","mozilla.org","apple.com","microsoft.com","twitter.com",
  "instagram.com","linkedin.com","youtube.com","tiktok.com","pinterest.com","yelp.com",
  "bbb.org","angieslist.com","homeadvisor.com","thumbtack.com",
];
const BLOCKED_PREFIXES = [
  "user@","admin@","test@","noreply@","no-reply@","webmaster@","postmaster@",
  "name@","email@","someone@","nobody@","null@","root@","daemon@",
];

async function scrapeEmail(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();

    let siteDomain = "";
    try { siteDomain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase(); } catch {}

    const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
      .filter((e) => {
        const l = e.toLowerCase();
        if (BLOCKLIST.some((d) => l.includes(d))) return false;
        if (/\.(png|jpg|svg|js|css|gif|webp|woff|ttf|eot)$/i.test(l)) return false;
        if (l.length > 60 || l.length < 6) return false;
        const local = l.split("@")[0];
        if (local.length > 20 && /[0-9a-f]{8,}/.test(local)) return false;
        if (BLOCKED_PREFIXES.some((p) => l.startsWith(p))) return false;
        if (!/\.(com|net|org|biz|us|co|io|info|email)$/.test(l)) return false;
        return true;
      });

    if (!emails.length) return null;
    if (siteDomain) {
      const m = emails.find((e) => e.toLowerCase().endsWith(`@${siteDomain}`));
      if (m) return m;
    }
    const bizPrefixes = ["info@","contact@","office@","hello@","sales@","service@","mail@"];
    const biz = emails.find((e) => bizPrefixes.some((p) => e.toLowerCase().startsWith(p)));
    return biz || emails[0];
  } catch {
    return null;
  }
}

async function hunterDomainSearch(domain: string): Promise<{ email: string; confidence: number } | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${HUNTER_API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails || [];
    // Prefer highest confidence ≥ 50
    const sorted = emails
      .filter((e: any) => e.value && (e.confidence ?? 0) >= 50)
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0));
    if (!sorted.length) return null;
    return { email: sorted[0].value, confidence: sorted[0].confidence ?? 50 };
  } catch {
    return null;
  }
}

function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = raw.startsWith("http") ? raw : `https://${raw}`;
    new URL(u);
    return u;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await userClient.auth.getClaims(token);
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: claims.claims.sub, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 100);
  const dryRun = body.dry_run === true;

  // Idle prospects: no email, not archived, has a website
  const { data: prospects, error } = await supabase
    .from("prospect_pipeline")
    .select("id, business_name, website, industry")
    .is("email", null)
    .neq("pipeline_stage", "archived")
    .not("website", "is", null)
    .limit(limit);

  if (error) {
    log("query failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("processing", { count: prospects?.length ?? 0, dryRun });

  let scraped = 0, hunter = 0, skipped = 0;
  const results: any[] = [];

  for (const p of prospects ?? []) {
    const url = normalizeUrl(p.website || "");
    if (!url) { skipped++; continue; }

    let email: string | null = null;
    let source: "hunter" | "scrape" | null = null;
    let confidence = 0;

    // 1. Hunter domain search
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      const h = await hunterDomainSearch(domain);
      if (h) { email = h.email; source = "hunter"; confidence = h.confidence; hunter++; }
    } catch {}

    // 2. Site scrape fallback
    if (!email) {
      const e = await scrapeEmail(url);
      if (e) { email = e; source = "scrape"; confidence = 60; scraped++; }
    }

    if (!email) { skipped++; continue; }

    results.push({ id: p.id, business_name: p.business_name, email, source, confidence });

    if (!dryRun) {
      await supabase
        .from("prospect_pipeline")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("id", p.id);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: prospects?.length ?? 0,
      enriched: results.length,
      hunter_hits: hunter,
      scrape_hits: scraped,
      skipped,
      dry_run: dryRun,
      sample: results.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
