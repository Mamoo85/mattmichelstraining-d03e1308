import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "Detroit Web Agency <matt@detroitwebagent.com>";
const REPLY_TO = "matt@detroitwebagent.com";
const MAX_PER_RUN = 200;
const DELAY_MS = 125;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function render(template: string, prospect: Record<string, unknown>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = prospect[key];
    return value == null || value === "" ? "there" : String(value);
  });
}

async function checkResendHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY is not configured" };
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `RESEND_API_KEY failed (${res.status}): ${text.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `RESEND_API_KEY check failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: REPLY_TO, subject, html }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = typeof body.campaign_id === "string" ? body.campaign_id : "";
    const dryRun = body.dry_run === true;
    const resendFailed = body.resend_failed === true;
    if (!campaignId) return json({ error: "campaign_id required" }, 400);

    const { data: campaign, error: campErr } = await sb
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (campErr || !campaign) return json({ error: "Email campaign not found" }, 404);

    const selectedIds = Array.isArray(campaign.prospect_ids) ? campaign.prospect_ids : [];
    if (!selectedIds.length) {
      const error = "Email campaign has no prospect_ids; create it from Outreach Command Center again.";
      await sb.from("email_campaigns").update({ status: "failed", last_error: error }).eq("id", campaignId);
      return json({ error, ready_to_send: 0 }, 400);
    }

    const { data: prospects, error: prospectErr } = await sb
      .from("prospect_pool")
      .select("id,business_name,contact_name,email,audience_type,city,state,website,status,send_count,last_sent_at")
      .in("id", selectedIds);
    if (prospectErr) throw prospectErr;

    const targets = (prospects || [])
      .filter((p: any) => !!p.email)
      .filter((p: any) => resendFailed || p.status !== "sent_email");

    const health = await checkResendHealth();
    if (dryRun) {
      return json({
        diagnose: true,
        prospect_count: prospects?.length || 0,
        ready_to_send: targets.length,
        no_email: (prospects || []).filter((p: any) => !p.email).length,
        api_ok: health.ok,
        credential_error: health.error || null,
        estimated_cost: 0,
      });
    }

    if (!health.ok) {
      await sb.from("email_campaigns").update({ status: "failed", last_error: health.error }).eq("id", campaignId);
      return json({ success: false, error: health.error, credential_error: health.error }, 500);
    }
    if (!targets.length) return json({ success: false, error: "No selected prospects with valid email addresses", sent: 0, failed: 0 }, 400);
    if (targets.length > MAX_PER_RUN) return json({ success: false, error: `Email run blocked: ${targets.length} > ${MAX_PER_RUN}/run cap` }, 400);

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;

    for (const prospect of targets as any[]) {
      const subject = render(campaign.subject, prospect);
      const html = render(campaign.message_html, prospect);
      try {
        const result = await sendEmail(prospect.email, subject, html);
        sent++;
        await sb.from("system_comms_log").insert({
          channel: "email",
          product: "outreach_email_campaign",
          recipient: prospect.email,
          body_preview: subject,
          status: "sent",
          provider_id: result?.id || null,
          metadata: { campaign_id: campaignId, prospect_id: prospect.id },
        });
        await sb.from("prospect_pool").update({
          status: "sent_email",
          last_sent_at: new Date().toISOString(),
          send_count: (prospect.send_count || 0) + 1,
        }).eq("id", prospect.id);
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : String(e);
        await sb.from("system_comms_log").insert({
          channel: "email",
          product: "outreach_email_campaign",
          recipient: prospect.email,
          body_preview: subject,
          status: "failed",
          error_message: lastError,
          metadata: { campaign_id: campaignId, prospect_id: prospect.id },
        });
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    await sb.from("email_campaigns").update({
      status: sent > 0 ? "sent" : "failed",
      sent_count: (campaign.sent_count || 0) + sent,
      failed_count: (campaign.failed_count || 0) + failed,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      last_error: sent > 0 ? null : lastError || "all sends failed",
    }).eq("id", campaignId);

    return json({ success: sent > 0, sent, failed, cost: 0, last_error: lastError });
  } catch (e) {
    console.error("[send-email-campaign]", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
