/**
 * sell-lead-alacarte
 * Admin-only. Creates an "à la carte" lead offer:
 *   1. Picks N candidate contractors from prospect_pool (matching trade, has phone or email)
 *      OR uses the explicit prospect_ids the admin chose.
 *   2. Creates a Stripe one-time payment Checkout Session that points to the offer.
 *   3. Logs the offer in lead_alacarte_offers.
 *   4. Sends SMS / email to each candidate with a personalized payment link.
 *      The first one to pay wins (claim_alacarte_lead RPC).
 *
 * POST { lead_id: uuid, price_cents: number, prospect_ids?: string[],
 *        max_candidates?: number=3, channels?: ("sms"|"email")[]=["sms","email"] }
 *  → { ok, offer_id, payment_link, sent: { sms: n, email: n }, candidates: [...] }
 *
 * Stripe webhook (checkout.session.completed) calls claim_alacarte_lead via
 * stripe-webhook routing on metadata.type === "alacarte_lead_purchase".
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "sms" | "email";

interface Body {
  lead_id: string;
  price_cents: number;
  prospect_ids?: string[];
  max_candidates?: number;
  channels?: Channel[];
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[sell-lead-alacarte resend]", e instanceof Error ? e.message : String(e));
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = (await req.json()) as Body;
    if (!body?.lead_id || !isUuid(body.lead_id)) {
      return new Response(JSON.stringify({ ok: false, error: "lead_id (uuid) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const priceCents = Math.floor(Number(body.price_cents));
    if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 100000) {
      return new Response(JSON.stringify({ ok: false, error: "price_cents must be 100..100000" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const channels: Channel[] = body.channels?.length ? body.channels : ["sms", "email"];
    const maxCandidates = Math.min(Math.max(Number(body.max_candidates) || 3, 1), 10);

    // 1. Load the lead + its territory
    const { data: lead, error: leadErr } = await sb
      .from("contractor_leads")
      .select("id, name, phone, email, project_type, message, site_id, status, claimed_at, contractor_lead_sites(trade, city, slug)")
      .eq("id", body.lead_id)
      .maybeSingle();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ ok: false, error: "lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lead.claimed_at) {
      return new Response(JSON.stringify({ ok: false, error: "lead already claimed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const territory = (lead as any).contractor_lead_sites;
    const trade = territory?.trade ?? "contractor";
    const city = territory?.city ?? "your area";

    // 2. Pick candidate contractors
    let candidates: any[] = [];
    if (body.prospect_ids?.length) {
      const ids = body.prospect_ids.filter(isUuid).slice(0, maxCandidates);
      const { data } = await sb
        .from("prospect_pool")
        .select("id, business_name, contact_name, email, phone, city, state")
        .in("id", ids);
      candidates = data ?? [];
    } else {
      const tradeNeedle = `%${trade.toLowerCase()}%`;
      const { data } = await sb
        .from("prospect_pool")
        .select("id, business_name, contact_name, email, phone, city, state, audience_type")
        .or(`audience_type.ilike.${tradeNeedle},business_name.ilike.${tradeNeedle}`)
        .or("phone.not.is.null,email.not.is.null")
        .neq("status", "suppressed")
        .limit(50);
      // Prefer prospects in the same city, then any with phone, then any with email
      const ranked = (data ?? []).slice().sort((a: any, b: any) => {
        const sameCity = (p: any) => (p.city ?? "").toLowerCase() === city.toLowerCase() ? 1 : 0;
        const score = (p: any) => sameCity(p) * 10 + (p.phone ? 5 : 0) + (p.email ? 2 : 0);
        return score(b) - score(a);
      });
      candidates = ranked.slice(0, maxCandidates);
    }
    if (!candidates.length) {
      return new Response(JSON.stringify({ ok: false, error: "no candidate contractors found in prospect_pool for this trade" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Create the offer row first (so we have an offer_id for the metadata)
    const { data: offer, error: offerErr } = await sb
      .from("lead_alacarte_offers")
      .insert({
        lead_id: lead.id,
        candidate_prospect_ids: candidates.map((c) => c.id),
        candidate_channels: [],
        price_cents: priceCents,
        status: "open",
      })
      .select("id, expires_at")
      .single();
    if (offerErr || !offer) throw new Error(offerErr?.message || "could not create offer");

    // 4. Create the Stripe Checkout Session (single, reusable URL via Payment Link)
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Exclusive ${trade} lead — ${city}`,
            description: `${lead.name} · ${lead.project_type ?? "Project request"}. First contractor to pay gets the homeowner's contact. Offer expires ${new Date(offer.expires_at).toLocaleString()}.`,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/contractor-leads/claimed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/contractor-leads/${territory?.slug ?? ""}`,
      metadata: {
        type: "alacarte_lead_purchase",
        offer_id: offer.id,
        lead_id: lead.id,
        trade,
        city,
      },
      allow_promotion_codes: false,
    });

    // Update offer with the checkout URL so candidates all share the same link
    await sb.from("lead_alacarte_offers")
      .update({ stripe_session_id: session.id, stripe_payment_link: session.url })
      .eq("id", offer.id);

    // 5. Notify candidates via SMS + email
    const sent = { sms: 0, email: 0 };
    const channelLog: any[] = [];
    const smsBody = `🚨 ${trade} lead in ${city}: ${(lead.project_type || "project").slice(0, 60)}. $${(priceCents/100).toFixed(0)} to claim — first to pay wins. ${session.url}`;
    const emailHtml = `
      <h2>Exclusive ${trade} lead in ${city}</h2>
      <p><b>Project:</b> ${lead.project_type ?? "Not specified"}</p>
      <p><b>Notes:</b> ${lead.message ?? "—"}</p>
      <p><b>Price:</b> $${(priceCents/100).toFixed(0)} — first contractor to pay gets the homeowner's name, phone, and email immediately.</p>
      <p><a href="${session.url}" style="display:inline-block;padding:12px 20px;background:#00d4ff;color:#0a1628;font-weight:bold;text-decoration:none;border-radius:6px">Claim this lead — $${(priceCents/100).toFixed(0)}</a></p>
      <p style="color:#64748b;font-size:12px">Offer expires ${new Date(offer.expires_at).toLocaleString()}. Detroit Web Agency · matt@detroitwebagent.com</p>
    `;

    for (const c of candidates) {
      if (channels.includes("sms") && c.phone) {
        const r: any = await sendSMS(c.phone, TWILIO_FROM, smsBody, "alacarte_lead", false);
        if (r?.success) {
          sent.sms++;
          channelLog.push({ prospect_id: c.id, channel: "sms", recipient: c.phone, sent_at: new Date().toISOString() });
        } else {
          channelLog.push({ prospect_id: c.id, channel: "sms", recipient: c.phone, sent_at: null, error: r?.error ?? "sms_failed" });
        }
      }
      if (channels.includes("email") && c.email && isEmail(c.email)) {
        const ok = await sendEmailViaResend(c.email, `🚨 ${trade} lead in ${city} — $${(priceCents/100).toFixed(0)} to claim`, emailHtml);
        if (ok) {
          sent.email++;
          channelLog.push({ prospect_id: c.id, channel: "email", recipient: c.email, sent_at: new Date().toISOString() });
        } else {
          channelLog.push({ prospect_id: c.id, channel: "email", recipient: c.email, sent_at: null, error: "email_failed" });
        }
      }
    }

    await sb.from("lead_alacarte_offers")
      .update({ candidate_channels: channelLog })
      .eq("id", offer.id);

    return new Response(JSON.stringify({
      ok: true,
      offer_id: offer.id,
      payment_link: session.url,
      sent,
      candidates: candidates.map((c) => ({ id: c.id, business_name: c.business_name, has_phone: !!c.phone, has_email: !!c.email })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[sell-lead-alacarte]", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
