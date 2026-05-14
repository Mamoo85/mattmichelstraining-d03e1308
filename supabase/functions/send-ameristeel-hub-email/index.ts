// One-shot: send Tripp at AmeriSteel a single email with the unified trial hub link.
import { dwaWrap } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const to = "tdamman@ameristeel.com";
  const hub = "https://detroitwebagent.com/hub/ameristeel-2026-trial-hub";
  const subject = "Tripp — your AmeriSteel trial dashboard (one link, all 5 tools)";

  const body = `
    <p>Tripp,</p>
    <p>Set up a single dashboard for AmeriSteel with all 5 trials wired in — SiteRadar, Missed-Call Catch, Demand Radar, Buyer Radar, and Industry Pulse.</p>
    <p>One link, no logins, everything live:</p>
    <p style="margin:24px 0;">
      <a href="${hub}" style="background:#00d4ff;color:#0a1628;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;">
        Open Your AmeriSteel Trial Dashboard →
      </a>
    </p>
    <p style="color:#475569;font-size:14px;">${hub}</p>
    <p>Trials run 7 days. If anything looks off or you want me to walk you through it, just reply or call <strong>(313) 992-1219</strong>.</p>
    <p>— Matt Michels<br/>Detroit Web Agency</p>
  `;

  const html = dwaWrap(body);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
      reply_to: "matt@detroitwebagent.com",
    }),
  });

  const out = await r.json();
  return new Response(JSON.stringify({ ok: r.ok, response: out }), {
    status: r.ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
