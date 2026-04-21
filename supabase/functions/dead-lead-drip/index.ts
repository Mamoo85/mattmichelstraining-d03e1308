// dead-lead-drip — daily cron 10am ET
// Omnichannel D1 (SMS) → D3 (Email) → D7 (SMS breakup) sequence.
// White-labeled per contractor (business_name on every touch).
// Halts instantly if contact replies (drip_step=9, set by handle-dead-lead-reply).
// TCPA: 18-month EBR window enforced on every loop.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";
import { getDeadLeadEmail } from "../_shared/dead-lead-emails.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// drip_step semantics:
//   0 = pending (never contacted)
//   1 = D1 SMS sent
//   2 = D3 EMAIL sent
//   3 = D7 SMS breakup sent (terminal — sequence complete)
//   9 = REPLIED / halted (locked, no further sends — set by handle-dead-lead-reply)

// Trade-specific D1 + D7 SMS copy. D3 lives in _shared/dead-lead-emails.ts.
const TRADE_TEMPLATES: Record<string, { d1: string; d7: string }> = {
  hvac: {
    d1: `Hey {name}, this is the office at {bizName}. Just checking in — is your HVAC system still giving you trouble, or did you find someone to handle it?\nReply STOP to opt out`,
    d7: `Last note from {bizName}. Haven't heard back so I'll assume you got the HVAC sorted — closing your file. Reply YES anytime if that ever changes.\nReply STOP to opt out`,
  },
  roofing: {
    d1: `Hey {name}, {bizName} here — following up on that roofing quote from a while back. Did you ever get that taken care of, or are you still looking at it?\nReply STOP to opt out`,
    d7: `Last message from {bizName}. Haven't heard back so I'm closing your file — if that roof ever needs attention, reply YES and we'll be there.\nReply STOP to opt out`,
  },
  plumbing: {
    d1: `Hey {name}, this is {bizName} following up. Did that plumbing issue ever get resolved, or is it still something you're dealing with?\nReply STOP to opt out`,
    d7: `Last follow-up from {bizName}. Assuming you got the plumbing handled — closing your file. Reply YES anytime if it comes back.\nReply STOP to opt out`,
  },
  electrical: {
    d1: `Hey {name}, {bizName} following up. Did you ever get that electrical work taken care of, or is it still on the list?\nReply STOP to opt out`,
    d7: `Last note from {bizName}. Closing your file — if that electrical job ever needs to happen, just reply YES.\nReply STOP to opt out`,
  },
  general: {
    d1: `Hey {name}, this is the dispatch desk following up for {bizName}. Did you ever get that {trade} issue taken care of, or are you still looking for a quote?\nReply STOP to opt out`,
    d7: `Last check-in from {bizName}. Haven't heard back so I'll assume it got handled — closing your file. Reply YES anytime if that changes.\nReply STOP to opt out`,
  },
};

function tradeKey(trade: string): keyof typeof TRADE_TEMPLATES {
  const k = (trade || "").toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("hvac") || k.includes("furnace") || k.includes("heating") || k.includes("cooling")) return "hvac";
  if (k.includes("roof")) return "roofing";
  if (k.includes("plumb")) return "plumbing";
  if (k.includes("electric")) return "electrical";
  return "general";
}

function fillSms(template: string, vars: { name: string; bizName: string; trade: string }): string {
  return template.replace(/{name}/g, vars.name).replace(/{bizName}/g, vars.bizName).replace(/{trade}/g, vars.trade);
}

// ── Item 42: Sonar homeowner re-enrichment — skip completed projects ───────────
async function checkProjectComplete(name: string, trade: string): Promise<boolean> {
  if (!OPENROUTER_API_KEY || !name) return false;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: `Is there any online evidence that "${name}" in Michigan recently completed a ${trade} home project in 2025-2026 (review posted, photo shared, job listed as done)? Answer YES or NO only.` }],
        max_tokens: 50, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").toUpperCase().startsWith("YES");
  } catch { return false; }
}

async function sendValueAddEmail(args: {
  to: string;
  fromName: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${args.fromName} <matt@detroitwebagent.com>`,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        reply_to: "matt@detroitwebagent.com",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  const probeUrl = new URL(req.url);
  if (probeUrl.searchParams.get("probe") === "1") {
    return new Response(JSON.stringify({ ok: true, name: "dead-lead-drip" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isBackground = probeUrl.searchParams.get("bg") === "1";
  if (isBackground) {
    const work = (async () => {
      try { await runDripJob(); } catch (e) { console.error("[dead-lead-drip bg]", e); }
    })();
    // @ts-ignore — EdgeRuntime is available in Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(work);
    }
    return new Response(JSON.stringify({ ok: true, dispatched: true, mode: "background" }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return await runDripJob();
});

async function runDripJob(): Promise<Response> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo  = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

    // TCPA EBR cutoff: 18 months from last business contact
    const eighteenMonthsAgo = new Date(now.getTime() - 548 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    let d1SmsCount = 0, d3EmailCount = 0, d7SmsCount = 0, tcpaSkipped = 0, repliedSkipped = 0;

    // ── TCPA SWEEP ────────────────────────────────────────────────────────
    const { data: expired, error: expiredErr } = await sb
      .from("dead_lead_contacts" as any)
      .update({ status: "tcpa_expired", drip_step: 9 })
      .lt("last_contact_date", eighteenMonthsAgo)
      .in("drip_step", [0, 1, 2])
      .select("id");
    if (expiredErr) console.error("[drip] TCPA sweep error:", expiredErr);
    tcpaSkipped = expired?.length || 0;

    // Item 42: Sonar enrichment counter (cap to control cost)
    let sonarEnrichedCount = 0;
    const SONAR_ENRICH_LIMIT = 3;

    // ── LOOP A — D1 SMS: drip_step=0 (pending) ───────────────────────────
    const { data: d1Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_id, contractor_clients(business_name, phone))")
      .eq("drip_step", 0)
      .neq("status", "opted_out")
      .not("dead_lead_campaigns", "is", null)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of d1Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const contractor = (campaign as any).contractor_clients;
        const bizName = contractor?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        // Skip if Sonar finds project already completed (cost-capped)
        if (sonarEnrichedCount < SONAR_ENRICH_LIMIT) {
          const projectDone = await checkProjectComplete(contact.name || "", trade);
          sonarEnrichedCount++;
          if (projectDone) {
            await sb.from("dead_lead_contacts" as any)
              .update({ status: "project_complete", drip_step: 9 })
              .eq("id", contact.id);
            console.log(`[drip] Sonar: ${contact.name} project likely complete — skipping`);
            continue;
          }
        }

        // Custom A/B copy variant (selected by Matt via SMS reply A/B)
        const { data: customCopy } = await sb
          .from("campaign_copy_variants" as any)
          .select("drip1_copy")
          .eq("campaign_id", campaign.id)
          .eq("selected", true)
          .maybeSingle();

        const tpl = customCopy?.drip1_copy || TRADE_TEMPLATES[tradeKey(trade)].d1;
        const body = fillSms(tpl, { name: firstName, bizName, trade });

        const smsRes = await sendSMS(contact.phone, TWILIO_PHONE_NUMBER, body, "dead_lead_reactivation");
        if (!smsRes?.success) {
          // sendSMS already logs to error_logs; just skip the state mutation
          continue;
        }

        const { error: upErr } = await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip1_sent", drip_step: 1, drip1_sent_at: now.toISOString() })
          .eq("id", contact.id);
        if (upErr) {
          await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
            recipient: contact.phone, error_message: `D1 state update failed: ${upErr.message}` });
        }
        d1SmsCount++;
      } catch (e) {
        console.error("[drip] D1 SMS error for contact", contact.id, e);
        await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
          recipient: contact.phone, error_message: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── LOOP B — D3 EMAIL: drip_step=1 AND drip1_sent ≥ 3 days ago AND email present ──
    const { data: d3Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_clients(business_name))")
      .eq("drip_step", 1)
      .neq("status", "opted_out")
      .not("drip1_sent_at", "is", null)
      .lte("drip1_sent_at", threeDaysAgo)
      .not("email", "is", null)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of d3Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        if (!contact.email) continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        const { subject, html } = getDeadLeadEmail(trade, {
          firstName,
          bizName,
          bizPhone: undefined,
        });

        const emailRes = await sendValueAddEmail({
          to: contact.email,
          fromName: bizName,
          subject,
          html,
        });

        if (!emailRes.ok) {
          await logError({
            source: "resend",
            function_name: "dead-lead-drip",
            severity: "error",
            recipient: contact.email,
            payload: { subject, contact_id: contact.id, campaign_id: campaign.id },
            error_message: emailRes.error || "unknown resend failure",
            http_status: emailRes.status ?? null,
          });
          continue;
        }

        const { error: upErr } = await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip2_sent", drip_step: 2, drip2_sent_at: now.toISOString() })
          .eq("id", contact.id);
        if (upErr) {
          await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
            recipient: contact.email, error_message: `D3 state update failed: ${upErr.message}` });
        }
        d3EmailCount++;
      } catch (e) {
        console.error("[drip] D3 EMAIL error for contact", contact.id, e);
        await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
          recipient: contact.email, error_message: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── LOOP B-fallback — no email on file: skip directly from D1 → D7 path ──
    // Push drip_step=1 contacts with no email straight to "ready for D7" by
    // marking them drip_step=2 with drip2_sent_at = now() once 3 days have passed.
    // (They'll then wait the standard 4 days before D7 fires — same total 7-day cadence.)
    const { data: noEmailContacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("id, drip1_sent_at")
      .eq("drip_step", 1)
      .neq("status", "opted_out")
      .is("email", null)
      .not("drip1_sent_at", "is", null)
      .lte("drip1_sent_at", threeDaysAgo)
      .limit(500);
    if (noEmailContacts?.length) {
      await sb.from("dead_lead_contacts" as any)
        .update({ drip_step: 2, drip2_sent_at: now.toISOString(), status: "drip2_skipped_no_email" })
        .in("id", noEmailContacts.map((c: any) => c.id));
    }

    // ── LOOP C — D7 SMS BREAKUP: drip_step=2 AND drip2_sent ≥ 4 days ago ─────
    const { data: d7Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_clients(business_name))")
      .eq("drip_step", 2)
      .neq("status", "opted_out")
      .not("drip2_sent_at", "is", null)
      .lte("drip2_sent_at", fourDaysAgo)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of d7Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        const { data: customCopy } = await sb
          .from("campaign_copy_variants" as any)
          .select("drip3_copy")
          .eq("campaign_id", campaign.id)
          .eq("selected", true)
          .maybeSingle();

        const tpl = customCopy?.drip3_copy || TRADE_TEMPLATES[tradeKey(trade)].d7;
        const body = fillSms(tpl, { name: firstName, bizName, trade });

        const smsRes = await sendSMS(contact.phone, TWILIO_PHONE_NUMBER, body, "dead_lead_reactivation");
        if (!smsRes?.success) continue;

        const { error: upErr } = await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip3_sent", drip_step: 3, drip3_sent_at: now.toISOString() })
          .eq("id", contact.id);
        if (upErr) {
          await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
            recipient: contact.phone, error_message: `D7 state update failed: ${upErr.message}` });
        }
        d7SmsCount++;
      } catch (e) {
        console.error("[drip] D7 SMS error for contact", contact.id, e);
        await logError({ source: "cron", function_name: "dead-lead-drip", severity: "error",
          recipient: contact.phone, error_message: e instanceof Error ? e.message : String(e) });
      }
    }

    // Count contacts halted by reply (observability only — they were excluded by drip_step filter)
    const { count: repliedCount } = await sb
      .from("dead_lead_contacts" as any)
      .select("id", { count: "exact", head: true })
      .eq("drip_step", 9);
    repliedSkipped = repliedCount || 0;

    console.log(`[dead-lead-drip] d1_sms=${d1SmsCount} d3_email=${d3EmailCount} d7_sms=${d7SmsCount} tcpa_expired=${tcpaSkipped} replied_total=${repliedSkipped}`);
    return new Response(
      JSON.stringify({
        ok: true,
        d1_sms: d1SmsCount,
        d3_email: d3EmailCount,
        d7_sms: d7SmsCount,
        tcpa_expired: tcpaSkipped,
        replied_total: repliedSkipped,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dead-lead-drip] Error:", msg);
    await logError({ source: "cron", function_name: "dead-lead-drip", severity: "critical",
      error_message: `Drip job crashed: ${msg}` });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
