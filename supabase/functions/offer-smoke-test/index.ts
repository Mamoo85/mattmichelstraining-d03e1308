// Phase 1 deliverable: fire one cold email + one SMS per requested product so
// Matt can eyeball-confirm copy + price + link match the canonical offer
// in <_shared/offers.ts>. Fax + postcard + Meta ad drafts are returned as
// rendered text (no provider send) since those are slow/expensive to fire
// for a smoke check.
//
// Auth: caller must include the Supabase service role token in the
// Authorization header (matches our other admin-only functions). Public
// JWT is rejected.
//
// Usage:
//   POST /functions/v1/offer-smoke-test
//   { "products": ["mortgage_radar","field_desk"], "to_email": "matt@…",
//     "to_phone": "+1313…", "campaign": "phase1-smoke" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { OFFERS, type ProductKey, offerCopy } from "../_shared/offers.ts";
import { buildCta } from "../_shared/offer-url.ts";
import { offerPromptBlock } from "../_shared/offer-ad-prompt.ts";
import { dwaEmail, DWA_TEAL, DWA_BG } from "../_shared/dwa-email.ts";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  products?: ProductKey[];
  to_email?: string;
  to_phone?: string;
  campaign?: string;
}

function emailHtml(productKey: ProductKey, campaign: string): string {
  const cta = buildCta(productKey, { channel: "email", campaign });
  const offer = OFFERS[productKey];
  return `
<!doctype html><html><body style="margin:0;background:${DWA_BG};font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf3;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${DWA_TEAL};font-weight:800;">[SMOKE TEST] ${offer.displayName}</div>
    <h1 style="font-size:26px;line-height:1.2;margin:14px 0 12px;font-weight:900;">${cta.headline}</h1>
    <p style="font-size:15px;line-height:1.55;color:#c9d1d9;margin:0 0 20px;">${cta.shortPitch}</p>
    <p style="margin:0 0 24px;">
      <a href="${cta.url}" style="display:inline-block;background:${DWA_TEAL};color:${DWA_BG};font-weight:800;padding:14px 22px;text-decoration:none;border-radius:8px;">${cta.ctaLabel} →</a>
    </p>
    <div style="border-top:1px solid #1f2937;padding-top:16px;font-size:12px;color:#7d8590;line-height:1.5;">
      Price: $${(offer.monthlyPriceCents / 100).toFixed(0)}/mo &middot; CTA URL: ${cta.url}<br/>
      QR (for printed assets): <a href="${cta.qrUrl}" style="color:${DWA_TEAL};">view QR</a><br/>
      — Matt, Detroit Web Agency · (313) 992-1219
    </div>
  </div>
</body></html>`;
}

function smsBody(productKey: ProductKey, campaign: string): string {
  const cta = buildCta(productKey, { channel: "sms", campaign });
  return `[SMOKE] ${cta.productName}: ${cta.headline} ${cta.url} — Reply STOP to opt out.`;
}

function postcardCopy(productKey: ProductKey, campaign: string) {
  const cta = buildCta(productKey, { channel: "postcard", campaign });
  return {
    front_headline: cta.headline,
    back_body: `${cta.shortPitch}\n\nScan QR or visit: ${cta.url}\n— Matt · Detroit Web Agency · (313) 992-1219`,
    qr_url: cta.qrUrl,
    cta_url: cta.url,
  };
}

function faxCopy(productKey: ProductKey, campaign: string) {
  const cta = buildCta(productKey, { channel: "fax", campaign });
  return {
    cover_subject: `${cta.productName} — ${cta.headline}`,
    body: `${cta.shortPitch}\n\nGet started: ${cta.url}\n\nMatt Michels · Detroit Web Agency · (313) 992-1219`,
    cta_url: cta.url,
  };
}

function adDraft(productKey: ProductKey, campaign: string) {
  return {
    meta_prompt_block: offerPromptBlock(productKey, campaign),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role gate
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(SERVICE_ROLE)) {
    return new Response(JSON.stringify({ error: "service-role required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ReqBody = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const products: ProductKey[] = body.products?.length
    ? body.products
    : ["mortgage_radar", "field_desk", "site_radar", "missed_call_catch", "phone_answering", "bundle_revenue_suite", "trade_radar"];
  const toEmail = body.to_email || "matt@detroitwebagent.com";
  const toPhone = body.to_phone || "+13138064952";
  const campaign = body.campaign || "phase1-smoke";

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: Array<Record<string, unknown>> = [];

  for (const productKey of products) {
    if (!OFFERS[productKey]) {
      results.push({ productKey, error: "unknown product key" });
      continue;
    }
    const html = emailHtml(productKey, campaign);
    const sms = smsBody(productKey, campaign);

    const [emailRes, smsRes] = await Promise.all([
      dwaEmail({ to: toEmail, subject: `[SMOKE] ${OFFERS[productKey].displayName} — offer preview`, html }),
      sendSMS(toPhone, Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219", sms, "offer_smoke_test").catch((e: Error) => ({ success: false, error: e.message })),
    ]);

    results.push({
      productKey,
      offer: offerCopy(productKey),
      email: emailRes,
      sms: smsRes,
      postcard: postcardCopy(productKey, campaign),
      fax: faxCopy(productKey, campaign),
      ad: adDraft(productKey, campaign),
    });
  }

  // Audit log (best-effort)
  await sb.from("agent_heartbeats").upsert({
    agent_name: "offer-smoke-test",
    last_run_at: new Date().toISOString(),
    last_status: "ok",
    last_payload: { campaign, products, count: results.length },
  }, { onConflict: "agent_name" }).then(() => {}, () => {});

  return new Response(JSON.stringify({ ok: true, campaign, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
