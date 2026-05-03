// cold-email-volume-sentinel
// Runs daily at 9pm ET. Counts unique cold emails sent today. If under 150,
// SMS Matt and trigger emergency top-off runs of multi-service-drip,
// web-design-drip, and prospect-local-businesses to backfill.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const FLOOR = 150;

const COLD_TEMPLATES = [
  "cold_outreach",
  "multi_service_pitch_1", "multi_service_pitch_2", "multi_service_pitch_3",
  "web_drip_d1", "web_drip_d4", "web_drip_d8", "web_drip_d15",
  "techalert_cold_outreach", "techalert_followup_d3", "techalert_followup_d7", "techalert_followup_d14",
  "contractor_drip_d0", "contractor_drip_d3", "contractor_drip_d7", "contractor_drip_d14",
  "dossier_cold_outreach",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date().toISOString().split("T")[0];

    // Distinct message_id, sent today, status='sent', cold templates only
    const { data, error } = await sb.rpc("count_cold_emails_today" as any, { d: today }).maybeSingle();
    let count = 0;
    if (!error && data && typeof (data as any).count === "number") {
      count = (data as any).count;
    } else {
      // Fallback: in-app count via select
      const { data: rows } = await sb
        .from("email_send_log")
        .select("message_id")
        .in("template_name", COLD_TEMPLATES)
        .eq("status", "sent")
        .gte("created_at", `${today}T00:00:00Z`);
      const set = new Set((rows || []).map((r: any) => r.message_id).filter(Boolean));
      count = set.size;
    }

    const shortfall = Math.max(0, FLOOR - count);
    let topupResults: any = null;

    if (shortfall > 0) {
      // Delegate to rebalancer — it inventories supply per pool and routes
      // to the senders that actually have leads available.
      const { data, error: rebErr } = await sb.functions.invoke("cold-email-rebalancer", {
        body: { force: true, target: FLOOR },
      });
      topupResults = rebErr ? { error: rebErr.message } : data;

      await sendSMS(
        ADMIN_PHONE,
        `⚠️ COLD EMAIL FLOOR MISS: ${count}/${FLOOR} sent today (short ${shortfall}). ` +
        `Rebalancer fired across all live pools. Check /dwa-admin/cold-email-audit.`,
      );
    }

    return new Response(JSON.stringify({ ok: true, count, floor: FLOOR, shortfall, topupResults }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendSMS(ADMIN_PHONE, `Cold email sentinel ERROR: ${msg}`).catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
