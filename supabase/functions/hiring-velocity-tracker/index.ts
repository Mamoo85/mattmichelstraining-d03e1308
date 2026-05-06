// hiring-velocity-tracker — Tracks week-over-week hiring acceleration per employer.
// Flags accounts that posted 1-2 roles last 30d but jumped to 4+ this week
// (= they just won a contract / lost staff). Drafts a "I noticed you're scaling
// fast" pitch into outreach_approval_queue.
//
// Idempotency: `velocity-${accountKey}-${isoWeek}` — one alert per employer per week.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isoWeek(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+dt - +yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400_000).toISOString();
    const d7 = new Date(now - 7 * 86400_000).toISOString();

    const { data: cands, error } = await sb
      .from("hire_alert_candidates")
      .select("current_employer, current_title, trade, license_type, city, state, first_seen_at")
      .not("current_employer", "is", null)
      .gte("first_seen_at", d30)
      .limit(5000);
    if (error) throw error;

    const stats = new Map<string, { last30: any[]; last7: any[] }>();
    for (const c of cands || []) {
      const emp = (c.current_employer || "").trim();
      if (!emp || emp.length < 3) continue;
      if (!stats.has(emp)) stats.set(emp, { last30: [], last7: [] });
      stats.get(emp)!.last30.push(c);
      if (c.first_seen_at >= d7) stats.get(emp)!.last7.push(c);
    }

    const week = isoWeek();
    let drafted = 0, skipped = 0;
    const accelerating: Array<[string, any]> = [];

    for (const [emp, s] of stats) {
      const baselinePerWeek = (s.last30.length - s.last7.length) / 3; // avg of prior 3 weeks
      const thisWeek = s.last7.length;
      // Velocity trigger: this week is 2.5x baseline AND >= 3 roles
      if (thisWeek >= 3 && thisWeek >= baselinePerWeek * 2.5 && baselinePerWeek <= 2) {
        accelerating.push([emp, { ...s, baseline: baselinePerWeek, thisWeek }]);
      }
    }

    accelerating.sort((a, b) => b[1].thisWeek - a[1].thisWeek);

    for (const [emp, s] of accelerating.slice(0, 20)) {
      const accountKey = `employer:${slug(emp)}`;
      const idem = `velocity-${accountKey}-${week}`;
      const { data: existing } = await sb
        .from("outreach_approval_queue")
        .select("id").eq("idempotency_key", idem).maybeSingle();
      if (existing) { skipped++; continue; }

      const city = s.last7[0]?.city || "";
      const state = s.last7[0]?.state || "MI";
      const roles = Array.from(new Set(s.last7.map((c: any) => c.current_title || c.trade).filter(Boolean))).slice(0, 5);
      const isHealthcare = s.last7.some((c: any) => /\b(rn|lpn|cna|nurse|home health)\b/i.test(`${c.trade} ${c.license_type}`));
      const product = isHealthcare ? "HireAlert Healthcare" : "TechAlert";

      const prompt = `Cold email to hiring lead at ${emp} (${city}, ${state}). They posted ~${s.baseline.toFixed(1)} roles/week recently but JUMPED to ${s.thisWeek} this week. Open roles include: ${roles.join(", ")}. Lead with: "Looks like you just won something big — ${s.thisWeek} new roles this week vs. your usual ${s.baseline.toFixed(1)}." Pitch ${product}: we surface licensed ${isHealthcare ? "RN/LPN/CNA" : "technicians"} within 48h of becoming available in their ZIP. 4 sentences. End with: "Want a sample list for ${roles[0]} this afternoon?"`;

      let body = "";
      try { body = await generateWithHaiku(prompt, "You are a B2B outbound copywriter. Direct, specific, no fluff.", 600); }
      catch (e) { await logError("hiring-velocity-tracker", "ai_fail", String(e), { emp }); continue; }
      if (!body || body.length < 50) { skipped++; continue; }

      const { error: insErr } = await sb.from("outreach_approval_queue").insert({
        source_function: "hiring-velocity-tracker",
        channel: "email",
        account_key: accountKey,
        account_name: emp,
        account_location: `${city}, ${state}`,
        account_vertical: isHealthcare ? "healthcare" : "trades",
        draft_subject: `${emp} — noticed the hiring spike`,
        draft_body: body,
        signal_reason: `Hiring velocity ${s.thisWeek}/wk vs ${s.baseline.toFixed(1)} baseline (${(s.thisWeek / Math.max(s.baseline, 0.5)).toFixed(1)}x acceleration)`,
        signal_payload: { roles, this_week: s.thisWeek, baseline: s.baseline, week },
        confidence_score: Math.min(0.95, 0.55 + s.thisWeek * 0.05),
        idempotency_key: idem,
      });
      if (insErr) { await logError("hiring-velocity-tracker", "insert_fail", insErr.message, { emp }); continue; }
      drafted++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: stats.size, accelerating: accelerating.length, drafted, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logError("hiring-velocity-tracker", "fatal", String(e), {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
