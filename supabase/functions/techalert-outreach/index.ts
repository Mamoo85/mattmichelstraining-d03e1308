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

  // PROOF-BEFORE-PITCH variant — when we have real candidate volume, show
  // blurred proof of inventory instead of asking. Massively higher reply rates.
  const useProof = isHealthcare && candidateCount >= 3;
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const blurLine = (cnty: string) =>
    `• ███████ ████ — ${tradeLabel}, ${cnty} County — licensed ${todayLabel}`;
  const proofBlock = [
    blurLine("Wayne"),
    blurLine("Macomb"),
    `• ███████ ████ — ${tradeLabel === "CNA" ? "LPN" : tradeLabel}, Oakland County — licensed ${todayLabel}`,
  ].join("<br>");

  const proofBody = `
<p>Hi ${greeting},</p>
<p>Just spotted these in the Michigan licensing database this week:</p>
<p style="font-family:Courier,monospace;font-size:14px;line-height:1.7;">${proofBlock}</p>
<p>We track these the moment they're issued. If you want the unblurred names + contact info + the other ${Math.max(candidateCount - 3, 10)} from this week, just reply yes — takes me 2 minutes to send.</p>
<p>No pitch, no credit card. Just the list.</p>
<p>— Matt<br>(313) 992-1219 &nbsp;|&nbsp; matt@detroitwebagent.com</p>
`;

  const healthcareBody = useProof ? proofBody : `
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
  const body = isHealthcare ? healthcareBody : tradesBody;
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
  prospectId: string,
) {
  const ctaUrl = `https://detroitwebagent.com/start-trial?product=techalert&email=${encodeURIComponent(to)}&state=${stateAbr}&utm_source=cold_email&utm_medium=email&utm_campaign=techalert_d0`;

  const useProof = isHealthcareRole(role) && candidateCount >= 3;
  const stateName = STATE_NAMES[stateAbr] || stateAbr;
  const firstName = ownerName?.split(" ")[0] || companyName;
  const tradeLabelSubj = /cna/i.test(role) ? "CNAs" : /lpn/i.test(role) ? "LPNs" : /rn|nurse/i.test(role) ? "RNs" : null;

  // A/B variant — deterministic per prospect (Upgrade 3)
  const abVariant: "A" | "B" = (prospectId.charCodeAt(0) % 2 === 0) ? "A" : "B";
  const isHealthcare = isHealthcareRole(role);

  let subject: string;
  if (useProof && tradeLabelSubj) {
    subject = `${firstName} — here are 3 ${tradeLabelSubj} licensed in ${stateName} this week`;
  } else if (isHealthcare && tradeLabelSubj && abVariant === "B") {
    const county = ownerName ? "your county" : stateName;
    subject = `${firstName} — 3 new ${tradeLabelSubj} just licensed in ${county} this week`;
  } else {
    subject = buildSubject(ownerName, companyName, role, isBoiler, candidateCount, stateAbr);
  }

  const baseTemplate = useProof ? "techalert_cold_d0_proof" : "techalert_cold_d0";
  const templateName = isHealthcare ? `${baseTemplate}_${abVariant.toLowerCase()}` : baseTemplate;

  const bodyHtml = buildPlainEmail(ownerName, companyName, role, isBoiler, stateAbr, candidateCount, ctaUrl);

  const r = await dwaColdEmail({
    to,
    subject,
    bodyHtml,
    product: isHealthcare ? "CareAlert" : "TechAlert",
    ctaUrl,
    templateName,
    plainMode: true,
  }, sb);
  return { ok: r.ok, err: r.error, abVariant, templateName };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  try {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("techalert_prospect_targets")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)
      .gte("outreach_sent_at", dayStart.toISOString());

    const remaining = DAILY_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: `Daily cap of ${DAILY_CAP} already reached` }),
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

    const { data: targets, error } = await sb
      .from("techalert_prospect_targets")
      .select("id, company_name, role, is_boiler, owner_name, owner_email, score, state, city")
      .is("outreach_sent_at", null)
      .not("enriched_at", "is", null)
      .not("owner_email", "is", null)
      .gte("score", MIN_SCORE)
      .order("score", { ascending: false })
      .limit(remaining);

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

      const result = await sendEmail(sb, t.owner_email, t.owner_name, t.company_name, t.role, t.is_boiler ?? false, stateAbr, candidateCount);

      if (!result.ok) {
        console.error(`[outreach] ${t.company_name}: ${result.err}`);
        failed++;
        continue;
      }

      await sb.from("techalert_prospect_targets")
        .update({ outreach_sent_at: new Date().toISOString(), outreach_status: "sent" })
        .eq("id", t.id);

      fireLinkedInConnect(t.company_name, t.owner_name, t.id, sb).catch(() => {});

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
