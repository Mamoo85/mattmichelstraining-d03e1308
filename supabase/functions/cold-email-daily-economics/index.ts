// cold-email-daily-economics
// Runs at 8 PM ET. Snapshots today's spend, sends, cost-per-send, cost-per-150,
// 7-day rolling avg cost-per-150, 30d spend vs attributed MRR. Texts Matt.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: econ } = await sb.from("cold_email_economics_today").select("*").maybeSingle();
    const sends = Number(econ?.sends_today || 0);
    const spendCents = Number(econ?.spend_today_cents || 0);
    const spend30d = Number(econ?.spend_30d_cents || 0);
    const mrrAttr = Number(econ?.mrr_attributed_cents || 0);
    const covers = !!econ?.mrr_covers_spend;

    const costPerSend = sends > 0 ? spendCents / sends : 0;
    const costPer150 = Math.round(costPerSend * 150);

    // Frugal mode flag
    const { data: cfg } = await sb
      .from("enrichment_walker_config")
      .select("value_text")
      .eq("key", "frugal_mode")
      .maybeSingle();
    const frugal = (cfg?.value_text || "true").toLowerCase() === "true";

    // Log today's row
    const today = new Date().toISOString().split("T")[0];
    await sb.from("cold_email_daily_cost_log").upsert({
      log_date: today,
      sends_count: sends,
      spend_cents: spendCents,
      cost_per_send_cents: costPerSend,
      cost_per_150_cents: costPer150,
      mrr_attributed_cents: mrrAttr,
      mrr_covers_spend: covers,
      frugal_mode: frugal,
    }, { onConflict: "log_date" });

    // 7-day rolling avg cost-per-150
    const { data: last7 } = await sb
      .from("cold_email_daily_cost_log")
      .select("cost_per_150_cents")
      .gte("log_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
    const avg7d = last7 && last7.length
      ? Math.round(last7.reduce((s: number, r: any) => s + Number(r.cost_per_150_cents || 0), 0) / last7.length)
      : costPer150;

    const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
    const sendCheck = sends >= 150 ? "✓" : "⚠";
    const modeLabel = frugal ? "FRUGAL 🔒" : "OPEN";
    const coverLine = covers
      ? `🟢 MRR ${fmt(mrrAttr)} covers 30d spend ${fmt(spend30d)} — scale-up unlocked`
      : `Mode: ${modeLabel}`;

    const sms =
      `📧 Cold Email Daily\n` +
      `Sent: ${sends}/150 ${sendCheck}\n` +
      `Spend: ${fmt(spendCents)} (${fmt(Math.round(costPerSend))}/send)\n` +
      `Cost to hit 150: ${fmt(costPer150)}\n` +
      `7d avg: ${fmt(avg7d)}/day\n` +
      `30d spend: ${fmt(spend30d)} | MRR cov: ${fmt(mrrAttr)}\n` +
      coverLine;

    await sendSMS(ADMIN_PHONE, sms).catch(() => {});

    return new Response(JSON.stringify({
      ok: true, sends, spendCents, costPer150, avg7d, spend30d, mrrAttr, covers, frugal, sms,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
