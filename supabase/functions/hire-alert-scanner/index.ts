// hire-alert-scanner — daily 7am ET
// Scans MIOSHA license DB, Apollo people search, and job boards for available licensed tradespeople.
// Alerts field service clients when new candidates appear.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { generateJSON } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

async function notifyMatt(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      subject,
      html,
    }),
  });
}

async function firecrawlSearch(query: string): Promise<Array<{ url: string; markdown: string; title: string }>> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    const data = await res.json();
    return data?.data || [];
  } catch (e) {
    console.error("[hire-alert-scanner] Firecrawl error:", e);
    return [];
  }
}

interface RawCandidate {
  full_name: string;
  phone?: string;
  email?: string;
  license_type?: string;
  license_number?: string;
  license_expiry?: string;
  city?: string;
  zip?: string;
  source: "miosha" | "apollo" | "firecrawl";
  raw_data?: Record<string, unknown>;
}

interface ScoredCandidate extends RawCandidate {
  availability_score: number;
  score_reason: string;
}

// Source 1: MIOSHA Public License Database (Michigan boiler operators — public records)
async function scanMIOSHA(): Promise<RawCandidate[]> {
  const results = await firecrawlSearch(
    'site:michigan.gov "boiler operator" OR "steam engineer" "licensed" Michigan 2025 OR 2026'
  );
  if (!results.length) return [];

  const context = results
    .slice(0, 5)
    .map((r) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.markdown?.slice(0, 600)}`)
    .join("\n\n---\n\n");

  const candidates = await generateJSON<RawCandidate[]>(
    `Extract licensed boiler operators and steam engineers from these Michigan MIOSHA/LARA public records search results.

Content:
${context}

For each licensed individual found, extract:
- full_name: their name
- license_type: "1st Class Boiler Operator", "2nd Class Boiler Operator", "Steam Engineer", or "Pressure Vessel Inspector"
- license_number: their license number if visible
- license_expiry: expiry date as YYYY-MM-DD if visible
- city: city in Michigan
- source: always "miosha"

Return a JSON array of objects. If no individuals found, return [].`,
    [],
    1000
  );

  return (candidates || []).map((c) => ({ ...c, source: "miosha" as const }));
}

// Source 2: Apollo People Search — tradespeople in Metro Detroit
async function scanApollo(): Promise<RawCandidate[]> {
  if (!APOLLO_API_KEY) return [];

  const metroDetroitLocations = [
    "Detroit, Michigan",
    "Warren, Michigan",
    "Dearborn, Michigan",
    "Livonia, Michigan",
    "Troy, Michigan",
    "Sterling Heights, Michigan",
    "Farmington Hills, Michigan",
    "Royal Oak, Michigan",
  ];

  const tradeTitles = [
    "Boiler Operator",
    "HVAC Technician",
    "Plumber",
    "Pipefitter",
    "Steamfitter",
    "Electrical Technician",
    "Steam Engineer",
    "Industrial Mechanic",
  ];

  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        person_titles: tradeTitles,
        person_locations: metroDetroitLocations,
        page: 1,
        per_page: 25,
      }),
    });

    if (!res.ok) {
      console.error("[hire-alert-scanner] Apollo error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const people = data?.people || [];

    return people.map((p: Record<string, unknown>) => ({
      full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      email: (p.email as string) || undefined,
      license_type: (p.title as string) || undefined,
      city: (p.city as string) || (p.state as string) || undefined,
      source: "apollo" as const,
      raw_data: { apollo_id: p.id, linkedin_url: p.linkedin_url, organization: p.organization },
    }));
  } catch (e) {
    console.error("[hire-alert-scanner] Apollo fetch error:", e);
    return [];
  }
}

// Source 3: Firecrawl job board search — active job seekers posting availability
async function scanJobBoards(): Promise<RawCandidate[]> {
  const queries = [
    '"boiler operator" "looking for work" OR "seeking position" Michigan',
    '"HVAC technician" "available" OR "open to opportunities" Detroit Michigan',
    '"pipefitter" OR "steamfitter" "UA Local 636" "available" Michigan',
    '"licensed plumber" "seeking employment" OR "available" "Metro Detroit"',
  ];

  const allResults: RawCandidate[] = [];

  for (const query of queries) {
    const results = await firecrawlSearch(query);
    if (!results.length) continue;

    const context = results
      .slice(0, 3)
      .map((r) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.markdown?.slice(0, 400)}`)
      .join("\n\n---\n\n");

    const candidates = await generateJSON<RawCandidate[]>(
      `Extract contact information for tradespeople actively seeking employment from these job board/forum results.

Content:
${context}

For each job seeker found, extract:
- full_name: their name (first + last)
- email: email address if visible
- phone: phone number if visible
- license_type: trade/license type (e.g. "Boiler Operator", "HVAC Tech", "Plumber")
- city: city in Michigan if mentioned
- source: always "firecrawl"

Return a JSON array. Only include people actively seeking work. Return [] if none found.`,
      [],
      800
    );

    allResults.push(...(candidates || []).map((c) => ({ ...c, source: "firecrawl" as const })));
  }

  return allResults;
}

// Score candidate availability via AI
async function scoreCandidate(candidate: RawCandidate): Promise<{ score: number; reason: string }> {
  const result = await generateJSON<{ score: number; reason: string }>(
    `Score this tradesperson's immediate hire availability from 1-10.

Candidate:
Name: ${candidate.full_name}
Trade/License: ${candidate.license_type || "unknown"}
Source: ${candidate.source}
City: ${candidate.city || "unknown"}
License Number: ${candidate.license_number || "none recorded"}
License Expiry: ${candidate.license_expiry || "unknown"}
Email Available: ${candidate.email ? "yes" : "no"}

Scoring guide:
10 = Active job seeker, fresh license, Metro Detroit location, has contact info
7-9 = Likely available: recent license issuance, local, or appeared on job board
5-6 = Possibly available: Apollo profile, local trade title
3-4 = Unclear availability: limited data
1-2 = Likely employed/unavailable or out of area

Return JSON: { "score": number, "reason": "one sentence explanation" }`,
    { score: 5, reason: "Insufficient data to score" },
    400
  );

  return result;
}

// Send alert email to a client — premium design
async function sendAlertEmail(
  client: { owner_email: string; company_name: string },
  candidates: ScoredCandidate[],
  dateStr: string
) {
  if (!RESEND_API_KEY || !client.owner_email) return;

  const hotCount = candidates.filter((c) => c.availability_score >= 7).length;

  const sourceLabel = (s: string) =>
    s === "miosha" ? "MIOSHA License DB" : s === "apollo" ? "Apollo" : "Job Board";

  const sourceIcon = (s: string) =>
    s === "miosha" ? "🏛️" : s === "apollo" ? "🔍" : "📋";

  const scoreBg = (s: number) =>
    s >= 8 ? "#dc2626" : s >= 7 ? "#e8621a" : s >= 5 ? "#f59e0b" : "#94a3b8";

  const candidateCards = candidates
    .map(
      (c) => `
    <tr><td style="padding:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid ${c.availability_score >= 7 ? "#e8621a40" : "#e2e8f0"};${c.availability_score >= 7 ? "box-shadow:0 2px 8px rgba(232,98,26,0.12);" : ""}">
        <!-- Score bar -->
        <tr><td style="background:${c.availability_score >= 7 ? "linear-gradient(135deg,#0a1628,#1e293b)" : "#f8fafc"};padding:14px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;font-size:16px;font-weight:800;color:${c.availability_score >= 7 ? "#fff" : "#1e293b"};letter-spacing:-0.3px;">${c.full_name}</p>
              <p style="margin:3px 0 0;font-size:12px;color:${c.availability_score >= 7 ? "#94a3b8" : "#64748b"};">${sourceIcon(c.source)} ${sourceLabel(c.source)}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:${scoreBg(c.availability_score)};color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;font-family:-apple-system,sans-serif;letter-spacing:0.5px;">
                  ${c.availability_score >= 8 ? "🔥 " : c.availability_score >= 7 ? "⚡ " : ""}${c.availability_score}/10
                </td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>
        <!-- Details -->
        <tr><td style="padding:16px 18px;background:#fff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${c.license_type || "Field Technician"}</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 ${c.city || "Metro Detroit"}</td>
                </tr></table>
              </td>
            </tr>
            ${c.license_number ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>${c.license_number}</strong>${c.license_expiry ? ` · Exp: ${c.license_expiry}` : ""}</td></tr>` : ""}
            ${c.email ? `<tr><td style="padding:4px 0;font-size:13px;"><a href="mailto:${c.email}" style="color:#0891b2;text-decoration:none;font-weight:600;">✉️ ${c.email}</a></td></tr>` : ""}
            ${c.phone ? `<tr><td style="padding:4px 0;font-size:13px;"><a href="tel:${c.phone}" style="color:#e8621a;text-decoration:none;font-weight:700;font-size:15px;">📞 ${c.phone}</a></td></tr>` : ""}
            <tr><td style="padding:8px 0 0;">
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;font-style:italic;background:#f8fafc;padding:8px 12px;border-radius:8px;border-left:3px solid ${scoreBg(c.availability_score)};">${c.score_reason}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`
    )
    .join("");

  const subjectEmoji = hotCount >= 3 ? "🔥🔥🔥" : hotCount >= 1 ? "🔥" : "📋";
  const subjectText = hotCount > 0
    ? `${subjectEmoji} ${hotCount} hot ${hotCount === 1 ? "candidate" : "candidates"} — act fast`
    : `${candidates.length} licensed ${candidates.length === 1 ? "tech" : "techs"} spotted nearby`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "TechAlert by Detroit Web Agency <matt@mattmichelstraining.com>",
      to: [client.owner_email],
      bcc: ["matthewmichels4@gmail.com"],
      subject: `${subjectText} | TechAlert ${dateStr}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:32px 28px 24px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⚡ TechAlert</p>
        <p style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">New Licensed Techs<br>in Your Area</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#00d4ff20;border:1px solid #00d4ff40;padding:12px 16px;border-radius:12px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:900;color:#00d4ff;line-height:1;">${candidates.length}</p>
            <p style="margin:2px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${candidates.length === 1 ? "Candidate" : "Candidates"}</p>
          </td>
        </tr></table>
      </td>
    </tr></table>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">${dateStr}${client.company_name ? ` · for ${client.company_name}` : ""}</p>
  </td></tr>

  <!-- URGENCY BAR (only for hot candidates) -->
  ${hotCount > 0 ? `<tr><td style="background:#e8621a;padding:12px 28px;">
    <p style="margin:0;color:#fff;font-size:13px;font-weight:700;text-align:center;">🔥 ${hotCount} high-availability ${hotCount === 1 ? "candidate" : "candidates"} detected — your competitors don't have this intel</p>
  </td></tr>` : ""}

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px;${hotCount > 0 ? "" : "border-top:1px solid #e2e8f0;"}">
    <p style="color:#1e293b;font-size:15px;line-height:1.7;margin:0 0 8px;">
      Hey${client.company_name ? ` ${client.company_name} team` : ""} —
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We scanned Michigan's MIOSHA license database, Apollo, and job boards this morning. ${hotCount > 0 ? `<strong>${hotCount} high-scoring ${hotCount === 1 ? "candidate" : "candidates"}</strong> — act fast before someone else does.` : "Here's what we found near you."}
    </p>

    <!-- CANDIDATE CARDS -->
    <table width="100%" cellpadding="0" cellspacing="0">
      ${candidateCards}
    </table>
  </td></tr>

  <!-- HOW SCORING WORKS -->
  <tr><td style="background:#f8fafc;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">How Scoring Works</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">🔥 <strong>8-10</strong> — Active job seeker, fresh license, local, has contact info</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">⚡ <strong>7</strong> — Likely available: recent license or appeared on job board</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">📋 <strong>5-6</strong> — Possibly available: professional profile matches your criteria</td>
      </tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13138064952" style="color:#00d4ff;text-decoration:none;">(313) 806-4952</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#475569;">Reply to adjust roles or zip codes</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@mattmichelstraining.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;text-decoration:none;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
    }),
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const runStart = new Date().toISOString();

  // Fetch active paid clients + active trial clients
  const { data: clients } = await sb.from("hire_alert_clients").select("*").or("active.eq.true,trial_status.eq.active");
  if (!clients?.length) {
    console.log("[hire-alert-scanner] No active clients");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Run all three sources in parallel
  console.log("[hire-alert-scanner] Scanning all sources...");
  const [mioshaCandidates, apolloCandidates, jobBoardCandidates] = await Promise.all([
    scanMIOSHA(),
    scanApollo(),
    scanJobBoards(),
  ]);

  const allRaw = [...mioshaCandidates, ...apolloCandidates, ...jobBoardCandidates];
  console.log(`[hire-alert-scanner] Raw candidates: MIOSHA=${mioshaCandidates.length} Apollo=${apolloCandidates.length} JobBoards=${jobBoardCandidates.length}`);

  // Deduplicate by license_number (for MIOSHA) or name+city
  const seen = new Set<string>();
  const deduped = allRaw.filter((c) => {
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Check which candidates are new (not already in DB)
  const { data: existingRecords } = await sb
    .from("hire_alert_candidates")
    .select("license_number, full_name, city")
    .in("source", ["miosha", "apollo", "firecrawl"]);

  const existingKeys = new Set(
    (existingRecords || []).map((r) =>
      r.license_number || `${(r.full_name || "").toLowerCase()}-${(r.city || "").toLowerCase()}`
    )
  );

  const newCandidates = deduped.filter((c) => {
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    return !existingKeys.has(key);
  });

  console.log(`[hire-alert-scanner] New candidates: ${newCandidates.length}`);

  // Score each new candidate
  const scored: ScoredCandidate[] = [];
  for (const candidate of newCandidates) {
    const { score, reason } = await scoreCandidate(candidate);
    scored.push({ ...candidate, availability_score: score, score_reason: reason });
  }

  // Upsert all new candidates into DB
  if (scored.length) {
    await sb.from("hire_alert_candidates").insert(
      scored.map((c) => ({
        full_name: c.full_name,
        phone: c.phone || null,
        email: c.email || null,
        license_type: c.license_type || null,
        license_number: c.license_number || null,
        license_state: "MI",
        license_expiry: c.license_expiry || null,
        city: c.city || null,
        zip: c.zip || null,
        source: c.source,
        status: "new",
        availability_score: c.availability_score,
        score_reason: c.score_reason,
        raw_data: c.raw_data || null,
      }))
    );
  }

  // Role keyword map — matches candidate license_type text to client target_roles keys
  const ROLE_KEYWORDS: Record<string, string[]> = {
    boiler_operator: ["boiler", "boiler operator"],
    steam_engineer: ["steam engineer"],
    pressure_vessel: ["pressure vessel", "pvi", "inspector"],
    hvac_tech: ["hvac", "air conditioning", "refrigeration", "heating"],
    plumber: ["plumber", "plumbing", "master plumber"],
    pipefitter: ["pipefitter", "steamfitter", "ua local", "ua 636"],
    electrician: ["electrician", "electrical"],
    industrial_mechanic: ["industrial mechanic", "maintenance mechanic"],
  };

  function candidateMatchesRoles(licenseType: string | undefined, targetRoles: string[]): boolean {
    if (!licenseType || !targetRoles?.length) return true; // no filter = match all
    const lower = licenseType.toLowerCase();
    return targetRoles.some((role) =>
      (ROLE_KEYWORDS[role] || [role]).some((kw) => lower.includes(kw))
    );
  }

  let alertsSent = 0;

  for (const client of clients) {
    const clientRoles: string[] = client.target_roles || [];

    // Filter scored candidates to only those matching this client's target roles
    const clientAlertWorthy = scored.filter(
      (c) => c.availability_score >= 5 && candidateMatchesRoles(c.license_type, clientRoles)
    );
    const clientHotCandidates = clientAlertWorthy.filter((c) => c.availability_score >= 7);

    if (!clientAlertWorthy.length) continue;

    try {
      // Email digest for all 5+ matching candidates
      if (client.notify_email && client.owner_email) {
        await sendAlertEmail(client, clientAlertWorthy, dateStr);
        alertsSent++;
      }

      // SMS for hot candidates (7+) matching this client's roles
      if (client.notify_sms && client.owner_phone && clientHotCandidates.length) {
        const top = clientHotCandidates[0];
        const smsBody = clientHotCandidates.length === 1
          ? `🔥 TechAlert: Licensed ${top.license_type || "tech"} just spotted in ${top.city || "Metro Detroit"}!\n\n${top.full_name} — Score ${top.availability_score}/10\n${top.email ? `Email: ${top.email}\n` : ""}${top.phone ? `Phone: ${top.phone}\n` : ""}\nYou're the ONLY company getting this alert. Move fast.\n\nFull details in your email. Reply STOP to opt out.\n— Detroit Web Agency`
          : `🔥 TechAlert: ${clientHotCandidates.length} licensed techs just spotted in Metro Detroit!\n\nTop match: ${top.full_name} — ${top.license_type || "tradesperson"} in ${top.city || "local"} (${top.availability_score}/10)\n\nYour competitors don't have this intel. Check your email NOW.\n\nReply STOP to opt out.\n— Detroit Web Agency`;
        await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
      }
    } catch (e) {
      console.error(`[hire-alert-scanner] Alert error for ${client.company_name}:`, e);
    }
  }

  // For DB status update, use all alerted candidates across all clients
  const allAlertWorthy = scored.filter((c) => c.availability_score >= 5);
  const allHotCandidates = scored.filter((c) => c.availability_score >= 7);

  // Update alerted candidates
  if (allAlertWorthy.length && alertsSent > 0) {
    const alertedNames = allAlertWorthy.map((c) => c.full_name);
    await sb
      .from("hire_alert_candidates")
      .update({ status: "alerted" })
      .in("full_name", alertedNames);
  }

  // Log the run
  await sb.from("hire_alert_runs").insert({
    run_at: runStart,
    source: "all",
    candidates_found: allRaw.length,
    new_candidates: newCandidates.length,
    alerts_sent: alertsSent,
    errors: null,
  });

  // Founder daily report — premium executive dashboard for Matt
  const sourceBreakdown = {
    miosha: scored.filter((c) => c.source === "miosha").length,
    apollo: scored.filter((c) => c.source === "apollo").length,
    firecrawl: scored.filter((c) => c.source === "firecrawl").length,
  };

  const candidateRows = scored.length
    ? scored
        .sort((a, b) => b.availability_score - a.availability_score)
        .map(
          (c, i) => {
            const rowBg = c.availability_score >= 7 ? "#0a16280a" : i % 2 === 0 ? "#fff" : "#f8fafc";
            const scoreBg = c.availability_score >= 8 ? "#dc2626" : c.availability_score >= 7 ? "#e8621a" : c.availability_score >= 5 ? "#f59e0b" : "#94a3b8";
            const sourceIcon = c.source === "miosha" ? "🏛️" : c.source === "apollo" ? "🔍" : "📋";
            return `<tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:${c.availability_score >= 7 ? "800" : "500"};">${c.full_name}${c.email ? `<br><span style="font-size:11px;color:#0891b2;font-weight:400;">${c.email}</span>` : ""}${c.phone ? `<br><span style="font-size:11px;color:#e8621a;font-weight:600;">${c.phone}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${c.license_type || "—"}${c.license_number ? `<br><span style="font-size:10px;color:#94a3b8;">#${c.license_number}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${c.city || "—"}</td>
              <td style="padding:12px 10px;text-align:center;">
                <span style="display:inline-block;background:${scoreBg};color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">${c.availability_score >= 8 ? "🔥 " : ""}${c.availability_score}/10</span>
              </td>
              <td style="padding:12px 10px;font-size:11px;color:#64748b;">${sourceIcon} ${c.source}</td>
              <td style="padding:12px 10px;font-size:11px;color:#475569;line-height:1.4;">${c.score_reason}</td>
            </tr>`;
          }
        )
        .join("")
    : `<tr><td colspan="6" style="padding:32px;text-align:center;color:#94a3b8;font-size:14px;">No new candidates found today. Scanner ran successfully across all 3 sources.</td></tr>`;

  await notifyMatt(
    `${allHotCandidates.length > 0 ? "🔥 " : ""}TechAlert — ${dateStr} — ${newCandidates.length} new${allHotCandidates.length > 0 ? `, ${allHotCandidates.length} HOT` : ""}`,
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:28px 28px 20px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert — Founder Report</p>
      <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${dateStr}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px;">Daily scan complete · ${clients.length} active ${clients.length === 1 ? "client" : "clients"}</p>
    </td>
    <td style="text-align:right;vertical-align:top;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff40;" alt="Matt">
    </td>
  </tr></table>
</td></tr>

<!-- KPI DASHBOARD -->
<tr><td style="background:#1e293b;padding:20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
      <p style="margin:0;font-size:32px;font-weight:900;color:#00d4ff;line-height:1;">${allRaw.length}</p>
      <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Scanned</p>
    </td>
    <td width="8"></td>
    <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
      <p style="margin:0;font-size:32px;font-weight:900;color:#fff;line-height:1;">${newCandidates.length}</p>
      <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">New</p>
    </td>
    <td width="8"></td>
    <td style="text-align:center;padding:16px 8px;background:${allHotCandidates.length > 0 ? "#e8621a15" : "#ffffff08"};border-radius:12px;${allHotCandidates.length > 0 ? "border:1px solid #e8621a40;" : ""}">
      <p style="margin:0;font-size:32px;font-weight:900;color:${allHotCandidates.length > 0 ? "#e8621a" : "#fff"};line-height:1;">${allHotCandidates.length}</p>
      <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Hot 🔥</p>
    </td>
    <td width="8"></td>
    <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
      <p style="margin:0;font-size:32px;font-weight:900;color:#10b981;line-height:1;">${alertsSent}</p>
      <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Alerted</p>
    </td>
  </tr></table>
</td></tr>

<!-- SOURCE BREAKDOWN -->
<tr><td style="background:#1e293b;padding:0 28px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="padding:8px 12px;background:#ffffff06;border-radius:8px;">
      <span style="font-size:11px;color:#94a3b8;">🏛️ MIOSHA: <strong style="color:#00d4ff;">${sourceBreakdown.miosha}</strong></span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">🔍 Apollo: <strong style="color:#00d4ff;">${sourceBreakdown.apollo}</strong></span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">📋 Job Boards: <strong style="color:#00d4ff;">${sourceBreakdown.firecrawl}</strong></span>
    </td>
  </tr></table>
</td></tr>

<!-- CANDIDATE TABLE -->
<tr><td style="background:#fff;padding:24px 20px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
  <p style="margin:0 0 16px;font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">All Candidates · Sorted by Score</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <tr style="background:#0a1628;">
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Name</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Trade</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">City</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Score</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Src</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Intel</th>
    </tr>
    ${candidateRows}
  </table>
</td></tr>

<!-- LEGEND + FOOTER -->
<tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:11px;color:#64748b;line-height:1.6;">
      🔥 <strong style="color:#e8621a;">8-10</strong> = alert sent &nbsp;·&nbsp;
      ⚡ <strong style="color:#f59e0b;">5-7</strong> = digest only &nbsp;·&nbsp;
      <span style="color:#94a3b8;">Below 5</span> = stored, no alert<br>
      Sources: MIOSHA public license DB · Apollo · Indeed/ZipRecruiter
    </td>
  </tr></table>
</td></tr>

</table></td></tr></table>
</body></html>`
  );

  await sb.from("agent_heartbeats" as any).upsert({
    agent_name: "hire-alert-scanner",
    last_run_at: new Date().toISOString(),
    last_status: "ok",
    last_result: JSON.stringify({ candidates_found: allRaw.length, new_candidates: newCandidates.length, hot_candidates: allHotCandidates.length, alerts_sent: alertsSent }),
  }, { onConflict: "agent_name" }).catch(() => {});

  return new Response(
    JSON.stringify({
      candidates_found: allRaw.length,
      new_candidates: newCandidates.length,
      hot_candidates: allHotCandidates.length,
      alerts_sent: alertsSent,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
