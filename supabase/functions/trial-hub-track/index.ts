// trial-hub-track — records UTM-tagged hub views, tile opens, email clicks,
// and CTA-step completions. Validates the bundle_token exists before insert.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_EVENTS = new Set([
  "hub_view", "tile_open", "email_click", "cta_step_completed", "setup_progress",
]);

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const bundle_token: string = String(body.bundle_token || "").slice(0, 200);
  const event_type: string = String(body.event_type || "");
  const product_key: string | null = body.product_key ? String(body.product_key).slice(0, 80) : null;
  const cta_step: string | null = body.cta_step ? String(body.cta_step).slice(0, 80) : null;
  const utm = (body.utm && typeof body.utm === "object") ? body.utm : null;
  const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : null;

  if (!bundle_token || !ALLOWED_EVENTS.has(event_type)) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Validate bundle exists (stops abuse via random tokens)
  const { data: bundle } = await sb
    .from("trial_bundles")
    .select("bundle_token, email")
    .eq("bundle_token", bundle_token)
    .maybeSingle();
  if (!bundle) {
    return new Response(JSON.stringify({ error: "bundle_not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ip_hash = ip ? await hashIp(ip) : null;
  const user_agent = (req.headers.get("user-agent") || "").slice(0, 500);
  const referrer = (body.referrer || req.headers.get("referer") || "").slice(0, 500);

  const { error: insErr } = await sb.from("trial_hub_events").insert({
    bundle_token,
    email: bundle.email,
    product_key,
    event_type,
    cta_step,
    utm,
    metadata,
    user_agent,
    referrer,
    ip_hash,
  });

  if (insErr) {
    return new Response(JSON.stringify({ error: "insert_failed", detail: insErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
