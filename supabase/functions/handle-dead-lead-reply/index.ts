// handle-dead-lead-reply — Twilio inbound SMS webhook
// Routes incoming replies from dead lead contacts to the right action:
//   YES/positive  → instant SMS to contractor with lead info + $50 tab notice
//   HARD_NO       → Google review ask (white-labeled from contractor)
//   OPT_OUT       → insert to sms_opt_outs, mark contact opted_out

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

async function chargeContractor(
  sb: ReturnType<typeof createClient>,
  contactId: string,
  contractorId: string,
  stripeCustomerId: string,
  paymentMethodId: string,
  leadName: string
): Promise<void> {
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: "5000",
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: "true",
      off_session: "true",
      description: `Dead Lead Revived — ${leadName}`,
      "metadata[contact_id]": contactId,
      "metadata[contractor_id]": contractorId,
    }),
  });
  const pi = await res.json();
  await (sb as any).from("dead_lead_charges").insert({
    contact_id: contactId,
    contractor_id: contractorId,
    amount_cents: 5000,
    stripe_payment_intent_id: pi.id,
    status: pi.status === "succeeded" ? "succeeded" : pi.error ? "failed" : "pending",
    error_message: pi.error?.message || null,
  });
  console.log(`[handle-dead-lead-reply] charge ${pi.id} status=${pi.status}`);
}

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end", "remove"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Twilio sends form-encoded body
    const text = await req.text();
    const params = new URLSearchParams(text);
    const fromPhone = params.get("From") || "";
    const replyBody = (params.get("Body") || "").trim();

    if (!fromPhone || !replyBody) {
      return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
    }

    // ── ADMIN A/B CAMPAIGN RESUME ─────────────────────────────────────────
    // Matt texts "A" or "B" to select copy variant and resume a paused campaign.
    // His phone can never match a dead_lead_contacts row, so this is safe.
    if (fromPhone === ADMIN_PHONE) {
      const cmd = replyBody.toUpperCase().trim();
      if (cmd === "A" || cmd === "B") {
        // Find the most recently paused campaign
        const { data: pausedCampaign } = await sb
          .from("dead_lead_campaigns" as any)
          .select("id, trade, contractor_clients(business_name)")
          .eq("status", "paused")
          .order("paused_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pausedCampaign) {
          // Mark selected variant and resume campaign in parallel
          await Promise.all([
            sb.from("campaign_copy_variants" as any)
              .update({ selected: true, selected_at: new Date().toISOString() })
              .eq("campaign_id", pausedCampaign.id)
              .eq("variant_label", cmd),
            sb.from("dead_lead_campaigns" as any)
              .update({ status: "active", pause_reason: null, paused_at: null })
              .eq("id", pausedCampaign.id),
          ]);

          // Reset drip3_sent contacts back to pending so they re-enter new sequence
          await sb
            .from("dead_lead_contacts" as any)
            .update({ status: "pending", drip1_sent_at: null, drip2_sent_at: null, drip3_sent_at: null })
            .eq("campaign_id", pausedCampaign.id)
            .eq("status", "drip3_sent");

          const bizName = (pausedCampaign as any).contractor_clients?.business_name || "Unknown";
          const trade = (pausedCampaign as any).trade || "service";
          await sendSMS(
            ADMIN_PHONE,
            TWILIO_PHONE_NUMBER,
            `DWA-OP: Resumed "${bizName}" (${trade}) with Variant ${cmd}. Exhausted contacts re-queued with new copy.`,
            "dwa_operator"
          );
        } else {
          await sendSMS(
            ADMIN_PHONE,
            TWILIO_PHONE_NUMBER,
            `DWA-OP: No paused campaigns found to resume.`,
            "dwa_operator"
          );
        }
      }
      return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
    }

    // Find the most recent active drip contact with this phone
    const { data: contact } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(trade, contractor_id, contractor_clients(id, business_name, phone, email, google_review_link, stripe_customer_id, stripe_payment_method_id, dead_lead_billing_active))")
      .eq("phone", fromPhone)
      .in("status", ["drip1_sent", "drip2_sent", "drip3_sent"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!contact) {
      // Not a dead lead contact — ignore
      return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
    }

    const campaign = (contact as any).dead_lead_campaigns;
    const contractor = (campaign as any).contractor_clients;
    const trade = campaign?.trade || "service";
    const bizName = contractor?.business_name || "your contractor";

    // ── OPT-OUT ───────────────────────────────────────────────────────────
    if (OPT_OUT_KEYWORDS.includes(replyBody.toLowerCase())) {
      await Promise.all([
        sb.from("dead_lead_contacts" as any).update({ status: "opted_out", reply_text: replyBody }).eq("id", contact.id),
        sb.from("sms_opt_outs").upsert({ phone: fromPhone, source: "dead_lead_reply" }),
      ]);
      return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
    }

    // ── AI CLASSIFICATION ─────────────────────────────────────────────────
    let classification = "unknown";
    if (ANTHROPIC_API_KEY) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 10,
            messages: [{
              role: "user",
              content: `Classify this SMS reply from a homeowner who was asked if they still need ${trade} work. Reply with exactly one word: POSITIVE, HARD_NO, or UNKNOWN.\n\nReply: "${replyBody}"`,
            }],
          }),
        });
        const aiData = await aiRes.json();
        const raw = aiData.content?.[0]?.text?.trim().toUpperCase() || "UNKNOWN";
        if (raw.includes("POSITIVE")) classification = "POSITIVE";
        else if (raw.includes("HARD_NO") || raw.includes("NO")) classification = "HARD_NO";
        else classification = "UNKNOWN";
      } catch { classification = "UNKNOWN"; }
    } else {
      // Fallback: keyword detection
      const lower = replyBody.toLowerCase();
      if (lower.includes("yes") || lower.includes("still") || lower.includes("need") || lower.includes("interested")) {
        classification = "POSITIVE";
      } else if (lower.includes("no") || lower.includes("fixed") || lower.includes("already") || lower.includes("someone else")) {
        classification = "HARD_NO";
      }
    }

    // ── POSITIVE REPLY → instant contractor notification + auto-charge ───────
    if (classification === "POSITIVE") {
      await sb.from("dead_lead_contacts" as any).update({
        status: "replied_positive",
        reply_text: replyBody,
        contractor_notified_at: new Date().toISOString(),
      }).eq("id", contact.id);

      const billingActive = (contractor as any)?.dead_lead_billing_active;
      const stripeCustomerId = (contractor as any)?.stripe_customer_id;
      const paymentMethodId = (contractor as any)?.stripe_payment_method_id;
      const billingNote = billingActive ? "($50 charged automatically.)" : "($50 added to your tab.)";

      // SMS contractor immediately — remove Matt from the loop
      if (contractor?.phone) {
        await sendSMS(
          contractor.phone,
          TWILIO_PHONE_NUMBER,
          `\u267b\ufe0f DEAD LEAD REVIVED: ${contact.name || fromPhone} just replied they still need ${trade} work. Call them now: ${fromPhone}. ${billingNote}`,
          "dead_lead_reactivation"
        );
      }

      // Auto-charge $50 if card is saved
      if (billingActive && stripeCustomerId && paymentMethodId && STRIPE_SECRET_KEY) {
        chargeContractor(sb, contact.id, campaign.contractor_id, stripeCustomerId, paymentMethodId, contact.name || fromPhone)
          .catch((e) => console.error("[handle-dead-lead-reply] charge failed:", e));
      }

      // Email Matt — note auto-charged vs manual
      if (RESEND_API_KEY) {
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "DWA System <matt@detroitwebagent.com>",
            to: ["matt@detroitwebagent.com"],
            subject: `\u267b\ufe0f Dead Lead Revived — ${contact.name || fromPhone} (${bizName})`,
            html: `<p><strong>${contact.name || fromPhone}</strong> replied YES to the ${trade} dead lead drip for <strong>${bizName}</strong>.</p><p>Phone: ${fromPhone}</p><p>Reply: "${replyBody}"</p><p>${billingActive ? "✅ <strong>$50 auto-charged</strong> to their saved card." : "⚠️ No card on file — invoice manually $50."}</p>`,
          }),
        }).catch(() => {});
      }
    }

    // ── HARD NO → Google review ask ───────────────────────────────────────
    else if (classification === "HARD_NO") {
      await sb.from("dead_lead_contacts" as any).update({
        status: "review_requested",
        reply_text: replyBody,
      }).eq("id", contact.id);

      if (contractor?.google_review_link) {
        await sendSMS(
          fromPhone,
          TWILIO_PHONE_NUMBER,
          `Glad you got it sorted! If ${bizName} was helpful during the quote process, a quick Google review would mean a lot to their local crew: ${contractor.google_review_link}`,
          "dead_lead_reactivation"
        );
      }
    }

    // ── UNKNOWN → just log it ─────────────────────────────────────────────
    else {
      await sb.from("dead_lead_contacts" as any).update({
        status: "replied_negative",
        reply_text: replyBody,
      }).eq("id", contact.id);
    }

    return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
  } catch (e: unknown) {
    console.error("[handle-dead-lead-reply]", e);
    return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }
});
