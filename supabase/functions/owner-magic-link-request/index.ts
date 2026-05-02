import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const normalized = email.toLowerCase().trim();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify email is an active price-locked client
    const { data: lock } = await sb.from("client_price_locks").select("client_email").eq("client_email", normalized).maybeSingle();
    if (!lock) {
      // Don't leak existence — succeed silently
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await sb.from("owner_magic_tokens").insert({ email: normalized, token_hash: tokenHash, expires_at: expiresAt });

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const link = `${origin}/owner/verify?token=${encodeURIComponent(token)}`;

    // Send via Resend directly (DWA brand)
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt @ DWA <matt@detroitwebagent.com>",
        to: [normalized],
        subject: "🔐 Your DWA Owner Dashboard Login",
        html: `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #00d4ff;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">🔐 SECURE LOGIN</p><h1 style="color:#fff;font-size:22px;margin:0 0 16px;">One click to access your dashboard</h1><p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">Tap the button below to sign in. Link expires in 15 minutes.</p><a href="${link}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Open My Dashboard →</a><p style="color:#64748b;font-size:12px;margin:32px 0 0;border-top:1px solid #1e3a5f;padding-top:16px;">If you didn't request this, you can safely ignore this email.</p></div></div></body></html>`,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[owner-magic-link-request]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
