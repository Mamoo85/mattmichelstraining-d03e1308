// Send a short follow-up SMS to Pat asking him to approve the pitch email
// and confirm the FieldServio/FieldDesk parallel-run timeline.
// Respects the marketing kill switch.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/twilio.ts";
import { isMarketingBlocked, logPitchAudit } from "../_shared/marketing-kill-switch.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAT_PHONE = "+13135551234"; // TODO: replace with Pat's real cell when confirmed
const DEFAULT_MSG =
  "Hey Pat — Matt @ Detroit Web Agency. Did the pitch email land? " +
  "Two quick yes/no's so I can lock your build slot:\n" +
  "1) Approve the v4 demo direction (teal + red, your real brand)?\n" +
  "2) OK to run FieldDesk parallel to FieldServio for 30 days (zero risk, no replacement)?\n" +
  "Reply YES/NO to each or call (313) 992-1219. — Matt";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const to: string = String(body.to || PAT_PHONE).trim();
    const message: string = String(body.message || DEFAULT_MSG);
    const force: boolean = body.force === true;

    if (!force) {
      const { blocked, reason } = await isMarketingBlocked(sb);
      if (blocked) {
        await logPitchAudit(sb, {
          template_name: "djconley_followup_sms",
          recipient_email: to,
          status: "blocked",
          error_message: `Kill switch ON${reason ? `: ${reason}` : ""}`,
          triggered_by: String(body.triggered_by || "manual"),
        });
        return new Response(JSON.stringify({ blocked: true }), { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const result = await sendSMS({ to, body: message });

    await logPitchAudit(sb, {
      template_name: "djconley_followup_sms",
      recipient_email: to,
      status: result?.sid ? "sent" : "failed",
      error_message: result?.error || undefined,
      triggered_by: String(body.triggered_by || "manual"),
      metadata: { sid: result?.sid },
    });

    return new Response(JSON.stringify({ sent: !!result?.sid, sid: result?.sid, error: result?.error }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-djconley-followup-sms] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
