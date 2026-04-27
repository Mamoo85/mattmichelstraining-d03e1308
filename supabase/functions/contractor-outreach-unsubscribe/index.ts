// One-click unsubscribe endpoint for cold-email recipients (CAN-SPAM compliance).
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
    const { error } = await supabase
      .from("contractor_outreach_prospects")
      .update({
        unsubscribed_at: new Date().toISOString(),
        consent_for_sms: false,
        reply_status: "unsubscribe",
      })
      .eq("id", id);
    if (error) throw error;
    return new Response(htmlPage("You're unsubscribed.", true), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (e: any) {
    return new Response(htmlPage("Unsubscribe failed — email matt@detroitwebagent.com to remove manually.", false), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});
