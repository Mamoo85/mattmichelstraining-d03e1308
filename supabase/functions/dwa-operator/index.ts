// dwa-operator — self-healing campaign manager (runs every 4 hours)
// Auto-pauses dead/spammy campaigns, generates A/B SMS copy via AI,
// texts Matt for selection, monitors billing, updates heartbeat.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { generateJSON } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

// ── Hardcoded fallback variants if AI returns empty ─────────────────────────
const FALLBACK_A = {
  drip1: "Hey {name}, just checking in — {bizName} here. Still need help with {trade} work? We have availability this week.",
  drip2: "Hi {name}, {bizName} again. We're running a quick turnaround right now if you still need {trade} help. Just reply YES.",
  drip3: "Last check-in from {bizName} — if {trade} work comes up in the future, we're here. Take care!",
};
const FALLBACK_B = {
  drip1: "Hi {name} — {bizName} following up on your old {trade} quote. Prices have changed. Want a fresh estimate?",
  drip2: "{name}, {bizName} here. Your old {trade} quote may have expired — we can beat it. Reply YES for a quick call.",
  drip3: "{bizName}: Final note — if {trade} needs come up, we're a quick reply away. Good luck!",
};

interface CopyVariants {
  variantA: { drip1: string; drip2: string; drip3: string; diagnosis: string };
  variantB: { drip1: string; drip2: string; drip3: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let pausedCount = 0;
  let completedCount = 0;
  let billingIssues = 0;

  try {
    // ── Step 1: Fetch all active campaigns with contact stats ───────────────
    const { data: campaigns } = await sb
      .from("dead_lead_campaigns" as any)
      .select("id, status, trade, contractor_id, contractor_clients(business_name, phone, stripe_payment_method_id)")
      .eq("status", "active");

    for (const campaign of campaigns || []) {
      try {
        const { data: contacts } = await sb
          .from("dead_lead_contacts" as any)
          .select("id, status, drip3_sent_at")
          .eq("campaign_id", campaign.id);

        if (!contacts?.length) continue;

        const total = contacts.length;
        const pending = contacts.filter((c: any) => c.status === "pending").length;
        const drip3Sent = contacts.filter((c: any) => c.status === "drip3_sent");
        const positive = contacts.filter((c: any) => c.status === "replied_positive").length;
        const negative = contacts.filter((c: any) => c.status === "replied_negative").length;
        const reviewReq = contacts.filter((c: any) => c.status === "review_requested").length;
        const optedOut = contacts.filter((c: any) => c.status === "opted_out").length;
        const tcpaExpired = contacts.filter((c: any) => c.status === "tcpa_expired").length;
        const contacted = total - pending - tcpaExpired; // tcpa_expired never received a text

        // ── Step 2: Auto-complete exhausted campaigns ───────────────────────
        const terminalCount = positive + negative + reviewReq + optedOut + drip3Sent.length + tcpaExpired;
        if (terminalCount === total && drip3Sent.length > 0) {
          const latestDrip3 = drip3Sent
            .map((c: any) => c.drip3_sent_at)
            .filter(Boolean)
            .sort()
            .pop();
          if (latestDrip3 && latestDrip3 < sevenDaysAgo) {
            await sb
              .from("dead_lead_campaigns" as any)
              .update({ status: "complete", completed_at: now.toISOString() })
              .eq("id", campaign.id);
            completedCount++;
            continue;
          }
        }

        // ── Step 3: Spam protection — zero reply after 40+ texts ───────────
        const zeroReplySpam =
          contacted >= 40 && (positive + negative + reviewReq + optedOut) === 0;
        // Dead campaign — all drip3_sent, zero replies
        const deadCampaign =
          drip3Sent.length === total && (positive + negative + reviewReq + optedOut) === 0;
        // High opt-out rate (>15%)
        const optOutRate = contacted > 0 ? optedOut / contacted : 0;
        const highOptOut = optOutRate > 0.15 && contacted >= 10;

        if (zeroReplySpam || deadCampaign || highOptOut) {
          const pauseReason = highOptOut
            ? "high_opt_out_rate"
            : zeroReplySpam
            ? "zero_reply_spam_protection"
            : "dead_campaign";

          await sb
            .from("dead_lead_campaigns" as any)
            .update({ status: "paused", pause_reason: pauseReason, paused_at: now.toISOString() })
            .eq("id", campaign.id);

          pausedCount++;
          const bizName = (campaign as any).contractor_clients?.business_name || "Unknown";
          const trade = campaign.trade || "service";

          if (highOptOut) {
            // High opt-out: no copy variants, just alert Matt
            await sendSMS(
              ADMIN_PHONE,
              TWILIO_PHONE_NUMBER,
              `Paused "${bizName}" (${trade}) — ${Math.round(optOutRate * 100)}% opt-out rate (${optedOut}/${contacted} texts). Check audience before restarting.`,
              "dwa_operator"
            );
            continue;
          }

          // ── Step 4: Generate A/B copy variants via AI (free Gemini) ───────
          const prompt = `You are an SMS copy specialist for a home services company.
A "${trade}" contractor (${bizName}) ran a dead lead reactivation campaign. Results: ${contacted} texts sent, 0 replies, ${optedOut} opt-outs.

The original 3-message sequence failed to get ANY response.

Generate TWO completely different 3-message SMS sequences to try next.
- Variant A: casual, conversational, low-pressure (under 140 chars each)
- Variant B: value-driven, creates mild urgency (under 140 chars each)
- Use placeholders: {name}, {bizName}, {trade}
- Never use words like "AI", "automated", "bot", or "system"
- Sound like a real person from the contractor's office

Respond with JSON only:
{
  "variantA": {
    "diagnosis": "one sentence why original failed",
    "drip1": "...",
    "drip2": "...",
    "drip3": "..."
  },
  "variantB": {
    "drip1": "...",
    "drip2": "...",
    "drip3": "..."
  }
}`;

          const fallback: CopyVariants = {
            variantA: { ...FALLBACK_A, drip1: FALLBACK_A.drip1, drip2: FALLBACK_A.drip2, drip3: FALLBACK_A.drip3, diagnosis: "Original copy was too generic — try more personal tone." },
            variantB: { drip1: FALLBACK_B.drip1, drip2: FALLBACK_B.drip2, drip3: FALLBACK_B.drip3 },
          };

          const variants = await generateJSON<CopyVariants>(prompt, fallback, 800);

          // Insert A/B variants (upsert safe — unique on campaign_id + label)
          await sb.from("campaign_copy_variants" as any).upsert([
            {
              campaign_id: campaign.id,
              variant_label: "A",
              drip1_copy: variants.variantA.drip1 || FALLBACK_A.drip1,
              drip2_copy: variants.variantA.drip2 || FALLBACK_A.drip2,
              drip3_copy: variants.variantA.drip3 || FALLBACK_A.drip3,
              selected: false,
            },
            {
              campaign_id: campaign.id,
              variant_label: "B",
              drip1_copy: variants.variantB.drip1 || FALLBACK_B.drip1,
              drip2_copy: variants.variantB.drip2 || FALLBACK_B.drip2,
              drip3_copy: variants.variantB.drip3 || FALLBACK_B.drip3,
              selected: false,
            },
          ], { onConflict: "campaign_id,variant_label" });

          // ── Step 5: Boss SMS with preview ──────────────────────────────────
          const diagnosis = variants.variantA.diagnosis || "Original copy got no engagement.";
          const aPreview = (variants.variantA.drip1 || FALLBACK_A.drip1).slice(0, 60);
          const bPreview = (variants.variantB.drip1 || FALLBACK_B.drip1).slice(0, 60);

          await sendSMS(
            ADMIN_PHONE,
            TWILIO_PHONE_NUMBER,
            `Paused "${bizName}" (${trade}) — ${contacted} texts, 0 replies. ${diagnosis}\nA: "${aPreview}..."\nB: "${bPreview}..."\nReply A or B to resume.`,
            "dwa_operator"
          );
        }
      } catch (e) {
        console.error(`[dwa-operator] campaign ${campaign.id} error:`, e);
      }
    }

    // ── Step 6: Billing watchdog ────────────────────────────────────────────
    // Check for positive replies where contractor has no card on file
    const { data: unchargedReplies } = await sb
      .from("dead_lead_contacts" as any)
      .select("id, name, dead_lead_campaigns(contractor_clients(business_name, dead_lead_billing_active, stripe_payment_method_id))")
      .eq("status", "replied_positive")
      .gte("updated_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

    const noCardContractors = new Set<string>();
    for (const reply of unchargedReplies || []) {
      const client = (reply as any).dead_lead_campaigns?.contractor_clients;
      if (client && !client.stripe_payment_method_id) {
        noCardContractors.add(client.business_name || "Unknown");
      }
    }

    if (noCardContractors.size > 0) {
      billingIssues = noCardContractors.size;
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE_NUMBER,
        `Billing: ${billingIssues} contractor${billingIssues > 1 ? "s" : ""} got YES replies but no card on file: ${[...noCardContractors].join(", ")}. Invoice manually.`,
        "dwa_operator"
      );
    }

    // ── Step 7: Heartbeat ───────────────────────────────────────────────────
    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "dwa-operator",
      last_run_at: now.toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ pausedCount, completedCount, billingIssues }),
    }, { onConflict: "agent_name" });

    console.log(`[dwa-operator] paused=${pausedCount} completed=${completedCount} billingIssues=${billingIssues}`);
    return new Response(
      JSON.stringify({ ok: true, pausedCount, completedCount, billingIssues }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dwa-operator] Fatal error:", msg);

    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "dwa-operator",
      last_run_at: now.toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: msg }),
    }, { onConflict: "agent_name" } as any).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
