// system-health-watchdog
// Runs at 6 AM ET daily. Queries system_comms_log for errors/failures in last 24h.
// If any product had 2+ errors OR any alert-level event, sends Matt a consolidated SMS.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const MATT_PHONE = Deno.env.get("MATT_PHONE_NUMBER") || "+15867401654";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+18336992654";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendAdminSMS(body: string): Promise<string | null> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return null;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: MATT_PHONE, From: TWILIO_FROM, Body: body }),
    },
  );
  const data = await res.json();
  return res.ok ? (data.sid as string) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: errors } = await sb
    .from("system_comms_log")
    .select("product, channel, status")
    .in("status", ["error", "alert", "failed"])
    .gte("created_at", since)
    .order("product");

  if (!errors || errors.length === 0) {
    console.log("[watchdog] no errors in last 24h — all clear");
    return new Response(JSON.stringify({ ok: true, errors: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group by product
  const byProduct: Record<string, { count: number; channels: Set<string>; hasAlert: boolean }> = {};
  for (const row of errors as any[]) {
    const p = String(row.product || "unknown");
    if (!byProduct[p]) byProduct[p] = { count: 0, channels: new Set(), hasAlert: false };
    byProduct[p].count++;
    if (row.channel) byProduct[p].channels.add(row.channel);
    if (row.status === "alert") byProduct[p].hasAlert = true;
  }

  const alertLines: string[] = [];
  for (const [product, info] of Object.entries(byProduct)) {
    if (info.count >= 2 || info.hasAlert) {
      const ch = [...info.channels].join("/") || "unknown";
      alertLines.push(`• ${product} (${ch}): ${info.count} error${info.count !== 1 ? "s" : ""}`);
    }
  }

  if (alertLines.length === 0) {
    console.log("[watchdog] only isolated single errors — no SMS needed");
    return new Response(JSON.stringify({ ok: true, errors: errors.length, sms: "skipped_isolated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const totalErrors = errors.length;
  const msg = `⚠️ M2 Alert\n${totalErrors} error${totalErrors !== 1 ? "s" : ""} overnight:\n${alertLines.join("\n")}\nCheck admin-ops-daily-brief for details.`;

  const sid = await sendAdminSMS(msg);
  console.log("[watchdog] SMS result", { sid, totalErrors });

  return new Response(JSON.stringify({ ok: true, errors: totalErrors, sid }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
