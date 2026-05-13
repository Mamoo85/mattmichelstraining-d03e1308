// enrichment-health-alerter — runs every 15 min via cron.
// Checks enrichment_provider_health for Apollo / Hunter / Snov / PDL.
// SMS Matt + log if any provider is silently zeroing out.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/twilio.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const PROVIDERS = ["apollo", "hunter", "snov", "pdl"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const issues: string[] = [];

  for (const p of PROVIDERS) {
    const { data } = await sb
      .from("enrichment_provider_health")
      .select("provider, last_429_at, credits_remaining, daily_calls, daily_hits, disabled_until")
      .eq("provider", p)
      .maybeSingle();
    if (!data) continue;
    const ageMs = data.last_429_at ? Date.now() - new Date(data.last_429_at).getTime() : Infinity;
    if (ageMs < 15 * 60 * 1000) issues.push(`${p}: 429 in last 15m`);
    if (typeof data.credits_remaining === "number" && data.credits_remaining <= 0) issues.push(`${p}: credits=0`);
    if (data.disabled_until && new Date(data.disabled_until).getTime() > Date.now()) issues.push(`${p}: disabled`);
    const calls = data.daily_calls ?? 0;
    const hits = data.daily_hits ?? 0;
    if (calls >= 50 && hits / Math.max(calls, 1) < 0.02) {
      issues.push(`${p}: hit-rate ${((hits / calls) * 100).toFixed(1)}% over ${calls} calls`);
    }
  }

  // De-dupe: only SMS if last alert >60min ago
  if (issues.length) {
    const { data: last } = await sb
      .from("enrichment_health_alerts")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const recent = last ? Date.now() - new Date(last.created_at).getTime() < 60 * 60 * 1000 : false;
    if (!recent) {
      await sb.from("enrichment_health_alerts").insert({ issues, alerted_at: new Date().toISOString() }).then(() => {}).catch(() => {});
      try { await sendSMS(ADMIN, TWILIO_FROM, `⚠️ Enrichment health: ${issues.join("; ")}`, "enrichment-health"); } catch { /* swallow */ }
    }
  }

  return new Response(JSON.stringify({ ok: true, issues }), { headers: { ...cors, "Content-Type": "application/json" } });
});
