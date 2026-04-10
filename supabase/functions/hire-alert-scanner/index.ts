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
      from: "M² TechAlert <matt@mattmichelstraining.com>",
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

// Send alert email to a client
async function sendAlertEmail(
  client: { owner_email: string; company_name: string },
  candidates: ScoredCandidate[],
  dateStr: string
) {
  if (!RESEND_API_KEY || !client.owner_email) return;

  const candidateCards = candidates
    .map(
      (c) => `
    <div style="border:1px solid ${c.availability_score >= 7 ? "#fbbf24" : "#e2e8f0"};border-radius:8px;padding:18px;margin:0 0 14px;background:${c.availability_score >= 7 ? "#fffbeb" : "#fff"};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:0 0 6px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">${c.full_name}</p>
        <span style="background:${c.availability_score >= 7 ? "#e8621a" : "#64748b"};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;margin-left:12px;">
          ${c.availability_score}/10 ${c.availability_score >= 7 ? "🔥" : ""}
        </span>
      </div>
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;"><strong>Trade:</strong> ${c.license_type || "Field Technician"} · <strong>Location:</strong> ${c.city || "Metro Detroit"}</p>
      ${c.license_number ? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;"><strong>License:</strong> ${c.license_number}${c.license_expiry ? ` (exp. ${c.license_expiry})` : ""}</p>` : ""}
      ${c.email ? `<p style="margin:0 0 4px;font-size:13px;color:#0ea5e9;"><strong>Email:</strong> ${c.email}</p>` : ""}
      <p style="margin:6px 0 0;font-size:13px;color:#334155;font-style:italic;">${c.score_reason}</p>
      <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Source: ${c.source === "miosha" ? "Michigan MIOSHA License DB" : c.source === "apollo" ? "Apollo Professional Database" : "Job Board Monitoring"}</p>
    </div>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "TechAlert <matt@mattmichelstraining.com>",
      to: [client.owner_email],
      subject: `[TechAlert] ${candidates.length} licensed ${candidates.length === 1 ? "tech" : "techs"} spotted in your area — ${dateStr}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:#0a1628;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">TechAlert by Detroit Web Agency</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Licensed Techs Available in Your Area</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${dateStr} · ${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"} found</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We scanned MIOSHA's public license database, Apollo, and job boards. Here's what we found near you today.
      <strong>Be first — your competitors don't have this.</strong>
    </p>

    ${candidateCards}

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#94a3b8;line-height:1.7;">Candidates scored 1-10 on immediate availability. 7+ triggers an SMS alert. Source data comes from Michigan MIOSHA public license records and professional databases. Reply to adjust your target roles or zip codes.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;background:#f8fafc;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="Matt">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong> · Detroit Web Agency<br>(313) 806-4952 · detroitwebagent.com</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
    }),
  });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const runStart = new Date().toISOString();

  // Fetch active clients
  const { data: clients } = await sb.from("hire_alert_clients").select("*").eq("active", true);
  if (!clients?.length) {
    console.log("[hire-alert-scanner] No active clients");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
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
        const smsBody = `TechAlert: ${clientHotCandidates.length} hot licensed ${clientHotCandidates.length === 1 ? "tech" : "techs"} in Metro Detroit!\n\nTop: ${top.full_name} — ${top.license_type || "tradesperson"} (${top.city || "local"})\nScore: ${top.availability_score}/10\n\nCheck your email for full details. Reply STOP to opt out.`;
        await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
      }
    } catch (e) {
      console.error(`[hire-alert-scanner] Alert error for ${client.company_name}:`, e);
    }
  }

  // For DB status update, use all alerted candidates across all clients
  const allAlertWorthy = scored.filter((c) => c.availability_score >= 5);

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

  // Notify Matt
  await notifyMatt(
    `TechAlert Daily Scan — ${dateStr} (${newCandidates.length} new, ${alertsSent} alerts)`,
    `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#00d4ff;">TechAlert Daily Scan</h2>
<p><strong>Date:</strong> ${dateStr}</p>
<p><strong>Total candidates found:</strong> ${allRaw.length}</p>
<p><strong>New (not in DB):</strong> ${newCandidates.length}</p>
<p><strong>Hot (7+):</strong> ${hotCandidates.length}</p>
<p><strong>Active clients:</strong> ${clients.length}</p>
<p><strong>Alert emails sent:</strong> ${alertsSent}</p>
</div>`
  );

  return new Response(
    JSON.stringify({
      candidates_found: allRaw.length,
      new_candidates: newCandidates.length,
      hot_candidates: hotCandidates.length,
      alerts_sent: alertsSent,
    }),
    { status: 200 }
  );
});
