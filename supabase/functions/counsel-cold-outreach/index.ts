// counsel-cold-outreach — daily 8am ET — sends D0 cold email to enriched MI attorney prospects
// 30/day cap. Professional HTML email with one-click 7-day free trial CTA.
import { createClient } from "npm:@supabase/supabase-js@2";
import { frequencyCapExceeded } from "../_shared/outreach-blocklist.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const DAILY_CAP = 30;
const TRIAL_LINK = "https://detroitwebagent.com/counsel-search/console";
const PRICING_LINK = "https://detroitwebagent.com/counsel-search";

function emailHtml(firstName: string, firmName: string | null): string {
  const greet = firstName ? `${firstName}` : "Counselor";
  const firmLine = firmName ? ` at ${firmName}` : "";
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f5f7fa;font-family:Georgia,'Times New Roman',serif;color:#0a1628">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.06)">
  <div style="background:#030711;padding:20px 28px;border-bottom:3px solid #00d4ff">
    <p style="color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;margin:0;font-family:Arial,sans-serif">⚖️ COUNSEL RECORDS SEARCH</p>
  </div>
  <div style="padding:32px 28px;font-family:Georgia,'Times New Roman',serif">
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${greet},</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
      I built a one-click public-records aggregator for Michigan litigators${firmLine ? ` — the kind of tool I'd want if I had to dig up everything on opposing parties before a deposition` : ""}. One name in, and 25+ sources come back simultaneously:
    </p>
    <ul style="font-size:14px;line-height:1.7;margin:0 0 20px;padding-left:20px;color:#334155;font-family:Arial,sans-serif">
      <li>Federal court (PACER/CourtListener) — E.D. + W.D. Michigan</li>
      <li>MI county dockets — 36th District (Detroit), Wayne, Oakland, Macomb</li>
      <li>MDOC OTIS · NSOPW · FBI · SAM.gov exclusions · OSHA</li>
      <li>Wayne / Oakland / Macomb / Detroit assessor + parcel sales history</li>
      <li>Detroit blight tickets + vacant property registrations</li>
      <li>AI-corroborated web research — every cited URL HEAD-validated before it's shown to you</li>
    </ul>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px"><strong>Two things make this different:</strong></p>
    <ol style="font-size:14px;line-height:1.7;margin:0 0 20px;padding-left:20px;color:#334155;font-family:Arial,sans-serif">
      <li><strong>Court-citable output</strong> — every search produces a Bluebook-formatted source list and a one-click <em>Print PDF</em> for your case file or exhibit binder.</li>
      <li><strong>Cite-or-die validation</strong> — AI results with broken or fabricated URLs are dropped before they ever reach you.</li>
    </ol>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
      <strong>$49/mo</strong> for the solo plan. Cheaper than TLO. Deeper than Perplexity. <strong>7 free searches</strong>, no card.
    </p>
    <p style="margin:0 0 24px">
      <a href="${TRIAL_LINK}" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif">Run 7 Free Searches →</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 6px">Two-minute walkthrough or beta access (we're early — happy to comp 30 days for honest feedback): just reply.</p>
    <p style="font-size:14px;line-height:1.6;margin:24px 0 0">Best,<br>Matt Michels<br>Detroit Web Agency<br><a href="tel:+13139921219" style="color:#0891b2">(313) 992-1219</a></p>
  </div>
  <div style="background:#f1f5f9;padding:14px 28px;font-size:11px;color:#64748b;font-family:Arial,sans-serif">
    Detroit Web Agency · 18444 Mack Ave #126, Grosse Pointe, MI 48224 · Reply <strong>STOP</strong> or click <a href="${PRICING_LINK}?unsub=1" style="color:#64748b">unsubscribe</a> to opt out.<br>
    Not a Consumer Reporting Agency. Counsel Records Search is for permissible litigation, fraud-investigation, and bona-fide legal-research purposes only (FCRA §1681b(a)(4)).
  </div>
</div></body></html>`;
}

function emailText(firstName: string, firmName: string | null): string {
  const greet = firstName ? firstName : "Counselor";
  return `${greet},

I built a one-click public-records aggregator for Michigan litigators${firmName ? ` — the kind of tool I'd want at ${firmName} before a deposition` : ""}. One name in, 25+ sources back at once:

- Federal court (PACER/CourtListener) — E.D. + W.D. Michigan
- MI county dockets (36th District Detroit, Wayne, Oakland, Macomb)
- MDOC OTIS, NSOPW, FBI, SAM.gov exclusions, OSHA
- County assessor + parcel sales history (Wayne, Oakland, Macomb, Detroit)
- Detroit blight tickets + vacant property registry
- AI-corroborated web research — every URL HEAD-validated, fabrications dropped

What's different:
1. Court-citable output — every search gives you a Bluebook-formatted source list + one-click Print PDF for your case file.
2. Cite-or-die validation — broken URLs never reach you.

$49/mo solo. Cheaper than TLO, deeper than Perplexity. 7 free searches, no card.

Run 7 free: ${TRIAL_LINK}

Two-minute walkthrough or 30-day comp for honest feedback — just reply.

Best,
Matt Michels
Detroit Web Agency
(313) 992-1219

—
Detroit Web Agency, 18444 Mack Ave #126, Grosse Pointe, MI 48224. Reply STOP to opt out.
Not a Consumer Reporting Agency. For permissible litigation use only.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "resend_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: prospects } = await sb.from("counsel_search_prospects")
    .select("*")
    .not("email", "is", null)
    .is("cold_emailed_at", null)
    .eq("blocked", false)
    .limit(DAILY_CAP);

  let sent = 0, failed = 0;
  for (const p of (prospects || [])) {
    if (!p.email) continue;
    // Suppression check
    const { data: blocked } = await sb.from("outreach_blocklist").select("email").eq("email", p.email).maybeSingle().then((r) => r).catch(() => ({ data: null }));
    if (blocked) {
      await sb.from("counsel_search_prospects").update({ blocked: true, notes: "in outreach_blocklist", updated_at: new Date().toISOString() }).eq("id", p.id);
      continue;
    }
    const firstName = (p.full_name || "").split(/\s+/)[0] || "";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [p.email],
          subject: `${firstName ? firstName + ", " : ""}one-click public-records search for MI litigators`,
          html: emailHtml(firstName, p.firm_name),
          text: emailText(firstName, p.firm_name),
          headers: { "List-Unsubscribe": `<mailto:matt@detroitwebagent.com?subject=unsubscribe>, <${PRICING_LINK}?unsub=1>` },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        await sb.from("counsel_search_prospects").update({ cold_emailed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id);
        sent++;
      } else {
        failed++;
      }
    } catch { failed++; }
    await new Promise((r) => setTimeout(r, 500)); // gentle pacing
  }

  return new Response(JSON.stringify({ ok: true, attempted: (prospects || []).length, sent, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
