// trade-radar-referral
// Generates unique referral links for Trade Radar clients.
// When a referred signup converts, auto-extends the referrer's sub by 30 days.
//
// GET  ?email=client@email.com         → returns { referral_code, referral_url, referral_count, credits_earned }
// POST { action: "convert", code }     → called by stripe-webhook on new signup via referral; extends referrer sub
// POST { action: "generate", email }   → generates/returns code for a client

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";

function generateCode(email: string): string {
  const hash = Array.from(email.toLowerCase())
    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return `TR${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);

  // GET — return referral info for a client
  if (req.method === "GET") {
    const email = url.searchParams.get("email");
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: corsHeaders });

    const { data: client } = await sb
      .from("trade_radar_clients")
      .select("id, email, referral_code, referral_credits_days")
      .ilike("email", email)
      .maybeSingle();

    if (!client) return new Response(JSON.stringify({ error: "client not found" }), { status: 404, headers: corsHeaders });

    const code = client.referral_code || generateCode(email);

    // Ensure code is stored
    if (!client.referral_code) {
      await sb.from("trade_radar_clients").update({ referral_code: code }).eq("id", client.id);
    }

    // Count conversions
    const { count } = await sb
      .from("trade_radar_clients")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_code", code);

    return new Response(JSON.stringify({
      referral_code: code,
      referral_url: `${SITE_URL}/trade-radar?ref=${code}`,
      referral_count: count || 0,
      credits_days_earned: client.referral_credits_days || 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // POST
  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  const { action, code, email } = body;

  if (action === "generate") {
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: corsHeaders });

    const { data: client } = await sb
      .from("trade_radar_clients")
      .select("id, referral_code")
      .ilike("email", String(email))
      .maybeSingle();

    if (!client) return new Response(JSON.stringify({ error: "client not found" }), { status: 404, headers: corsHeaders });

    const newCode = client.referral_code || generateCode(String(email));
    if (!client.referral_code) {
      await sb.from("trade_radar_clients").update({ referral_code: newCode }).eq("id", client.id);
    }

    return new Response(JSON.stringify({
      referral_code: newCode,
      referral_url: `${SITE_URL}/trade-radar?ref=${newCode}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "convert") {
    // Called by stripe-webhook when a new signup has ?ref=CODE in metadata
    if (!code) return new Response(JSON.stringify({ error: "code required" }), { status: 400, headers: corsHeaders });

    const { data: referrer } = await sb
      .from("trade_radar_clients")
      .select("id, email, referral_credits_days")
      .eq("referral_code", String(code))
      .maybeSingle();

    if (!referrer) return new Response(JSON.stringify({ ok: false, reason: "referrer not found" }), { headers: corsHeaders });

    const newCredits = (referrer.referral_credits_days || 0) + 30;
    await sb.from("trade_radar_clients")
      .update({ referral_credits_days: newCredits })
      .eq("id", referrer.id);

    // Notify referrer
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && referrer.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
          to: [referrer.email],
          subject: "🎉 Your referral just signed up — 30 days free added!",
          html: `<div style="font-family:sans-serif;max-width:500px;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px">
<h2 style="color:#00d4ff;margin:0 0 16px">Your referral converted!</h2>
<p>Someone you referred just signed up for Trade Radar. We've added <strong style="color:#34d399">30 free days</strong> to your account — you now have <strong>${newCredits} days</strong> of referral credits banked.</p>
<p style="color:#94a3b8;font-size:14px">Keep sharing your link to earn more free months: <a href="${SITE_URL}/trade-radar?ref=${code}" style="color:#00d4ff">${SITE_URL}/trade-radar?ref=${code}</a></p>
<p style="color:#64748b;font-size:13px;margin-top:24px">— Matt Michels · Detroit Web Agency</p>
</div>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, referrer_id: referrer.id, new_credits_days: newCredits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: corsHeaders });
});
