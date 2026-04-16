import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Multi-touch drip sequence for TechAlert candidates.
 * Creates automated follow-up sequence when new candidates are found:
 * Day 0: SMS alert (immediate)
 * Day 1: Email with full profile
 * Day 2: "Still available" nudge SMS
 * Day 3: "2 others viewing" FOMO SMS
 * Day 4: "Claim expires tomorrow" urgency SMS
 *
 * Called by cron every hour — processes pending drip steps.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

    // Get pending drip steps
    const now = new Date().toISOString();
    const { data: pendingSteps } = await supabase
      .from("techalert_drip_queue")
      .select("*, hire_alert_clients(company_name, email, phone)")
      .eq("sent", false)
      .lte("send_at", now)
      .order("send_at")
      .limit(50);

    if (!pendingSteps?.length) {
      return new Response(JSON.stringify({ processed: 0, reason: "No pending drip steps" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let errors = 0;

    for (const step of pendingSteps) {
      const client = step.hire_alert_clients;
      if (!client) continue;

      try {
        if (step.channel === "sms" && client.phone) {
          await sendSMS(supabase, {
            to: client.phone,
            body: step.message,
            client_id: step.client_id,
            purpose: `techalert_drip_step_${step.step_number}`,
          });
          sent++;
        } else if (step.channel === "email" && client.email && RESEND_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "TechAlert <alerts@detroitwebagent.com>",
              to: client.email,
              subject: step.subject || "New candidate update",
              html: step.message,
            }),
          });
          sent++;
        }

        // Mark as sent
        await supabase
          .from("techalert_drip_queue")
          .update({ sent: true, sent_at: now })
          .eq("id", step.id);
      } catch {
        errors++;
      }
    }

    return new Response(JSON.stringify({ processed: pendingSteps.length, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
