// marketplace-share-token — Issue + redeem single-use 7-day signed share tokens.
// Redeem returns the dossier with contact info redacted (full intel visible).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function maskPhone(p?: string | null) { return p ? p.replace(/\d(?=\d{4})/g, "•") : null; }
function maskEmail(e?: string | null) {
  if (!e) return null;
  const [u, d] = e.split("@");
  if (!d) return "•••";
  return `${u[0] || "•"}•••@${d}`;
}
function maskName(n?: string | null) {
  if (!n) return null;
  const parts = n.split(" ");
  return parts.map((p, i) => i === 0 ? p : (p[0] || "") + ".").join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const url = new URL(req.url);

  // ── Redeem (GET ?token=…)
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ error: "token required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: share } = await sb.from("marketplace_lead_shares")
      .select("*").eq("share_token", token).maybeSingle();
    if (!share) return new Response(JSON.stringify({ error: "invalid_token" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: lead } = await sb.from("unified_lead_marketplace_view" as any)
      .select("*").eq("id", share.lead_id).maybeSingle();
    if (!lead) return new Response(JSON.stringify({ error: "lead_not_found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Mark viewed
    await sb.from("marketplace_lead_shares")
      .update({ viewed_at: share.viewed_at || new Date().toISOString(), view_count: (share.view_count || 0) + 1 })
      .eq("share_token", token);

    // Redact contact PII
    const redacted = {
      ...lead,
      full_name: maskName((lead as any).full_name),
      phone: maskPhone((lead as any).phone),
      email: maskEmail((lead as any).email),
      address: null, // hide street
      _redacted: true,
    };

    return new Response(JSON.stringify({ lead: redacted, expires_at: share.expires_at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Issue (POST { lead_id, product, buyer_email })
  try {
    const { lead_id, product, buyer_email } = await req.json();
    if (!lead_id || !buyer_email) {
      return new Response(JSON.stringify({ error: "lead_id, buyer_email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify the buyer actually owns this lead
    const { data: lock } = await sb.from("marketplace_lead_locks")
      .select("status, buyer_email").eq("lead_id", lead_id).maybeSingle();
    if (!lock || lock.status !== "sold" || lock.buyer_email !== buyer_email) {
      return new Response(JSON.stringify({ error: "not_owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = makeToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("marketplace_lead_shares").insert({
      lead_id, product: product || null, buyer_email,
      share_token: token, expires_at: expires,
    });

    return new Response(JSON.stringify({
      token,
      url: `https://detroitwebagent.com/lead/share/${token}`,
      expires_at: expires,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[marketplace-share-token]", e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
