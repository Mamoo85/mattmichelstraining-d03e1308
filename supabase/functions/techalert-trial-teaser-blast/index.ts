// techalert-trial-teaser-blast — auto-paced cold email blast to enriched
// outreach_leads. Generates a per-prospect 7-day no-card trial magic link
// via start-radar-trial, sends through DWA email with CAN-SPAM footer.
// Default daily cap: 30/day (ramps via cold-email-ramp-scheduler).
//
// POST { limit?: number, dry_run?: boolean, products?: string[] }
//   products defaults to ["techalert"]; pass multiple for AmeriSteel-style bundles.
//
// Compliance: hits outreach-blocklist + email-suppression before every send.

import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_CAP = Number(Deno.env.get("TEASER_BLAST_DAILY_CAP") || "30");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit || DAILY_CAP), 250);
  const dryRun = !!body.dry_run;
  const products: string[] = Array.isArray(body.products) && body.products.length ? body.products : ["techalert"];

  // Pull best enriched prospects, no prior teaser send.
  const { data: leads, error } = await sb
    .from("outreach_leads")
    .select("id, owner_email, owner_name, business_name, city, website")
    .not("owner_email", "is", null)
    .not("enriched_at", "is", null)
    .is("teaser_sent_at", null)
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0; let skipped = 0; let failed = 0;
  const events: any[] = [];

  // Email sanity filter — reject obvious garbage from scraped directory pages.
  const DIRECTORY_DOMAINS = new Set([
    "localedge.com","yellowpages.com","yelp.com","manta.com","superpages.com",
    "merchantcircle.com","bbb.org","mapquest.com","foursquare.com","houzz.com",
    "thomasnet.com","angi.com","homeadvisor.com","thumbtack.com","porch.com",
    "nextdoor.com","zoominfo.com","dnb.com","corporationwiki.com","opengovus.com",
    "sam.gov","yellowbook.com","cylex.us.com","brownbook.net","tupalo.co",
    "ezlocal.com","cybo.com","tradeford.com","exportersindia.com","example.com",
    "gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com",
  ]);
  function emailLooksValid(e: string): boolean {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return false;
    if (/[%<>"'\\]/.test(e)) return false;          // url-encoded / scrape garbage
    if (e.length > 80) return false;
    const domain = e.split("@")[1].toLowerCase();
    if (DIRECTORY_DOMAINS.has(domain)) return false;
    if (domain.split(".").length > 3) return false; // weird sub-sub-subdomains
    if (/[^a-z0-9.\-]/.test(domain)) return false;
    return true;
  }

  for (const lead of leads || []) {
    const email = (lead.owner_email || "").toLowerCase().trim();

    if (!emailLooksValid(email)) { skipped++; events.push({ email, action: "skipped_invalid" }); continue; }

    // Suppression check
    const { data: sup } = await sb.from("suppressed_emails").select("email").eq("email", email).maybeSingle();
    if (sup) { skipped++; continue; }

    if (dryRun) { events.push({ email, action: "would_send" }); continue; }

    // Provision trial(s)
    let magicUrl: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/start-multi-product-trial`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          products,
          business_name: lead.business_name,
          phone: null,
          city: lead.city,
          state: "MI",
          source: "techalert_teaser_blast",
        }),
      });
      const j = await r.json();
      magicUrl = j.summary_url || j.products?.[0]?.magic_url || null;
    } catch { /* fall through */ }

    if (!magicUrl) { failed++; continue; }

    const firstName = (lead.owner_name || "").split(" ")[0] || "there";
    const biz = lead.business_name || "your shop";
    const inner = `
      <h1 style="color:#00d4ff;font-size:22px;margin:0 0 14px;">Hey ${firstName} — built you a 7-day preview</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        I run Detroit Web Agency. We monitor hiring activity at competitor shops in your area
        and surface skilled trades workers who just became available — before they hit the job boards.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        I pre-loaded a dashboard for ${biz}. <strong>7 days, no credit card.</strong>
        See who's available in your zip codes, then decide.
      </p>
      <p style="margin:18px 0 0;font-size:13px;color:#a8b8d0;">
        Reply STOP to opt out. Detroit Web Agency, Grosse Pointe MI 48230.
      </p>
    `;
    const html = dwaWrap(inner, { ctaText: "Open my preview dashboard →", ctaUrl: magicUrl });

    const send = await dwaEmail({
      to: email,
      subject: `${firstName}, 3 trades workers just left a competitor near ${biz}`,
      html,
    });

    if (send.ok) {
      sent++;
      await sb.from("outreach_leads").update({
        teaser_sent_at: new Date().toISOString(),
        teaser_magic_url: magicUrl,
      }).eq("id", lead.id);
    } else {
      failed++;
    }

    // Pace: ~1.2s between sends
    await new Promise((r) => setTimeout(r, 1200));
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed, dry_run: dryRun, total_candidates: leads?.length ?? 0, events: dryRun ? events : undefined }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
