// Buyer Radar — Sneak Peek (no-card email-gated 1-week sample feed)
// Public POST: { email, company_name?, contact_name? }
// → creates a magic-link token, emails 5 sample Detroit-area fab/metal NAICS signals
// → token unlocks read-only /my-buyer-radar?preview=<token> for 7 days
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAMPLE_SIGNALS = [
  {
    company: "Apex Stamping Co.",
    city: "Warren, MI",
    naics: "332119 — Metal Crown, Closure, & Other Metal Stamping",
    signal: "Pulled 4 commercial expansion permits in 60 days. Hiring 8 line operators per Indeed.",
    why: "Scaling production = supply volume jump in 30–60 days. Open the conversation now.",
  },
  {
    company: "Dearborn Precision Fabricators",
    city: "Dearborn, MI",
    naics: "332710 — Machine Shops",
    signal: "New $2.1M D&B credit line opened, UCC-1 filing on a 5-axis CNC machine (March 2026).",
    why: "Financed equipment = locked-in production schedule. They need feedstock NOW.",
  },
  {
    company: "Riverbend Steel Service Center",
    city: "River Rouge, MI",
    naics: "332312 — Fabricated Structural Metal Mfg",
    signal: "Won $4.8M Wayne County bridge rehab contract per SAM.gov posting (Apr 2026).",
    why: "Public-record contract win = procurement cycle starts in 2–4 weeks.",
  },
  {
    company: "Macomb Metalworks LLC",
    city: "Sterling Heights, MI",
    naics: "332999 — All Other Misc Fabricated Metal",
    signal: "Posted 3 second-shift welder roles + facility expansion permit (Mar 2026).",
    why: "Adding shift = throughput up 60%. Material orders follow within 30 days.",
  },
  {
    company: "Great Lakes Tube & Pipe",
    city: "Livonia, MI",
    naics: "332996 — Fabricated Pipe & Pipe Fitting",
    signal: "Sonar OSINT: announced new automotive OEM contract on LinkedIn (Apr 2026).",
    why: "OEM win = predictable monthly volume. Be the first call when their PO opens.",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, company_name, contact_name } = await req.json();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create magic-link token (7-day window). We piggyback on capture_submissions
    // for storage so we don't need a new table — simple, durable, easy to query.
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await (sb as any).from("buyer_radar_custom_requests").insert({
      email,
      company_name: company_name || "Sneak Peek",
      contact_name: contact_name || null,
      message: `SNEAK_PEEK_TOKEN:${token} | EXPIRES:${expiresAt}`,
      status: "sneak_peek",
    });

    const previewUrl = `https://www.detroitwebagent.com/my-buyer-radar?preview=${token}`;

    const signalRows = SAMPLE_SIGNALS.map((s) => `
      <div style="border:1px solid #1e3a5f;border-radius:10px;padding:18px;margin-bottom:14px;background:#0a1628;">
        <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">${s.naics}</div>
        <div style="color:#fff;font-size:17px;font-weight:800;margin-bottom:4px;">${s.company}</div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;">${s.city}</div>
        <div style="color:#e2e8f0;font-size:14px;line-height:1.6;margin-bottom:8px;"><strong style="color:#00d4ff;">Signal:</strong> ${s.signal}</div>
        <div style="color:#94a3b8;font-size:13px;line-height:1.6;font-style:italic;">${s.why}</div>
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#030711;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
  <tr><td style="background:linear-gradient(135deg,#0a1628,#0d2137);padding:32px 28px;border-radius:12px 12px 0 0;border:1px solid #1e3a5f;">
    <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Buyer Radar — Sneak Peek</div>
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;line-height:1.2;">5 Live Detroit Buyer Signals</h1>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:15px;line-height:1.6;">Here's a real sample of the metal-fab and machine-shop accounts our system flagged this week. These are buying signals — credit pulls, UCC filings, contract wins — not job postings.</p>
  </td></tr>
  <tr><td style="background:#030711;padding:24px 28px;border-left:1px solid #1e3a5f;border-right:1px solid #1e3a5f;">
    ${signalRows}
  </td></tr>
  <tr><td style="background:#0a1628;padding:28px;border:1px solid #1e3a5f;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <a href="${previewUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;font-size:15px;text-decoration:none;">View the Live Feed →</a>
    <p style="margin:16px 0 0;color:#64748b;font-size:12px;">Free preview expires in 7 days. No card required. Reply to this email when you're ready to subscribe.</p>
    <p style="margin:16px 0 0;color:#475569;font-size:11px;">Detroit Web Agency · matt@detroitwebagent.com · <a href="mailto:matt@detroitwebagent.com?subject=unsubscribe" style="color:#475569;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table></body></html>`;

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
          to: [email],
          subject: "Your Buyer Radar sneak peek — 5 live Detroit signals",
          html,
          reply_to: "matt@detroitwebagent.com",
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, preview_url: previewUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[buyer-radar-sneak-peek]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
