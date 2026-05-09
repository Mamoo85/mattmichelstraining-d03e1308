// Lightning Claim — Twilio inbound SMS webhook for contractor replies
// "CLAIM" → charges saved Stripe card $50, texts back homeowner contact
// "PASS" → marks lead as passed, opens to aged pool

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { verifyTwilioSignature } from "../_shared/webhook-verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

serve(async (req) => {
  const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

  if (req.method !== "POST") {
    return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") || "";
    const body = (params.get("Body") || "").trim().toUpperCase();

    console.log(`[contractor-sms] From ${from}: ${body}`);

    if (!from) {
      return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
    }

    // Match sender phone to a contractor
    const { data: contractor } = await sb
      .from("contractor_clients")
      .select("id, business_name, email, phone, stripe_customer_id, stripe_payment_method_id, dead_lead_billing_active")
      .eq("phone", from)
      .maybeSingle();

    if (!contractor) {
      console.log(`[contractor-sms] No contractor found for phone ${from}`);
      return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
    }

    if (body === "CLAIM") {
      // Find most recent unclaimed, notified lead for this contractor's territory
      const { data: sites } = await sb
        .from("contractor_lead_sites")
        .select("id")
        .eq("active_contractor_id", contractor.id);

      const siteIds = (sites || []).map((s: any) => s.id);
      if (siteIds.length === 0) {
        await sendSMS(from, TWILIO_PHONE, "No active territory found. Contact DWA support: (313) 992-1219", "contractor_leads");
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      const { data: lead } = await sb
        .from("contractor_leads")
        .select("id, name, phone, email, project_type, message")
        .in("site_id", siteIds)
        .is("claimed_at", null)
        .is("paid_by_contractor_id", null)
        .eq("status", "notified")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lead) {
        await sendSMS(from, TWILIO_PHONE, "No unclaimed leads available right now. We'll text you when the next one comes in!", "contractor_leads");
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      // Check if contractor has a saved payment method
      if (!contractor.stripe_payment_method_id || !contractor.stripe_customer_id) {
        await sendSMS(from, TWILIO_PHONE,
          `To use instant CLAIM, save your card first:\nhttps://www.detroitwebagent.com/dead-lead-intake\n\nOr claim online:\nhttps://www.detroitwebagent.com/claim-lead?lead_id=${lead.id}&contractor_id=${contractor.id}`,
          "contractor_leads"
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      // Charge $50 via Stripe
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
      try {
        const pi = await stripe.paymentIntents.create({
          amount: 5000,
          currency: "usd",
          customer: contractor.stripe_customer_id,
          payment_method: contractor.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Lightning Claim: Lead ${lead.name} (${lead.id.slice(0,8)})`,
          metadata: { type: "lightning_claim", lead_id: lead.id, contractor_id: contractor.id },
        }, {
          // Idempotency: duplicate inbound SMS (Twilio retries) must never double-charge
          idempotencyKey: `lightning-${lead.id}-${contractor.id}`,
        });

        if (pi.status !== "succeeded") {
          await sendSMS(from, TWILIO_PHONE, "Payment failed. Please update your card at detroitwebagent.com or call (313) 992-1219.", "contractor_leads");
          return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
        }
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error("[contractor-sms] Stripe charge failed:", msg);
        await sendSMS(from, TWILIO_PHONE, "Payment declined. Update your card or call (313) 992-1219.", "contractor_leads");
        // Notify Matt
        await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
          `⚠️ Lightning Claim FAILED for ${contractor.business_name}: ${msg}. Lead: ${lead.name}`,
          "contractor_leads"
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      // Mark lead as claimed
      await sb.from("contractor_leads").update({
        claimed_at: new Date().toISOString(),
        claimed_by: contractor.id,
        paid_by_contractor_id: contractor.id,
        payment_amount_cents: 5000,
        status: "sold",
      }).eq("id", lead.id);

      // Log purchase
      await sb.from("contractor_lead_purchases").insert({
        contractor_id: contractor.id,
        contractor_email: contractor.email,
        lead_id: lead.id,
        amount_cents: 5000,
      });

      // Text back the homeowner's info
      const project = lead.project_type ? ` (${lead.project_type})` : "";
      const emailLine = lead.email ? `\nEmail: ${lead.email}` : "";
      const msgLine = lead.message ? `\nMessage: "${lead.message}"` : "";
      await sendSMS(from, TWILIO_PHONE,
        `⚡ LEAD CLAIMED! $50 charged.\n\n${lead.name}${project}\nPhone: ${lead.phone}${emailLine}${msgLine}\n\nCALL THEM NOW — you have exclusivity.`,
        "contractor_leads"
      );

      // Notify Matt
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
        `💰 Lightning Claim! ${contractor.business_name} claimed ${lead.name} for $50 via SMS.`,
        "contractor_leads"
      );

      console.log(`[contractor-sms] Lightning Claim success: ${contractor.business_name} → ${lead.name}`);

    } else if (body === "PASS") {
      // Mark most recent notified lead as passed → opens to aged pool
      const { data: sites } = await sb
        .from("contractor_lead_sites")
        .select("id")
        .eq("active_contractor_id", contractor.id);

      const siteIds = (sites || []).map((s: any) => s.id);
      if (siteIds.length > 0) {
        const { data: lead } = await sb
          .from("contractor_leads")
          .select("id, name")
          .in("site_id", siteIds)
          .is("claimed_at", null)
          .is("paid_by_contractor_id", null)
          .eq("status", "notified")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lead) {
          await sb.from("contractor_leads").update({
            status: "passed",
            is_aged: true,
          }).eq("id", lead.id);

          await sendSMS(from, TWILIO_PHONE,
            `Lead ${lead.name} passed. It will be offered to other contractors at a reduced price. We'll text you when the next lead comes in!`,
            "contractor_leads"
          );
        } else {
          await sendSMS(from, TWILIO_PHONE, "No pending leads to pass on right now.", "contractor_leads");
        }
      }

    } else {
      // Unknown command — helpful reply
      await sendSMS(from, TWILIO_PHONE,
        `DWA Lead Engine: Reply CLAIM to instantly buy your latest lead ($50) or PASS to skip it. Questions? Call (313) 992-1219.`,
        "contractor_leads"
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-sms] Error:", msg);
  }

  return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
});
