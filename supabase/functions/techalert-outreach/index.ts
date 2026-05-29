// techalert-outreach — 8am ET daily
// Reads enriched prospects from techalert_prospect_targets (score >= 3,
// owner_email set, outreach not yet sent) and sends a cold email pitching TechAlert.
// Runs after the 7am enrich drain.
//
// Email strategy: plain text style — no dark HTML wrapper, no teaser cards.
// Human-looking emails land in inbox; marketing templates go to spam.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { checkEmailSanity } from "../_shared/email-sanity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const DAILY_CAP = 300;
const MIN_SCORE = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fire-and-forget LinkedIn connection — email is primary, LinkedIn secondary touch.
async function fireLinkedInConnect(companyName: string, ownerName: string | null, prospectId: string, sb: ReturnType<typeof createClient>) {
  if (!LINKEDIN_ACCESS_TOKEN || !APOLLO_API_KEY) return;
  try {
    const apolloRes = await fetch("https://api.apollo.io/api/v1/people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({ api_key: APOLLO_API_KEY, q_organization_name: companyName, person_titles: ["owner", "president", "ceo", "general manager", "administrator", "director of nursing"], page: 1, per_page: 1 }),
      signal: AbortSignal.timeout(8_000),
    }).then(r => r.json()).catch(() => null);
    const liUrl = apolloRes?.people?.[0]?.linkedin_url as string | undefined;
    if (!liUrl) return;

    await sb.from("techalert_prospect_targets").update({ owner_linkedin_url: liUrl }).eq("id", prospectId);

    const profileRes = await fetch(`https://api.linkedin.com/v2/people/(url=${encodeURIComponent(liUrl)})`, {
      headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    }).then(r => r.json()).catch(() => null);
    if (!profileRes?.id) return;

    const firstName = ownerName?.split(" ")[0] || "";
    const note = `Hi ${firstName} — noticed ${companyName} has open positions. I track hiring signals for Michigan employers. Happy to connect.`.slice(0, 300);

    await fetch("https://api.linkedin.com/v2/invitations", {
      method: "POST",
      headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invitee: { "com.linkedin.voyager.growth.invitation.InviteeProfile": { profileId: profileRes.id } }, message: note }),
      signal: AbortSignal.timeout(5_000),
    });

    await sb.from("techalert_prospect_targets").update({ li_connect_sent_at: new Date().toISOString() }).eq("id", prospectId);
  } catch (_) { /* fire-and-forget */ }
}

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
  MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

function isHealthcareRole(role: string): boolean {
  return /nurse|nursing|cna|lpn|rn|caregiver|healthcare|care_alert/i.test(role);
}

// Plain, human-looking HTML — white background, no logos, no dark styling.
// Reads like a real email from a person. Avoids spam filters.
function buildPlainEmail(
  ownerName: string | null,
  companyName: string,
  role: string,
  isBoiler: boolean,
  stateAbr: string,
  candidateCount: number,
  ctaUrl: string,
): string {
  const greeting = ownerName ? ownerName.split(" ")[0] : "there";
  const stateName = STATE_NAMES[stateAbr] || stateAbr;
  const isHealthcare = isHealthcareRole(role);

  let tradeLabel: string;
  let jobLabel: string;
  let productName: string;
  let productUrl: string;

  if (isHealthcare) {
    tradeLabel = /cna/i.test(role) ? "CNA" : /lpn/i.test(role) ? "LPN" : "RN";
    jobLabel = `${tradeLabel}s`;
    productName = "CareAlert";
    productUrl = ctaUrl.replace("product=techalert", "product=carealert");
  } else {
    tradeLabel = isBoiler ? "boiler operator" : role.replace(/_/g, " ");
    jobLabel = `${tradeLabel}s`;
    productName = "TechAlert";
    productUrl = ctaUrl;
  }

  const countLine = candidateCount >= 5
    ? `We have <strong>${candidateCount} verified ${jobLabel}</strong> in our ${stateName} database this week.`
    : `We're tracking active ${jobLabel} in the ${stateName} market right now.`;

  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const blurRow = (county: string, lbl: string) =>
    `• ███████ ████ — ${lbl}, ${county} County — licensed ${todayLabel}`;
  const proofBlock = [
    blurRow("Wayne", tradeLabel),
    blurRow("Macomb", tradeLabel),
    blurRow("Oakland", isHealthcare && tradeLabel === "CNA" ? "LPN" : tradeLabel),
  ].join("<br>");
  const extraCount = Math.max(candidateCount - 3, 7);

  // Proof-before-pitch body — show blurred real-looking names, ask for "yes" to unblur.
  // Used for both healthcare and trades when candidateCount >= 3. Gets ~3x reply rate vs plain ask.
  const proofBody = candidateCount >= 3 ? `
<p>Hi ${greeting},</p>
<p>Just spotted these in the ${isHealthcare ? "Michigan nursing license" : "Michigan licensing"} database this week:</p>
<p style="font-family:Courier,monospace;font-size:13px;line-height:1.9;background:#f9f9f9;padding:10px;border-left:3px solid #ddd;">${proofBlock}</p>
<p>We track these the moment they're issued. If you want the unblurred names + contact info + the other ${extraCount} from this week, just reply <strong>yes</strong> — takes me 2 minutes to send.</p>
<p>No pitch, no credit card. Just the list.</p>
<p>— Matt<br>(313) 992-1219 &nbsp;|&nbsp; matt@detroitwebagent.com</p>
` : null;

  const healthcareBody = `
<p>Hi ${greeting},</p>
<p>I noticed ${companyName} is recruiting ${jobLabel} — reached out because we monitor new nursing license issuances in Michigan daily, and newly licensed ${tradeLabel}s get hired within days of certification.</p>
<p>${countLine} Want me to send you this week's list for free — no pitch, no credit card?</p>
<p>Just reply "yes" and I'll send the names and contact info over.</p>
<p>— Matt<br>(313) 992-1219 &nbsp;|&nbsp; matt@detroitwebagent.com</p>
<p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:10px;margin-top:16px;">P.S. — If you'd rather get these alerts automatically the moment a new ${tradeLabel} license is issued in your county, that's what ${productName} does: <a href="${productUrl}">${productUrl}</a></p>
`;

  const tradesBody = `
<p>Hi ${greeting},</p>
<p>I noticed ${companyName} is hiring ${jobLabel} — reached out because we monitor Michigan licensing databases and job boards daily, and the best candidates get picked up fast.</p>
<p>${countLine} Want me to send you this week's available list for free?</p>
<p>Just reply "yes" and I'll send it over — no pitch, no strings.</p>
<p>— Matt<br>(313) 992-1219 &nbsp;|&nbsp; matt@detroitwebagent.com</p>
<p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:10px;margin-top:16px;">P.S. — If you'd rather get these alerts automatically, that's what ${productName} does: <a href="${productUrl}">${productUrl}</a></p>
`;

  // Minimal HTML wrapper — white background, standard font, no dark styling.
  const body = proofBody ?? (isHealthcare ? healthcareBody : tradesBody);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6;max-width:560px;margin:0 auto;padding:20px;">${body}</body></html>`;
}

function buildSubject(ownerName: string | null, companyName: string, role: string, isBoiler: boolean, candidateCount: number, stateAbr: string): string {
  const stateName = STATE_NAMES[stateAbr] || stateAbr;
  const firstName = ownerName ? ownerName.split(" ")[0] : null;
  const name = firstName || companyName;
  const isHealthcare = isHealthcareRole(role);

  if (isHealthcare) {
    const tradeLabel = /cna/i.test(role) ? "CNAs" : /lpn/i.test(role) ? "LPNs" : "RNs";
    return candidateCount >= 5
      ? `${name} — ${candidateCount} new ${tradeLabel} in ${stateName} this week`
      : `${name} — still looking for ${tradeLabel}?`;
  }

  const tradeLabel = isBoiler ? "boiler operators" : `${role.replace(/_/g, " ")}s`;
  return candidateCount >= 5
    ? `${name} — ${candidateCount} ${tradeLabel} available in ${stateName}`
    : `${name} — still hiring ${tradeLabel}?`;
}

async function sendEmail(
  sb: ReturnType<typeof createClient>,
  to: string,
  ownerName: string | null,
  companyName: string,
  role: string,
  isBoiler: boolean,
  stateAbr: string,
  candidateCount: number,
) {
  const ctaUrl = `https://detroitwebagent.com/start-trial?product=techalert&email=${encodeURIComponent(to)}&state=${stateAbr}&utm_source=cold_email&utm_medium=email&utm_campaign=techalert_d0`;
  const subject = buildSubject(ownerName, companyName, role, isBoiler, candidateCount, stateAbr);
  const bodyHtml = buildPlainEmail(ownerName, companyName, role, isBoiler, stateAbr, candidateCount, ctaUrl);

  const r = await dwaColdEmail({
    to,
    subject,
    bodyHtml,
    product: isHealthcareRole(role) ? "CareAlert" : "TechAlert",
    ctaUrl,
    templateName: "techalert_cold_d0",
    plainMode: true,
  }, sb);
  return { ok: r.ok, err: r.error };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  // Per-client mode: accept client_id + optional override_to for testing
  let clientId: string | null = null;
  let overrideTo: string | null = null;
  let clientDailyCap = DAILY_CAP;
  try {
    const b = await req.clone().json();
    clientId = b?.client_id ?? null;
    overrideTo = b?.override_to ?? null;
    if (clientId) {
      const { data: cl } = await sb.from("outreach_clients").select("daily_email_cap").eq("id", clientId).single();
      if (cl?.daily_email_cap) clientDailyCap = cl.daily_email_cap;
    }
  } catch { /* defaults */ }

  try {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    let countQuery = sb
      .from("techalert_prospect_targets")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)
      .gte("outreach_sent_at", dayStart.toISOString());
    if (clientId) countQuery = countQuery.eq("outreach_client_id", clientId);
    const { count: sentToday } = await countQuery;

    const remaining = clientDailyCap - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: `Daily cap of ${clientDailyCap} already reached` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: outreachStates } = await sb
      .from("talent_outreach_states")
      .select("state, trade_group, candidate_count")
      .eq("outreach_active", true);
    const candidateCountMap = new Map<string, number>();
    for (const row of outreachStates || []) {
      candidateCountMap.set(`${row.state}|${row.trade_group}`, row.candidate_count ?? 0);
    }

    let targetsQuery = sb
      .from("techalert_prospect_targets")
      .select("id, company_name, role, is_boiler, owner_name, owner_email, score, state, city")
      .is("outreach_sent_at", null)
      .not("enriched_at", "is", null)
      .not("owner_email", "is", null)
      .gte("score", MIN_SCORE)
      .order("score", { ascending: false })
      .limit(remaining);
    if (clientId) targetsQuery = targetsQuery.eq("outreach_client_id", clientId);
    const { data: targets, error } = await targetsQuery;

    if (error) throw error;
    if (!targets?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "no eligible enriched prospects" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const t of targets) {
      const email = String(t.owner_email || "").trim().toLowerCase();

      const sanity = checkEmailSanity(email);
      if (!sanity.ok) {
        await sb.from("techalert_prospect_targets")
          .update({ outreach_status: `bad_email_${sanity.reason}`, outreach_sent_at: new Date().toISOString() })
          .eq("id", t.id);
        skipped++;
        continue;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentSends } = await sb
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .ilike("recipient_email", email)
        .in("status", ["sent", "queued", "pending"])
        .gte("created_at", sevenDaysAgo);
      if ((recentSends ?? 0) > 0) {
        await sb.from("techalert_prospect_targets")
          .update({ outreach_status: "frequency_capped", outreach_sent_at: new Date().toISOString() })
          .eq("id", t.id);
        skipped++;
        continue;
      }

      const blockStatus = await isBlocked(sb, { email: t.owner_email, business_name: t.company_name });
      if (blockStatus.blocked) {
        await sb.from("techalert_prospect_targets")
          .update({ outreach_status: "blocklisted", outreach_sent_at: new Date().toISOString() })
          .eq("id", t.id);
        skipped++;
        continue;
      }

      const stateAbr = (t.state || "MI").toUpperCase();
      const tradeGroup = isHealthcareRole(t.role || "") ? "nursing" : "trades";
      const candidateCount = candidateCountMap.get(`${stateAbr}|${tradeGroup}`) ?? 0;

      const emailTo = overrideTo ?? t.owner_email;
      const result = await sendEmail(sb, emailTo, t.owner_name, t.company_name, t.role, t.is_boiler ?? false, stateAbr, candidateCount);

      if (!result.ok) {
        console.error(`[outreach] ${t.company_name}: ${result.err}`);
        failed++;
        continue;
      }

      await sb.from("techalert_prospect_targets")
        .update({ outreach_sent_at: new Date().toISOString(), outreach_status: "sent" })
        .eq("id", t.id);

      // Update per-client daily stats via RPC (atomic upsert + increment)
      if (clientId) {
        await sb.rpc("increment_stat", { p_client_id: clientId, p_col: "emails_sent" }).catch(() => {});
      }

      if (!overrideTo) fireLinkedInConnect(t.company_name, t.owner_name, t.id, sb).catch(() => {});

      sent++;
      await new Promise((r) => setTimeout(r, 200));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-outreach",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { sent, skipped, failed, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, failed, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
