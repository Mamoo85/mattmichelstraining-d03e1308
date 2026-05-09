// counsel-followup-drip — D3, D7, D14 follow-ups for cold-emailed attorney prospects
// Runs 9am + 2pm ET. 50/day cap across all touch points.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const DAILY_CAP = 50;
const TRIAL_LINK = "https://detroitwebagent.com/counsel-search/console";

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f5f7fa;font-family:Georgia,serif;color:#0a1628">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.06)">
  <div style="background:#030711;padding:18px 28px;border-bottom:3px solid #00d4ff"><p style="color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;margin:0;font-family:Arial,sans-serif">⚖️ COUNSEL RECORDS SEARCH</p></div>
  <div style="padding:28px;font-size:15px;line-height:1.6">${inner}</div>
  <div style="background:#f1f5f9;padding:14px 28px;font-size:11px;color:#64748b;font-family:Arial,sans-serif">Detroit Web Agency · 18444 Mack Ave #126, Grosse Pointe, MI 48224 · Reply STOP to opt out.</div>
</div></body></html>`;
}

const D3 = (first: string) => ({
  subject: `${first ? first + ", " : ""}30 seconds: opposing party MDOC hit`,
  html: shell(`<p>${first || "Counselor"},</p>
<p>Quick example of what showed up in a search this morning — opposing party in a custody case had a 2018 MDOC release I'd never have found on PACER. Took 28 seconds. Surfaced from the same one-click search that hit federal docket + 24 other sources.</p>
<p>Worth 90 seconds of your time? <a href="${TRIAL_LINK}" style="color:#0891b2"><strong>Run 7 free searches →</strong></a></p>
<p>Matt Michels — (313) 992-1219</p>`),
  text: `${first || "Counselor"}, opposing party in a custody case this morning had a 2018 MDOC release I'd never find on PACER. 28 seconds. ${TRIAL_LINK}\n\nMatt Michels (313) 992-1219`,
});

const D7 = (first: string) => ({
  subject: `${first ? first + " — " : ""}TLO is $250+. We're $49.`,
  html: shell(`<p>${first || "Counselor"},</p>
<p>If you're already paying for TLO, IRB, Tracers, or Westlaw PeopleMap, here's the math:</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin:12px 0">
<tr style="background:#f1f5f9"><td style="padding:8px 12px;border:1px solid #e2e8f0">TLO</td><td style="padding:8px 12px;border:1px solid #e2e8f0">$250+/mo + per-search</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0">IRB Search</td><td style="padding:8px 12px;border:1px solid #e2e8f0">$160+/mo</td></tr>
<tr style="background:#f1f5f9"><td style="padding:8px 12px;border:1px solid #e2e8f0">Westlaw PeopleMap</td><td style="padding:8px 12px;border:1px solid #e2e8f0">$200+/mo</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#ecfeff"><strong>Counsel Records Search</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#ecfeff"><strong>$49/mo unlimited solo</strong></td></tr>
</table>
<p>Plus court-citable output (Bluebook + one-click PDF) the others don't ship.</p>
<p><a href="${TRIAL_LINK}" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:700;padding:12px 22px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif">7 Free Searches — No Card</a></p>
<p>Matt Michels</p>`),
  text: `${first || "Counselor"}, TLO is $250+, IRB $160+, Westlaw $200+. We're $49/mo unlimited solo, plus court-citable Bluebook + PDF output. 7 free searches: ${TRIAL_LINK}\n\nMatt Michels`,
});

const D14 = (first: string) => ({
  subject: `${first ? first + ", " : ""}last note from me`,
  html: shell(`<p>${first || "Counselor"},</p>
<p>Won't keep emailing. If court-citable public-records search is something you'd want to try sometime, my direct line is <a href="tel:+13139921219" style="color:#0891b2">(313) 992-1219</a> — happy to comp 30 days for honest feedback.</p>
<p>Otherwise, all the best with the practice.</p>
<p>Matt Michels<br>Detroit Web Agency</p>`),
  text: `${first || "Counselor"}, won't keep emailing. If you ever want to try it: (313) 992-1219 — happy to comp 30 days. Otherwise all the best.\n\nMatt Michels`,
});

async function send(email: string, msg: { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [email],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        headers: { "List-Unsubscribe": `<mailto:matt@detroitwebagent.com?subject=unsubscribe>` },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: "resend_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = Date.now();
  const d3cutoff = new Date(now - 3 * 86400000).toISOString();
  const d7cutoff = new Date(now - 7 * 86400000).toISOString();
  const d14cutoff = new Date(now - 14 * 86400000).toISOString();

  let budget = DAILY_CAP;
  const stats = { d3: 0, d7: 0, d14: 0, failed: 0 };

  // D3
  const { data: d3pool } = await sb.from("counsel_search_prospects")
    .select("*").not("email", "is", null).eq("blocked", false).is("replied_at", null)
    .not("cold_emailed_at", "is", null).lte("cold_emailed_at", d3cutoff).is("followup_d3_sent_at", null)
    .limit(budget);
  for (const p of (d3pool || [])) {
    const first = (p.full_name || "").split(/\s+/)[0] || "";
    const ok = await send(p.email!, D3(first));
    if (ok) { await sb.from("counsel_search_prospects").update({ followup_d3_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id); stats.d3++; budget--; }
    else stats.failed++;
    await new Promise((r) => setTimeout(r, 400));
    if (budget <= 0) break;
  }

  // D7
  if (budget > 0) {
    const { data: d7pool } = await sb.from("counsel_search_prospects")
      .select("*").not("email", "is", null).eq("blocked", false).is("replied_at", null)
      .not("followup_d3_sent_at", "is", null).lte("followup_d3_sent_at", d7cutoff).is("followup_d7_sent_at", null)
      .limit(budget);
    for (const p of (d7pool || [])) {
      const first = (p.full_name || "").split(/\s+/)[0] || "";
      const ok = await send(p.email!, D7(first));
      if (ok) { await sb.from("counsel_search_prospects").update({ followup_d7_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id); stats.d7++; budget--; }
      else stats.failed++;
      await new Promise((r) => setTimeout(r, 400));
      if (budget <= 0) break;
    }
  }

  // D14
  if (budget > 0) {
    const { data: d14pool } = await sb.from("counsel_search_prospects")
      .select("*").not("email", "is", null).eq("blocked", false).is("replied_at", null)
      .not("followup_d7_sent_at", "is", null).lte("followup_d7_sent_at", d14cutoff).is("followup_d14_sent_at", null)
      .limit(budget);
    for (const p of (d14pool || [])) {
      const first = (p.full_name || "").split(/\s+/)[0] || "";
      const ok = await send(p.email!, D14(first));
      if (ok) { await sb.from("counsel_search_prospects").update({ followup_d14_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id); stats.d14++; budget--; }
      else stats.failed++;
      await new Promise((r) => setTimeout(r, 400));
      if (budget <= 0) break;
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
