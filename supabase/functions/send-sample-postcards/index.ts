/**
 * send-sample-postcards — Sends 5 sample postcards to MATT'S HOME ADDRESS.
 * Each postcard uses real prospect data for personalization, but mailing
 * address is overridden to Matt's house. Logs to sample_sends table.
 *
 * POST { audiences?: string[], dry_run?: boolean }
 *   defaults audiences = [healthcare_staffing, nursing_home, trades_staffing, hvac, supply_house]
 *
 * Reads MATT_HOME_ADDRESS_LINE1, _LINE2, _CITY, _STATE, _ZIP from secrets.
 * Uses Lob test mode if LOB_API_KEY starts with 'test_'.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

const HOME = {
  line1: Deno.env.get("MATT_HOME_ADDRESS_LINE1") || "",
  line2: Deno.env.get("MATT_HOME_ADDRESS_LINE2") || "",
  city: Deno.env.get("MATT_HOME_CITY") || "",
  state: Deno.env.get("MATT_HOME_STATE") || "MI",
  zip: Deno.env.get("MATT_HOME_ZIP") || "",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_ADDR = {
  name: "Matt Michels — Detroit Web Agency",
  address_line1: "1 Kercheval Ave",
  address_city: "Grosse Pointe Farms",
  address_state: "MI",
  address_zip: "48236",
  address_country: "US",
};

interface AudienceTemplate {
  audience: string;
  service: string;
  promise: string;
  qrUrl: string;
  headlineFor: (name: string) => string;
}

const TEMPLATES: Record<string, AudienceTemplate> = {
  healthcare_staffing: {
    audience: "healthcare_staffing",
    service: "TechAlert Healthcare — daily CNA / RN / LPN candidate alerts",
    promise: "First 10 candidate names FREE. If even one doesn't pan out, you don't pay.",
    qrUrl: "https://detroitwebagent.com/hire-alert?industry=healthcare&src=postcard",
    headlineFor: (name) => `${name}: 1,200+ Michigan CNAs/RNs available right now.`,
  },
  nursing_home: {
    audience: "nursing_home",
    service: "TechAlert + Demand Radar — fill open shifts before your staffing rating drops",
    promise: "Free 14-day trial. I'll send you 5 qualified candidates this week — at no cost.",
    qrUrl: "https://detroitwebagent.com/hire-alert?industry=nursing_home&src=postcard",
    headlineFor: (name) => `${name}: Stop losing CMS stars to staffing gaps.`,
  },
  trades_staffing: {
    audience: "trades_staffing",
    service: "TechAlert Trades — daily HVAC, plumbing, electrical license alerts from MI MIOSHA",
    promise: "First month FREE. Cancel anytime. I'll prove the data is fresher than Indeed.",
    qrUrl: "https://detroitwebagent.com/hire-alert?industry=trades&src=postcard",
    headlineFor: (name) => `${name}: We see new MI tradesmen the day their license posts.`,
  },
  hvac: {
    audience: "hvac",
    service: "FieldDesk + TechAlert bundle — dispatch, mobile tech app, hiring alerts",
    promise: "Side-by-side demo against your current CRM. If we don't win, I'll buy you lunch.",
    qrUrl: "https://detroitwebagent.com/field-service?src=postcard",
    headlineFor: (name) => `${name}: Replace your $400/mo Outlook plugin for $199.`,
  },
  supply_house: {
    audience: "supply_house",
    service: "Demand Radar — see which contractors near you just won bids (before your reps do)",
    promise: "30-day pilot, free. I'll show you 10 buying signals in your county this week.",
    qrUrl: "https://detroitwebagent.com/industry-pulse?src=postcard",
    headlineFor: (name) => `${name}: Your reps are calling the wrong contractors.`,
  },
  general_contractor: {
    audience: "general_contractor",
    service: "FieldDesk + dead-lead reactivation — close jobs you already quoted",
    promise: "$50 only when an old quote replies YES. No reply, no charge.",
    qrUrl: "https://detroitwebagent.com/dead-lead-intake?src=postcard",
    headlineFor: (name) => `${name}: Your old quotes are worth $50 each — paid only on results.`,
  },
  industrial_mfg: {
    audience: "industrial_mfg",
    service: "TechAlert + FieldDesk for plant maintenance hiring & dispatch",
    promise: "Free site visit. I'll show you 5 candidates you don't have yet.",
    qrUrl: "https://detroitwebagent.com/hire-alert?industry=industrial&src=postcard",
    headlineFor: (name) => `${name}: New machinist & maintenance leads, daily.`,
  },
  senior_care: {
    audience: "senior_care",
    service: "TechAlert Healthcare — home health aide & CNA daily alerts",
    promise: "5 free candidate names this week. Zero risk.",
    qrUrl: "https://detroitwebagent.com/hire-alert?industry=senior_care&src=postcard",
    headlineFor: (name) => `${name}: Stop posting jobs. Start receiving applicants.`,
  },
};

function buildPostcardHtml(prospect: any, t: AudienceTemplate, side: "front" | "back"): string {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(t.qrUrl)}`;
  if (side === "front") {
    return `<html><head><meta charset="utf-8"><style>
      @page { size: 6in 4.25in; margin: 0; }
      body { width: 6in; height: 4.25in; margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; background: #0a1628; color: #fff; padding: 0.3in; box-sizing: border-box; position: relative; }
      .badge { position: absolute; top: 0.2in; right: 0.2in; background: #00d4ff; color: #0a1628; padding: 0.05in 0.15in; font-weight: 800; font-size: 9pt; border-radius: 4px; letter-spacing: 0.5px; }
      h1 { font-size: 22pt; line-height: 1.05; margin: 0.4in 0 0.15in; max-width: 4.6in; }
      .accent { color: #00d4ff; }
      .pitch { font-size: 11pt; line-height: 1.3; max-width: 4.4in; margin: 0; opacity: 0.9; }
      .qrwrap { position: absolute; bottom: 0.25in; right: 0.25in; background: #fff; padding: 0.05in; border-radius: 4px; }
      .qrwrap img { width: 0.9in; height: 0.9in; display: block; }
      .qr-label { position: absolute; bottom: 0.1in; right: 0.25in; width: 1in; text-align: center; font-size: 7pt; opacity: 0.7; }
    </style></head><body>
      <div class="badge">DETROIT WEB AGENCY</div>
      <h1>${t.headlineFor(prospect.business_name).replace(/<[^>]+>/g, "")}</h1>
      <p class="pitch">${t.service}</p>
      <p class="pitch" style="margin-top:0.15in"><strong class="accent">My promise:</strong> ${t.promise}</p>
      <div class="qrwrap"><img src="${qrSrc}" alt="QR"></div>
    </body></html>`;
  }
  return `<html><head><meta charset="utf-8"><style>
    @page { size: 6in 4.25in; margin: 0; }
    body { width: 6in; height: 4.25in; margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 0.25in; box-sizing: border-box; color: #0a1628; }
    .from { font-size: 8pt; color: #555; }
    .signed { margin-top: 0.2in; font-size: 10pt; }
    .signed strong { color: #0a1628; }
    .phone { font-size: 14pt; font-weight: 800; color: #00557a; margin-top: 0.05in; }
    .ask { margin-top: 0.2in; font-size: 11pt; line-height: 1.3; max-width: 3.4in; }
  </style></head><body>
    <div class="from">From: Matt Michels<br/>Detroit Web Agency<br/>Grosse Pointe, MI</div>
    <div class="ask">Hey ${prospect.contact_name || "there"} — I built this for businesses like ${prospect.business_name}. Scan the QR or call me direct. I'll prove it works in 10 minutes.</div>
    <div class="signed"><strong>Matt Michels</strong> · Founder, DWA<br/>matt@detroitwebagent.com</div>
    <div class="phone">📞 (313) 992-1219</div>
  </body></html>`;
}

async function lobCreatePostcard(prospect: any, t: AudienceTemplate): Promise<{ id: string; cost: number; error?: string }> {
  if (!LOB_API_KEY) return { id: "no_key", cost: 0, error: "LOB_API_KEY missing" };
  const auth = "Basic " + btoa(`${LOB_API_KEY}:`);
  const front = buildPostcardHtml(prospect, t, "front");
  const back = buildPostcardHtml(prospect, t, "back");

  const formData = new URLSearchParams();
  formData.append("description", `SAMPLE-${t.audience}-${prospect.business_name}`.slice(0, 250));
  formData.append("to[name]", "Matt Michels");
  formData.append("to[address_line1]", HOME.line1);
  if (HOME.line2) formData.append("to[address_line2]", HOME.line2);
  formData.append("to[address_city]", HOME.city);
  formData.append("to[address_state]", HOME.state);
  formData.append("to[address_zip]", HOME.zip);
  formData.append("to[address_country]", "US");
  formData.append("from[name]", FROM_ADDR.name);
  formData.append("from[address_line1]", FROM_ADDR.address_line1);
  formData.append("from[address_city]", FROM_ADDR.address_city);
  formData.append("from[address_state]", FROM_ADDR.address_state);
  formData.append("from[address_zip]", FROM_ADDR.address_zip);
  formData.append("from[address_country]", FROM_ADDR.address_country);
  formData.append("front", front);
  formData.append("back", back);
  formData.append("size", "6x4");

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[lob] err", res.status, json);
    return { id: "lob_error", cost: 0, error: json?.error?.message || `HTTP ${res.status}` };
  }
  return { id: json.id || "no_id", cost: 85 }; // ~$0.85
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const audiences: string[] = body.audiences || [
      "healthcare_staffing", "nursing_home", "trades_staffing", "hvac", "supply_house",
    ];
    const dryRun = body.dry_run === true;

    if (!HOME.line1 || !HOME.city || !HOME.zip) {
      return new Response(JSON.stringify({ error: "MATT_HOME_ADDRESS_* secrets not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const batchId = crypto.randomUUID();
    const results: any[] = [];

    for (const aud of audiences) {
      const t = TEMPLATES[aud];
      if (!t) { results.push({ audience: aud, error: "no_template" }); continue; }

      // Pick top-scored prospect for this audience that has an address
      const { data: pros } = await sb.from("prospect_pool")
        .select("*")
        .eq("audience_type", aud)
        .not("address_line1", "is", null)
        .order("lead_score", { ascending: false })
        .limit(1);

      const prospect = pros?.[0];
      if (!prospect) {
        // Fall back to any prospect of this audience
        const { data: any } = await sb.from("prospect_pool").select("*").eq("audience_type", aud).limit(1);
        if (!any?.[0]) { results.push({ audience: aud, error: "no_prospect_in_pool" }); continue; }
        results.push({ audience: aud, error: "no_prospect_with_address", fallback: any[0]?.business_name });
        continue;
      }

      if (dryRun) {
        results.push({ audience: aud, prospect: prospect.business_name, dry_run: true });
        continue;
      }

      const lob = await lobCreatePostcard(prospect, t);
      await sb.from("sample_sends").insert({
        batch_id: batchId,
        channel: "postcard",
        prospect_id: prospect.id,
        audience_type: aud,
        recipient_label: "Matt's house",
        provider_id: lob.id,
        cost_cents: lob.cost,
        status: lob.error ? "error" : "sent",
        meta: { error: lob.error, prospect_name: prospect.business_name },
      });
      results.push({ audience: aud, prospect: prospect.business_name, provider_id: lob.id, error: lob.error });
    }

    const totalCost = results.reduce((s, r) => s + (r.error ? 0 : 85), 0);
    return new Response(JSON.stringify({ ok: true, batch_id: batchId, total_cost_cents: totalCost, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-sample-postcards]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
