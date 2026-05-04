// cold-email-ramp-scheduler
// Daily deliverability-aware ramp. Reads last 24h sends + bounce/complaint
// rates from email_send_log and adjusts current_cap accordingly:
//  - bounce% > threshold OR complaint% > threshold  → halve cap, set paused
//  - clean window                                   → cap += step_per_day (cap at ceiling)
//  - manual paused                                  → no change
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLD_TEMPLATES = [
  "cold_outreach",
  "multi_service_pitch_1","multi_service_pitch_2","multi_service_pitch_3",
  "web_drip_d1","web_drip_d4","web_drip_d8","web_drip_d15",
  "techalert_cold_outreach","techalert_followup_d3","techalert_followup_d7","techalert_followup_d14",
  "contractor_drip_d0","contractor_drip_d3","contractor_drip_d7","contractor_drip_d14",
  "dossier_cold_outreach",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";

    const { data: state, error: stateErr } = await sb
      .from("cold_email_ramp_state").select("*").eq("id", 1).maybeSingle();
    if (stateErr || !state) throw new Error(`state load failed: ${stateErr?.message}`);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error: logErr } = await sb
      .from("email_send_log")
      .select("message_id,status,template_name,created_at")
      .in("template_name", COLD_TEMPLATES)
      .gte("created_at", since);
    if (logErr) throw new Error(`log query failed: ${logErr.message}`);

    // Dedupe by message_id, keep terminal status
    const byMsg = new Map<string, string>();
    for (const r of rows || []) {
      const k = (r as any).message_id || `${(r as any).created_at}-${Math.random()}`;
      const cur = byMsg.get(k);
      const s = (r as any).status;
      if (!cur || ["sent","bounced","complained"].includes(s)) byMsg.set(k, s);
    }
    const sent24h = byMsg.size;
    let bounced = 0, complained = 0;
    for (const s of byMsg.values()) {
      if (s === "bounced") bounced++;
      else if (s === "complained") complained++;
    }
    const bouncePct = sent24h ? (bounced / sent24h) * 100 : 0;
    const complaintPct = sent24h ? (complained / sent24h) * 100 : 0;

    const dayIndex = Math.max(0,
      Math.floor((Date.now() - new Date(state.ramp_start_date).getTime()) / 86400000));

    const prevCap = state.current_cap as number;
    let newCap = prevCap;
    let action = "hold";
    let pause = state.paused as boolean;
    let pauseReason: string | null = state.pause_reason ?? null;
    let notes = "";

    if (state.paused) {
      action = "paused-manual";
    } else if (bouncePct > Number(state.bounce_threshold_pct)) {
      newCap = Math.max(state.base_cap, Math.floor(prevCap / 2));
      pause = true;
      pauseReason = `bounce ${bouncePct.toFixed(2)}% > ${state.bounce_threshold_pct}%`;
      action = "halved-bounce";
    } else if (complaintPct > Number(state.complaint_threshold_pct)) {
      newCap = Math.max(state.base_cap, Math.floor(prevCap / 2));
      pause = true;
      pauseReason = `complaint ${complaintPct.toFixed(2)}% > ${state.complaint_threshold_pct}%`;
      action = "halved-complaint";
    } else if (sent24h >= prevCap * 0.8) {
      newCap = Math.min(state.ceiling, prevCap + state.step_per_day);
      action = newCap > prevCap ? "ramp-up" : "ceiling";
    } else {
      action = "hold-low-volume";
      notes = `sent24h=${sent24h} < 80% of cap`;
    }

    if (!dryRun) {
      await sb.from("cold_email_ramp_state").update({
        current_cap: newCap,
        paused: pause,
        pause_reason: pauseReason,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);

      await sb.from("cold_email_ramp_history").insert({
        day_index: dayIndex,
        sent_24h: sent24h,
        bounce_pct: Number(bouncePct.toFixed(3)),
        complaint_pct: Number(complaintPct.toFixed(3)),
        prev_cap: prevCap,
        new_cap: newCap,
        action,
        notes,
      });

      if (action === "halved-bounce" || action === "halved-complaint") {
        await sendSMS(ADMIN_PHONE,
          `🚨 Cold email ramp HALVED + paused. ${pauseReason}. Cap ${prevCap}→${newCap}. /dwa-admin/cold-email-ramp`
        ).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      ok: true, dryRun, dayIndex, sent24h, bouncePct, complaintPct,
      prevCap, newCap, action, paused: pause, pauseReason,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
