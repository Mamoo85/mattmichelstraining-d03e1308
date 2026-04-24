// marketplace-share-token — Issue + redeem single-use 7-day signed share tokens.
// Redeem returns the dossier with contact info redacted (full intel visible).
// Includes IP-based rate limiting + per-token attempt cap to prevent brute-force.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limit knobs
const IP_WINDOW_SECS = 60;
const IP_MAX_ATTEMPTS = 20;          // per IP per minute
const IP_BLOCK_SECS = 10 * 60;       // 10 min lockout once exceeded
const TOKEN_MAX_ATTEMPTS = 8;        // per token total before it self-revokes

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
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

async function checkAndConsumeRateLimit(sb: any, ipHash: string): Promise<{ ok: boolean; retry_after?: number }> {
  const now = new Date();
  const { data: existing } = await sb.from("marketplace_redeem_rate_limits")
    .select("ip_hash, window_started_at, attempts, blocked_until")
    .eq("ip_hash", ipHash).maybeSingle();

  if (existing?.blocked_until && new Date(existing.blocked_until) > now) {
    return { ok: false, retry_after: Math.ceil((new Date(existing.blocked_until).getTime() - now.getTime()) / 1000) };
  }

  const windowStart = existing ? new Date(existing.window_started_at) : null;
  const windowExpired = !windowStart || (now.getTime() - windowStart.getTime()) > IP_WINDOW_SECS * 1000;

  if (!existing || windowExpired) {
    await sb.from("marketplace_redeem_rate_limits").upsert({
      ip_hash: ipHash,
      window_started_at: now.toISOString(),
      attempts: 1,
      blocked_until: null,
      updated_at: now.toISOString(),
    });
    return { ok: true };
  }

  const attempts = (existing.attempts || 0) + 1;
  if (attempts > IP_MAX_ATTEMPTS) {
    const blockUntil = new Date(now.getTime() + IP_BLOCK_SECS * 1000).toISOString();
    await sb.from("marketplace_redeem_rate_limits").update({
      attempts, blocked_until: blockUntil, updated_at: now.toISOString(),
    }).eq("ip_hash", ipHash);
    return { ok: false, retry_after: IP_BLOCK_SECS };
  }
  await sb.from("marketplace_redeem_rate_limits").update({
    attempts, updated_at: now.toISOString(),
  }).eq("ip_hash", ipHash);
  return { ok: true };
}

async function logRedeem(sb: any, params: {
  share_id?: string | null; token_hash: string; ip_hash: string; ua: string; outcome: string; reason?: string;
}) {
  await sb.from("marketplace_share_redeem_log").insert({
    share_id: params.share_id ?? null,
    token_hash: params.token_hash,
    ip_hash: params.ip_hash,
    user_agent: params.ua.slice(0, 300),
    outcome: params.outcome,
    reason: params.reason ?? null,
  }).then(() => {}, () => {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const ipHash = await sha256Hex(ip);

  // ── Redeem (GET ?token=…)
  if (req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    const tokenHash = token ? await sha256Hex(token) : "";

    if (!token || token.length < 24 || !/^[a-f0-9]+$/i.test(token)) {
      await logRedeem(sb, { token_hash: tokenHash || "invalid", ip_hash: ipHash, ua, outcome: "rejected", reason: "malformed" });
      return new Response(JSON.stringify({ error: "token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rl = await checkAndConsumeRateLimit(sb, ipHash);
    if (!rl.ok) {
      await logRedeem(sb, { token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rate_limited", reason: `retry_after=${rl.retry_after}` });
      return new Response(JSON.stringify({ error: "rate_limited", retry_after: rl.retry_after }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retry_after || 60) } });
    }

    const { data: share } = await sb.from("marketplace_lead_shares")
      .select("*").eq("share_token", token).maybeSingle();

    if (!share) {
      await logRedeem(sb, { token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rejected", reason: "not_found" });
      return new Response(JSON.stringify({ error: "invalid_token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (share.revoked_at) {
      await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rejected", reason: "revoked" });
      return new Response(JSON.stringify({ error: "revoked" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rejected", reason: "expired" });
      return new Response(JSON.stringify({ error: "expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((share.redeem_attempts || 0) >= TOKEN_MAX_ATTEMPTS) {
      // Self-revoke abused token
      await sb.from("marketplace_lead_shares").update({ revoked_at: new Date().toISOString() }).eq("id", share.id);
      await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "auto_revoked", reason: "attempt_cap" });
      return new Response(JSON.stringify({ error: "revoked" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (share.max_redeems && (share.redeemed_count || 0) >= share.max_redeems) {
      await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rejected", reason: "max_redeems" });
      return new Response(JSON.stringify({ error: "max_redeems_reached" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: lead } = await sb.from("unified_lead_marketplace_view" as any)
      .select("*").eq("id", share.lead_id).maybeSingle();
    if (!lead) {
      await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "rejected", reason: "lead_missing" });
      return new Response(JSON.stringify({ error: "lead_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sb.from("marketplace_lead_shares").update({
      redeemed_at: share.redeemed_at || new Date().toISOString(),
      redeemed_count: (share.redeemed_count || 0) + 1,
      redeem_attempts: (share.redeem_attempts || 0) + 1,
      last_redeem_ip_hash: ipHash,
      last_redeem_at: new Date().toISOString(),
    }).eq("id", share.id);

    await logRedeem(sb, { share_id: share.id, token_hash: tokenHash, ip_hash: ipHash, ua, outcome: "success" });

    const redacted = {
      ...lead,
      full_name: maskName((lead as any).full_name),
      phone: maskPhone((lead as any).phone),
      email: maskEmail((lead as any).email),
      address: null,
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

    const { data: lock } = await sb.from("marketplace_lead_locks")
      .select("status, buyer_email, revoked_at, access_expires_at")
      .eq("lead_id", lead_id).maybeSingle();
    if (!lock || lock.status !== "sold" || lock.buyer_email !== String(buyer_email).toLowerCase()) {
      return new Response(JSON.stringify({ error: "not_owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (lock.revoked_at || (lock.access_expires_at && new Date(lock.access_expires_at) < new Date())) {
      return new Response(JSON.stringify({ error: "access_expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = makeToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("marketplace_lead_shares").insert({
      lead_id,
      product: product || "mortgage",
      shared_by_email: String(buyer_email).toLowerCase(),
      share_token: token,
      expires_at: expires,
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
