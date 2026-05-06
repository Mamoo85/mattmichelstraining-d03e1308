// cold-email-bulk-queue — orchestrate end-to-end:
//   for each (buyer, contact) pick:
//     1. quality-gate
//     2. generate-row
//     3. mint dossier_share token (public proof page, replaces raw PDF when desired)
//     4. queue email_reply_drafts row with 10-min ghost delay
//     5. record signal_buyer_intent + email_arm_stats sent_count++
//
// Input: {
//   signal_id,
//   sends: [{ buyer_id, contact_id, recipient_email, recipient_name?, arms? }],
//   delay_minutes?: 10,
//   tone?: 'professional'
// }
//
// Output: { queued, skipped, results: [{contact_id, status, reason?, draft_id?}] }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

async function adminSMS(body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE_NUMBER, Body: body.slice(0, 1500) }),
    });
  } catch (e) { console.error("[cold-email-bulk-queue] sms", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { signal_id, sends, delay_minutes = 10, tone = "professional" } = await req.json();
    if (!signal_id || !Array.isArray(sends) || sends.length === 0) {
      return new Response(JSON.stringify({ error: "signal_id and sends[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (sends.length > 50) {
      return new Response(JSON.stringify({ error: "max 50 sends per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Pick one bandit set per signal (we apply it across the batch unless caller overrides)
    let defaultArms: any = null;
    try {
      const r = await sb.functions.invoke("cold-email-bandit-pick", { body: { vertical: "default", n: 1 } });
      defaultArms = (r.data as any)?.picks?.[0] || null;
    } catch (e) { console.warn("[bulk-queue] bandit pick failed, using fallback", e); }
    if (!defaultArms) defaultArms = { subject: "name_drop_signal", opener: "direct", cta: "free_dossier" };

    const sendAt = new Date(Date.now() + delay_minutes * 60 * 1000).toISOString();
    const results: any[] = [];
    let queued = 0, skipped = 0;

    for (const s of sends) {
      const arms = s.arms || defaultArms;
      try {
        // 1) Quality gate
        const qg = await sb.functions.invoke("cold-email-quality-gate", {
          body: {
            recipient_email: s.recipient_email,
            subject: "draft", body: "draft body for gate",
            signal_id, contact_id: s.contact_id,
          },
        });
        const qgData = (qg.data as any) || {};
        if (!qgData.allow) {
          skipped++;
          results.push({ contact_id: s.contact_id, status: "blocked", reason: (qgData.reasons || []).join("; ") });
          continue;
        }

        // 2) Generate body
        const gen = await sb.functions.invoke("cold-email-generate-row", {
          body: { signal_id, buyer_id: s.buyer_id, contact_id: s.contact_id, arms, tone },
        });
        const genData = (gen.data as any) || {};
        if (!genData.subject || !genData.body) {
          skipped++;
          results.push({ contact_id: s.contact_id, status: "gen_failed", reason: genData.error });
          continue;
        }

        // 3) Mint share token
        const token = crypto.randomUUID().replace(/-/g, "");
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await sb.from("dossier_share_tokens").insert({
          signal_id, token, created_for_email: s.recipient_email, expires_at: expires,
        });

        const shareUrl = `${SUPABASE_URL}/functions/v1/dossier-share-page?token=${token}`;
        const finalBody = `${genData.body}\n\nFull dossier (no signup): ${shareUrl}`;

        // 4) Queue ghost-delay draft
        const { data: draft, error: dErr } = await sb.from("email_reply_drafts").insert({
          recipient_email: s.recipient_email,
          recipient_name: s.recipient_name || null,
          subject: genData.subject,
          body: finalBody,
          send_at: sendAt,
          status: "queued",
          source: "cold_email_engine_v3",
          metadata: { signal_id, buyer_id: s.buyer_id, contact_id: s.contact_id, arms, share_token: token },
        }).select("id").single();
        if (dErr) {
          skipped++;
          results.push({ contact_id: s.contact_id, status: "queue_failed", reason: dErr.message });
          continue;
        }

        // 5) Bandit arm stat — increment sent for this arm/vertical combo (key matches betaSample alpha/beta)
        const ak = `subj:${arms.subject}|open:${arms.opener}|cta:${arms.cta}`;
        await sb.rpc("increment_arm_sent", { p_arm_key: ak, p_vertical: "default" })
          .then(() => {})
          .catch(async () => {
            // Fallback if RPC missing: direct upsert
            await sb.from("email_arm_stats").upsert(
              { arm_key: ak, vertical: "default", sent: 1, last_updated: new Date().toISOString() },
              { onConflict: "arm_key,vertical" },
            );
          });

        // 6) Touch the BIS cache row's recency component (don't overwrite if already populated)
        if (s.buyer_id) {
          const { data: existing } = await sb.from("signal_buyer_intent")
            .select("bis").eq("signal_id", signal_id).eq("buyer_id", s.buyer_id)
            .eq("contact_id", s.contact_id || null).maybeSingle();
          if (!existing) {
            await sb.from("signal_buyer_intent").insert({
              signal_id, buyer_id: s.buyer_id, contact_id: s.contact_id || null,
              bis: 50, breakdown: { source: "bulk-queue-stub", queued_at: new Date().toISOString() },
            });
          }
        }

        queued++;
        results.push({ contact_id: s.contact_id, status: "queued", draft_id: draft.id, share_url: shareUrl });
      } catch (e) {
        skipped++;
        results.push({ contact_id: s.contact_id, status: "error", reason: String(e instanceof Error ? e.message : e) });
      }
    }

    await adminSMS(`Cold-Email v3: ${queued} queued / ${skipped} skipped for signal ${signal_id.slice(0, 8)}. Sends in ${delay_minutes}min — reply STOP-${signal_id.slice(0, 8)} to cancel.`);

    return new Response(JSON.stringify({ queued, skipped, results, send_at: sendAt, arms_used: defaultArms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cold-email-bulk-queue]", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
