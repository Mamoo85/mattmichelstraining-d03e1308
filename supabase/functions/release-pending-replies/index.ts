// release-pending-replies — cron: every minute
// Finds email_reply_drafts where send_after <= now() AND cancelled=false AND sent=false
// Sends each via Resend, then marks sent=true.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const FROM_EMAIL = "Matt Michels <matt@detroitwebagent.com>";
const REPLY_TO = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Fetch all pending drafts whose delay has elapsed
    const { data: drafts, error } = await sb
      .from("email_reply_drafts")
      .select("*")
      .lte("send_after", new Date().toISOString())
      .eq("cancelled", false)
      .eq("sent", false)
      .limit(50);

    if (error) throw error;
    if (!drafts || drafts.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[release-pending-replies] Sending ${drafts.length} pending drafts`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      try {
        // Mark sent=true FIRST (optimistic) to avoid double-send on retry
        await sb.from("email_reply_drafts").update({ sent: true }).eq("id", draft.id);

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [draft.lead_email],
            reply_to: REPLY_TO,
            subject: draft.draft_subject,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:520px;margin:0 auto;padding:24px 0;">
<p>${draft.draft_body.replace(/\n/g, "<br>")}</p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · Grosse Pointe, MI<br>(313) 992-1219</div>
</div>
</div>`,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          // Roll back sent=true so it can retry
          await sb.from("email_reply_drafts").update({ sent: false }).eq("id", draft.id);
          errors.push(`${draft.lead_email}: ${errText}`);
        } else {
          sentCount++;
          console.log(`[release-pending-replies] Sent to ${draft.lead_email} (${draft.category})`);
        }
      } catch (e) {
        // Roll back on unexpected error
        await sb.from("email_reply_drafts").update({ sent: false }).eq("id", draft.id);
        errors.push(`${draft.lead_email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[release-pending-replies] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
