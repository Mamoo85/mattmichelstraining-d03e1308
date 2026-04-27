// release-pending-sms — cron: every minute
// Sends sms_outreach_drafts where send_after <= now() AND status='pending'

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: drafts, error } = await sb
      .from("sms_outreach_drafts")
      .select("*")
      .lte("send_after", new Date().toISOString())
      .eq("status", "pending")
      .limit(40);
    if (error) throw error;
    if (!drafts || drafts.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0, failed = 0;
    for (const d of drafts) {
      // Optimistic flip to avoid double-send
      await sb.from("sms_outreach_drafts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", d.id).eq("status", "pending");
      try {
        const r = await sendSMS(d.to_phone, FROM, d.body, "signal_outreach");
        if (!r.success) {
          await sb.from("sms_outreach_drafts").update({ status: "failed", error: r.error || "send fail" }).eq("id", d.id);
          await sb.from("signal_outreach_log").update({ status: "failed", error: r.error || "send fail" }).eq("draft_id", d.id);
          failed++;
        } else {
          await sb.from("sms_outreach_drafts").update({ external_id: (r as any).sid || null }).eq("id", d.id);
          await sb.from("signal_outreach_log").update({ status: "sent", sent_at: new Date().toISOString(), external_id: (r as any).sid || null }).eq("draft_id", d.id);
          sent++;
        }
      } catch (e: any) {
        await sb.from("sms_outreach_drafts").update({ status: "failed", error: e?.message || "exception" }).eq("id", d.id);
        await sb.from("signal_outreach_log").update({ status: "failed", error: e?.message || "exception" }).eq("draft_id", d.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[release-pending-sms]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
