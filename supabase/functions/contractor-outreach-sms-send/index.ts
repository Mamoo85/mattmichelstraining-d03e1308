// TCPA-hardened SMS send to a single contractor prospect.
// Hard-rejects without consent, suppression check, quiet hours (8am-9pm ET),
// daily cap, always appends STOP, writes audit row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const DAILY_SMS_CAP = 50;
const CONSENT_MAX_AGE_DAYS = 540; // 18 months (TCPA EBR)

function withinQuietHours(): { ok: boolean; reason?: string } {
  // Use ET (America/Detroit) — covers Matt's market
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(fmt.format(new Date()), 10);
  if (hour < 8 || hour >= 21) {
    return { ok: false, reason: `TCPA quiet hours (currently ${hour}:00 ET; allowed 8am-9pm)` };
  }
  return { ok: true };
}

async function logAudit(supabase: any, row: Record<string, unknown>) {
  try { await supabase.from("contractor_outreach_audit_log").insert(row); }
  catch (e) { console.error("audit log insert failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id, message, lead_id } = await req.json();
    if (!prospect_id || !message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "prospect_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 320) {
      return new Response(JSON.stringify({ error: "Message too long (320 char max)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load prospect
    const { data: p, error: pErr } = await supabase
      .from("contractor_outreach_prospects")
      .select("id, business_name, phone, consent_for_sms, consent_timestamp, unsubscribed_at")
      .eq("id", prospect_id)
      .single();
    if (pErr || !p) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compliance gates (in order)
    if (!p.phone) {
      return new Response(JSON.stringify({ ok: false, error: "Prospect has no phone" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (p.unsubscribed_at) {
      await logAudit(supabase, { prospect_id, channel: "sms", event: "suppressed", reason: "Prospect unsubscribed" });
      return new Response(JSON.stringify({ ok: false, error: "Prospect has unsubscribed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!p.consent_for_sms) {
      await logAudit(supabase, { prospect_id, channel: "sms", event: "suppressed", reason: "No SMS consent on file" });
      return new Response(JSON.stringify({ ok: false, error: "No SMS consent on file. Mark consent first." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (p.consent_timestamp) {
      const ageDays = (Date.now() - new Date(p.consent_timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > CONSENT_MAX_AGE_DAYS) {
        await logAudit(supabase, { prospect_id, channel: "sms", event: "suppressed", reason: `Consent expired (${Math.round(ageDays)} days old, max 540)` });
        return new Response(JSON.stringify({ ok: false, error: "SMS consent expired (>18 months). Re-confirm." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Global suppression check
    const { data: supRow, error: sErr } = await supabase
      .from("contractor_outreach_suppression")
      .select("id")
      .eq("contact_type", "phone")
      .eq("contact", p.phone)
      .maybeSingle();
    if (sErr) {
      return new Response(JSON.stringify({ error: `Suppression check failed: ${sErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (supRow) {
      await logAudit(supabase, { prospect_id, channel: "sms", event: "suppressed", reason: "Phone on global suppression list" });
      return new Response(JSON.stringify({ ok: false, error: "Phone is on suppression list" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quiet hours
    const qh = withinQuietHours();
    if (!qh.ok) {
      await logAudit(supabase, { prospect_id, channel: "sms", event: "quiet_hours_blocked", reason: qh.reason });
      return new Response(JSON.stringify({ ok: false, error: qh.reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily cap
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday, error: capErr } = await supabase
      .from("contractor_outreach_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("channel", "sms")
      .eq("event", "sent")
      .gte("created_at", since);
    if (capErr) {
      return new Response(JSON.stringify({ error: `Cap check failed: ${capErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((sentToday || 0) >= DAILY_SMS_CAP) {
      await logAudit(supabase, { prospect_id, channel: "sms", event: "daily_cap_blocked", reason: `Cap ${DAILY_SMS_CAP} reached` });
      return new Response(JSON.stringify({ ok: false, error: `Daily SMS cap reached (${DAILY_SMS_CAP}/day)` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build body — guarantee STOP suffix
    const body = /reply\s+stop/i.test(message)
      ? message
      : `${message.trim()} Reply STOP to opt out.`;

    // Send via Twilio REST API directly (we have account creds)
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const twRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: p.phone,
          From: TWILIO_PHONE_NUMBER,
          Body: body,
        }),
      }
    );
    const twData = await twRes.json();
    if (!twRes.ok) {
      await logAudit(supabase, {
        prospect_id, lead_id, channel: "sms", event: "bounce",
        reason: twData?.message || `Twilio ${twRes.status}`,
        metadata: twData,
      });
      return new Response(JSON.stringify({ ok: false, error: twData?.message || "Twilio error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("contractor_outreach_prospects")
      .update({ last_smsed_at: new Date().toISOString() })
      .eq("id", prospect_id);

    await logAudit(supabase, {
      prospect_id, lead_id, channel: "sms", event: "sent",
      reason: body.slice(0, 200),
      metadata: { twilio_sid: twData?.sid },
    });

    return new Response(JSON.stringify({ ok: true, sid: twData?.sid }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-sms-send error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
