// dossier-share-page — public HTML page rendered server-side from a share token.
// Tracks views (IP-hash + user-agent), records dwell pings, and renders the
// dossier inline so recipients never need to log in.
//
// GET /functions/v1/dossier-share-page?token=XYZ → HTML
// POST  → { token, event: 'view'|'dwell'|'cta_click', dwell_ms?, ip_hash? }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sha256Hex } from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  if (req.method === "POST") {
    try {
      const { token, event, dwell_ms } = await req.json();
      if (!token || !event) {
        return new Response(JSON.stringify({ error: "token and event required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "0.0.0.0";
      const ip_hash = await sha256Hex(ip);
      // Schema records dwell in seconds; map ms→s. Event type lives in user_agent suffix
      // because the table has no `event` column — keeps schema stable.
      const ua = (req.headers.get("user-agent") || "").slice(0, 180) + ` [${event}]`;
      await sb.from("dossier_share_views").insert({
        token, ip_hash, user_agent: ua,
        dwell_seconds: dwell_ms ? Math.round(dwell_ms / 1000) : null,
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const { data: t } = await sb.from("dossier_share_tokens")
    .select("signal_id, recipient_email, expires_at")
    .eq("token", token).maybeSingle();
  if (!t) return new Response("Link not found or expired", { status: 404 });
  if (t.expires_at && new Date(t.expires_at) < new Date()) {
    return new Response("This share link has expired.", { status: 410 });
  }

  // Record view (fire and forget) — schema has no `event` column; tag via user_agent suffix
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "0.0.0.0";
  const ipHash = await sha256Hex(ip);
  sb.from("dossier_share_views").insert({
    token, ip_hash: ipHash,
    user_agent: ((req.headers.get("user-agent") || "").slice(0, 180)) + " [view]",
  }).then(() => {}).catch(() => {});

  // Pull signal + dossier HTML
  const { data: signal } = await sb.from("growth_signals").select("*").eq("id", t.signal_id).maybeSingle();
  if (!signal) return new Response("Signal not found", { status: 404 });

  let dossierHtml = "";
  try {
    const r = await sb.functions.invoke("generate-signal-dossier", { body: { signal_id: t.signal_id } });
    dossierHtml = ((r.data as any)?.html as string) || "";
  } catch (e) {
    console.error("[share-page] dossier gen failed", e);
  }

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escape(signal.company_name || "Signal Dossier")} — Detroit Web Agency</title>
<meta name="robots" content="noindex,nofollow"/>
<style>
:root { color-scheme: dark; }
body { font:16px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; background:#0a1628; color:#e5e7eb; margin:0; }
.container { max-width: 760px; margin: 0 auto; padding: 24px 18px 80px; }
.brand { display:flex; align-items:center; gap:10px; padding-bottom:20px; border-bottom:1px solid #1f2937; }
.brand-dot { width:12px; height:12px; border-radius:50%; background:#00d4ff; box-shadow:0 0 18px #00d4ff; }
.brand h1 { font-size:14px; letter-spacing:.18em; text-transform:uppercase; color:#94a3b8; margin:0; }
.dossier { margin-top:24px; }
.cta { position:sticky; bottom:0; background:linear-gradient(180deg, transparent, #0a1628 30%); padding:24px 0 12px; }
.cta a { display:block; background:#00d4ff; color:#0a1628; text-align:center; padding:14px 18px; border-radius:10px; font-weight:700; text-decoration:none; }
.cta a:hover { background:#00b8db; }
.footer { color:#64748b; font-size:12px; text-align:center; margin-top:24px; }
</style>
</head><body>
<div class="container">
  <div class="brand">
    <div class="brand-dot"></div>
    <h1>Detroit Web Agency · Demand Heat Sniper</h1>
  </div>
  <div class="dossier">${dossierHtml || `<p>Dossier rendering — refresh in a moment.</p>`}</div>
  <div class="cta">
    <a id="cta" href="https://detroitwebagent.com/get-dossier?signal=${escape(t.signal_id)}&from=share" target="_blank" rel="noopener">
      Unlock the contact pack &amp; full intel — $25
    </a>
  </div>
  <p class="footer">Public records intel · ${escape(signal.location || "Metro Detroit")} · Reply to the original email to talk to Matt directly.</p>
</div>
<script>
(function(){
  var token = ${JSON.stringify(token)};
  var start = Date.now();
  function ping(event, extra){
    try { fetch(window.location.pathname + window.location.search, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({token:token, event:event}, extra||{}))
    }); } catch(e){ console.warn("[silent-catch]", e instanceof Error ? e.message : e); }
  }
  document.getElementById('cta').addEventListener('click', function(){ ping('cta_click'); });
  window.addEventListener('beforeunload', function(){
    ping('dwell', { dwell_ms: Date.now() - start });
  });
})();
</script>
</body></html>`;
  return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
});
