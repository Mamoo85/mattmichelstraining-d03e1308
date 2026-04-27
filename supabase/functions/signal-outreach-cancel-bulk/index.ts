// signal-outreach-cancel-bulk
// One-tap kill for any in-flight batch. Cancels:
//   - All pending sms_outreach_drafts for the signal (still in 10-min ghost delay)
//   - All email_reply_drafts referenced by signal_outreach_log for the signal
// Fax + postcard are non-cancellable (sent immediately to provider).
//
// GET /signal-outreach-cancel-bulk?signal_id=...

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const signal_id = url.searchParams.get("signal_id");
    if (!signal_id) {
      return new Response("missing signal_id", { status: 400, headers: corsHeaders });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Cancel SMS drafts still pending
    const { data: smsCancelled } = await sb.from("sms_outreach_drafts")
      .update({ status: "cancelled" })
      .eq("signal_id", signal_id)
      .eq("status", "pending")
      .select("id");

    // Find email draft IDs from the log + cancel them
    const { data: emailLogs } = await sb.from("signal_outreach_log")
      .select("draft_id")
      .eq("signal_id", signal_id)
      .eq("channel", "email")
      .eq("status", "queued");

    const emailDraftIds = (emailLogs || []).map((r) => r.draft_id).filter(Boolean);
    let emailCancelled = 0;
    if (emailDraftIds.length > 0) {
      const { data } = await sb.from("email_reply_drafts")
        .update({ cancelled: true } as any)
        .in("id", emailDraftIds)
        .eq("sent", false)
        .select("id");
      emailCancelled = data?.length || 0;
    }

    // Mark all queued log entries as cancelled
    await sb.from("signal_outreach_log")
      .update({ status: "cancelled" })
      .eq("signal_id", signal_id)
      .eq("status", "queued");

    const html = `<!DOCTYPE html><html><head><title>Cancelled</title><style>
      body{background:#0a1628;color:#fff;font-family:-apple-system,sans-serif;padding:40px;text-align:center;}
      h1{color:#00d4ff;}
      .stat{font-size:32px;color:#10b981;margin:20px 0;}
    </style></head><body>
      <h1>✓ Batch cancelled</h1>
      <div class="stat">${(smsCancelled?.length || 0)} SMS + ${emailCancelled} emails killed</div>
      <p style="color:#94a3b8;">Faxes/postcards already sent to provider cannot be recalled.</p>
    </body></html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cancel-bulk]", msg);
    return new Response(`error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});
