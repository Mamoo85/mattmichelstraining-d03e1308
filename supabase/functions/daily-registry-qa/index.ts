// Daily registry QA — compares yesterday vs today signal counts per waterfall.
// Snapshots today's counts and SMS Matt on >40% drops.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WATERFALLS = [
  // (label, table, dateCol) — dateCol defaults to "created_at"
  // Use "updated_at" for cumulative tables where the scanner UPDATEs existing rows
  // rather than INSERTing new ones every day (new-rows-today would always be 0).
  { label: "trade_radar_leads", table: "trade_radar_leads" },
  { label: "trade_radar_area_signals", table: "trade_radar_area_signals" },
  { label: "mortgage_radar_leads", table: "mortgage_radar_leads" },
  { label: "techalert_prospect_targets", table: "techalert_prospect_targets", dateCol: "updated_at" },
  { label: "outreach_targets", table: "outreach_targets" },
  { label: "marketplace_prospects", table: "marketplace_prospects" },
  { label: "contractor_leads", table: "contractor_leads" },
];

const DROP_THRESHOLD = 0.4; // 40%

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const results: any[] = [];
  const anomalies: string[] = [];

  for (const w of WATERFALLS) {
    const dateCol = (w as any).dateCol ?? "created_at";
    // today's count — uses updated_at for cumulative tables, created_at for daily-feed tables
    const { count: todayCount } = await sb.from(w.table).select("id", { head: true, count: "exact" })
      .gte(dateCol, today.toISOString()).lt(dateCol, tomorrow.toISOString());
    const todayN = todayCount ?? 0;

    // upsert today's snapshot
    await sb.from("registry_qa_snapshots").upsert({
      snapshot_date: today.toISOString().slice(0, 10),
      waterfall: w.label,
      signal_count: todayN,
    }, { onConflict: "snapshot_date,waterfall" });

    // fetch yesterday's snapshot
    const { data: y } = await sb.from("registry_qa_snapshots").select("signal_count")
      .eq("snapshot_date", yesterday.toISOString().slice(0, 10))
      .eq("waterfall", w.label).maybeSingle();
    const yN = y?.signal_count ?? 0;

    const delta = yN === 0 ? 0 : (yN - todayN) / yN;
    if (yN > 5 && delta > DROP_THRESHOLD) {
      anomalies.push(`${w.label}: ${yN} → ${todayN} (-${Math.round(delta * 100)}%)`);
    }
    results.push({ waterfall: w.label, yesterday: yN, today: todayN, drop_pct: Math.round(delta * 100) });
  }

  if (anomalies.length > 0) {
    const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE");
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (ADMIN_PHONE && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: TWILIO_FROM, To: ADMIN_PHONE,
            Body: `📉 Registry QA anomalies:\n${anomalies.slice(0, 5).join("\n")}`,
          }).toString(),
        });
      } catch { /* swallow */ }
    }
  }

  return new Response(JSON.stringify({ ok: true, results, anomalies }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
