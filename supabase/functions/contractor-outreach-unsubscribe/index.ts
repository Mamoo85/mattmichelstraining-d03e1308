// One-click unsubscribe endpoint for cold-email recipients (CAN-SPAM compliance).
// Writes to BOTH the prospect row AND the global suppression list so re-scraping
// the same business cannot re-add them to a campaign.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function htmlPage(message: string, ok: boolean): string {
  const color = ok ? "#00d4ff" : "#ff5577";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;color:#fff;max-width:480px;padding:40px">
  <div style="color:${color};font-size:32px;font-weight:900;letter-spacing:2px;margin-bottom:18px">${ok ? "✓" : "✗"}</div>
  <h1 style="font-size:22px;margin:0 0 12px">${message}</h1>
  <p style="color:#94a3b8;font-size:14px;margin:0">You will not receive any more emails from Detroit Web Agency.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(htmlPage("Invalid unsubscribe link", false), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the email so we can suppress it globally
    const { data: prospect, error: pErr } = await supabase
      .from("contractor_outreach_prospects")
      .select("id, email, phone")
      .eq("id", id)
      .single();
    if (pErr || !prospect) throw pErr || new Error("prospect not found");

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    // Mark prospect unsubscribed
    const { error: uErr } = await supabase
      .from("contractor_outreach_prospects")
      .update({
        unsubscribed_at: new Date().toISOString(),
        consent_for_sms: false,
        reply_status: "unsubscribe",
      })
      .eq("id", id);
    if (uErr) throw uErr;

    // Add email to global suppression (idempotent via unique constraint)
    if (prospect.email) {
      await supabase.from("contractor_outreach_suppression").upsert({
        contact: prospect.email,
        contact_type: "email",
        reason: "One-click unsubscribe",
        source: "unsubscribe_link",
      }, { onConflict: "contact,contact_type" });
    }

    // Audit log
    await supabase.from("contractor_outreach_audit_log").insert({
      prospect_id: id,
      channel: "email",
      event: "unsubscribed",
      reason: "One-click unsubscribe link",
      ip_address: ip,
      user_agent: ua,
      actor: "recipient",
    });

    return new Response(htmlPage("You're unsubscribed.", true), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (e: any) {
    console.error("unsubscribe error", e);
    return new Response(htmlPage("Unsubscribe failed — email matt@detroitwebagent.com to remove manually.", false), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});
