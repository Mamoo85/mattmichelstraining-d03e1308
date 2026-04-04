import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { recipient_name, session_type, message, referrer_user_id } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Generate unique code
    const code = "M2-" + crypto.randomUUID().substring(0, 8).toUpperCase();

    // Store in session_referral_rewards
    await sb.from("session_referral_rewards").insert({
      referrer_user_id: referrer_user_id || "00000000-0000-0000-0000-000000000000",
      referred_friend_email: "gift-card",
      session_type: session_type || "60_min",
      status: "credited",
      note: `Gift card for ${recipient_name || "Unnamed"}. Code: ${code}. ${message || ""}`,
      credited_at: new Date().toISOString(),
    });

    const sessionLabel = session_type === "30_min" ? "30-Minute" : "1-Hour";
    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px;font-family:Arial,sans-serif;background:#1e293b;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.2);">
    <div style="background:#e8621a;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">M2 Development</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Gift Card</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:18px;color:#333;">This card entitles</p>
      <h2 style="font-size:24px;color:#1e293b;margin:8px 0;">${recipient_name || "You"}</h2>
      <p style="font-size:18px;color:#333;">to one</p>
      <h3 style="font-size:22px;color:#e8621a;margin:8px 0;">${sessionLabel} Training Session</h3>
      ${message ? `<p style="font-style:italic;color:#666;margin:16px 0;">"${message}"</p>` : ""}
      <div style="margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px;">
        <p style="font-size:12px;color:#666;margin:0 0 4px;">Redemption Code</p>
        <p style="font-size:24px;font-weight:bold;color:#1e293b;margin:0;letter-spacing:2px;">${code}</p>
      </div>
      <p style="font-size:14px;color:#666;">Book at <a href="https://www.mattmichelstraining.com/schedule" style="color:#e8621a;">mattmichelstraining.com/schedule</a></p>
    </div>
    <div style="padding:16px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
      Grosse Pointe, MI · (313) 806-4952 · matt@mattmichelstraining.com
    </div>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({ code, html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GIFT-CARD] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
