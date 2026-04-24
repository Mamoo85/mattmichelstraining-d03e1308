// GHOST-1 + GHOST-2 fix: Reconcile all DWA product webhooks + marketplace email delivery
// Runs daily at 11pm ET. Diffs Stripe's last-48h paid sessions against each product table.
// Also catches marketplace leads sold but buyer email never delivered (email_sent_at IS NULL).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

  const since = Math.floor((Date.now() - 48 * 3600 * 1000) / 1000); // last 48h
  const patched: string[] = [];
  const orphans: string[] = [];

  try {
    // ── 1. Agency interview charges (original scope) ──────────────────────────
    const intents = await stripe.paymentIntents.list({ created: { gte: since }, limit: 100 });
    for (const intent of intents.data) {
      if (intent.status !== "succeeded") continue;
      if (intent.metadata?.type !== "agency_interview_charge") continue;
      const assignmentId = intent.metadata?.assignment_id;
      if (!assignmentId) { orphans.push(intent.id); continue; }
      const { data: a } = await sb
        .from("agency_candidate_assignments")
        .select("id, charged_at, stripe_charge_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (!a) { orphans.push(`${intent.id} (no assignment ${assignmentId})`); continue; }
      if (!a.charged_at || !a.stripe_charge_id) {
        await sb.from("agency_candidate_assignments").update({
          charged_at: new Date(intent.created * 1000).toISOString(),
          stripe_charge_id: intent.id,
          charge_amount_cents: intent.amount,
        }).eq("id", assignmentId);
        patched.push(`agency:${assignmentId}`);
      }
    }

    // ── 2. DWA product subscriptions — check each paid session against product table ──
    const sessions = await stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 });

    for (const session of sessions.data) {
      if (session.payment_status !== "paid" && session.status !== "complete") continue;
      const meta = session.metadata || {};
      const email = (meta.email || session.customer_email || "").toLowerCase();
      if (!email) continue;

      // TechAlert
      if (meta.type === "hire_alert_subscription") {
        const { data } = await sb.from("hire_alert_clients").select("id").eq("owner_email", email).maybeSingle();
        if (!data) {
          console.warn(`[reconcile] TechAlert not provisioned for ${email} — session ${session.id}`);
          await fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ email, type: "hire_alert_subscription", name: meta.company_name || meta.name }),
          }).catch(() => {});
          patched.push(`techalert:${email}`);
          await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
            `🔧 Reconcile: re-fired TechAlert onboard for ${email} (session ${session.id.slice(-8)})`,
            "reconcile").catch(() => {});
        }
      }

      // FieldDesk
      if (meta.type === "field_service_subscription") {
        const { data } = await sb.from("field_crm_clients").select("id").eq("email", email).maybeSingle();
        if (!data) {
          console.warn(`[reconcile] FieldDesk not provisioned for ${email}`);
          await fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ email, type: "field_service_subscription", name: meta.company || meta.business_name || meta.name }),
          }).catch(() => {});
          patched.push(`fielddesk:${email}`);
          await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
            `🔧 Reconcile: re-fired FieldDesk onboard for ${email}`,
            "reconcile").catch(() => {});
        }
      }

      // Contractor Leads
      if (meta.type === "contractor_lead_subscription") {
        const { data } = await sb.from("contractor_clients").select("id").eq("email", email).eq("active", true).maybeSingle();
        if (!data) {
          console.warn(`[reconcile] ContractorLeads not provisioned for ${email}`);
          await fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ email, type: "contractor_lead_subscription", name: meta.business_name || meta.name }),
          }).catch(() => {});
          patched.push(`contractor:${email}`);
          await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
            `🔧 Reconcile: re-fired ContractorLeads onboard for ${email}`,
            "reconcile").catch(() => {});
        }
      }

      // Mortgage Radar
      if (meta.type === "mortgage_radar_subscription") {
        const { data } = await sb.from("mortgage_radar_clients").select("id").eq("email", email).maybeSingle();
        if (!data) {
          console.warn(`[reconcile] MortgageRadar not provisioned for ${email}`);
          await fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ email, type: "mortgage_radar_subscription", name: meta.name }),
          }).catch(() => {});
          patched.push(`mortgage_radar:${email}`);
          await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
            `🔧 Reconcile: re-fired MortgageRadar onboard for ${email}`,
            "reconcile").catch(() => {});
        }
      }
    }

    // ── 3. GHOST-2: Marketplace leads sold but dossier email never delivered ────
    // Looks for locks that are sold AND email_sent_at IS NULL AND sold > 1 hour ago.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: unsentLeads } = await sb
      .from("marketplace_lead_locks")
      .select("lead_id, product, buyer_email, sold_at, stripe_session_id")
      .eq("status", "sold")
      .is("email_sent_at", null)
      .lt("sold_at", oneHourAgo)
      .limit(20);

    for (const lock of unsentLeads || []) {
      console.warn(`[reconcile] Marketplace dossier not delivered: ${lock.buyer_email} / ${lock.lead_id}`);
      // Re-trigger the fulfillment email
      if (RESEND_API_KEY && lock.buyer_email) {
        const { data: lead } = await sb
          .from("unified_lead_marketplace_view")
          .select("*")
          .eq("id", lock.lead_id)
          .maybeSingle();
        const dashLink = `https://detroitwebagent.com/lead/${lock.lead_id}?paid=1&buyer=${encodeURIComponent(lock.buyer_email)}`;
        const productLabel = ({ mortgage: "Mortgage", talent: "Talent", demand: "Demand", growth: "Growth", supply: "Supply" } as any)[lock.product] || lock.product;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
            to: [lock.buyer_email],
            subject: `🎟 Your ${productLabel} Dossier is Ready`,
            html: `<p>Your ${productLabel} lead dossier is ready. <a href="${dashLink}">Open Dossier →</a></p><p style="font-size:12px;color:#666;">Resent by reconcile job at ${new Date().toISOString()}</p>`,
          }),
        }).then(async (r) => {
          if (r.ok) {
            await sb.from("marketplace_lead_locks")
              .update({ email_sent_at: new Date().toISOString() })
              .eq("lead_id", lock.lead_id)
              .eq("product", lock.product);
            patched.push(`marketplace_email:${lock.buyer_email}:${lock.lead_id.slice(0, 8)}`);
          }
        }).catch(() => {});
      }
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
        `⚠️ Reconcile: Resent marketplace dossier to ${lock.buyer_email} for ${lock.lead_id.slice(0, 8)} (${lock.product})`,
        "reconcile").catch(() => {});
    }

    const summary = `Reconcile complete: ${patched.length} patched, ${orphans.length} orphans, ${(unsentLeads || []).length} unsent dossiers`;
    console.log(`[reconcile] ${summary}`);

    if ((patched.length || orphans.length) && ADMIN_PHONE) {
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
        `🔧 ${summary}${orphans.length > 0 ? " | Orphans: " + orphans.slice(0, 2).join(", ") : ""}`,
        "reconcile").catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, patched, orphans, unsent_dossiers: (unsentLeads || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
