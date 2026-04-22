// industrial-pulse-unsubscribe (Channel 3 — public, GET)
// One-click unsubscribe for the Industrial Pulse newsletter.
// GET ?email=foo@bar.com → marks unsubscribed=true, returns plain confirmation page.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function html(message: string, isError = false): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Industrial Pulse</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:60px 20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;text-transform:uppercase;font-weight:700;margin-bottom:16px;">DETROIT INDUSTRIAL PULSE</div>
    <h1 style="font-size:24px;color:${isError ? "#fca5a5" : "#fff"};margin:0 0 16px 0;">${isError ? "Hmm." : "You're unsubscribed."}</h1>
    <p style="font-size:15px;color:#94a3b8;line-height:1.6;">${message}</p>
    <a href="https://www.detroitwebagent.com" style="display:inline-block;margin-top:24px;color:#00d4ff;text-decoration:none;font-size:14px;">← Detroit Web Agency</a>
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email")?.toLowerCase().trim() || "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(html("That unsubscribe link looks broken. Email matt@detroitwebagent.com if you need help.", true), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error } = await sb
      .from("industrial_pulse_subscribers")
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq("email", email);

    if (error) {
      console.error("[industrial-pulse-unsubscribe]", error);
      return new Response(html("Couldn't unsubscribe right now. Reply STOP to any email or contact matt@detroitwebagent.com.", true), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    return new Response(html(`You won't get any more Industrial Pulse emails at <strong style="color:#fff;">${email}</strong>. No hard feelings.`), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(html("Something broke. Email matt@detroitwebagent.com.", true), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});
