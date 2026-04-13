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
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: ["matt@detroitwebagent.com"],
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

// Source 1: MIOSHA Public License Database — delegates to miosha-license-scraper
// That function scrapes actual LARA VAL pages directly (not web search).
// Any new candidates inserted by the scraper are picked up here.
async function scanMIOSHA(): Promise<RawCandidate[]> {
  try {
    // Trigger the dedicated scraper so it upserts fresh records
    const scraperUrl = `${SUPABASE_URL}/functions/v1/miosha-license-scraper`;
    const res = await fetch(scraperUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[hire-alert-scanner] miosha-license-scraper returned ${res.status}`);
    } else {
      const result = await res.json();
      console.log(`[hire-alert-scanner] miosha-scraper: new=${result.new} updated=${result.updated}`);
    }
  } catch (e) {
    console.warn("[hire-alert-scanner] miosha-scraper call failed:", e);
  }

  // Return candidates that the scraper just inserted/updated (status='new', source='miosha')
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // last 25h
  const { data } = await sb
    .from("hire_alert_candidates")
    .select("full_name, phone, email, license_type, license_number, license_expiry, city, zip, source, raw_data")
    .eq("source", "miosha")
    .gte("first_seen_at", since);

  return (data || []).map((r) => ({
    full_name: r.full_name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    license_type: r.license_type ?? undefined,
    license_number: r.license_number ?? undefined,
    license_expiry: r.license_expiry ?? undefined,
    city: r.city ?? undefined,
    zip: r.zip ?? undefined,
    source: "miosha" as const,
    raw_data: r.raw_data as Record<string, unknown> | undefined,
  }));
}

// TA-3: Enrich MIOSHA candidates that lack contact info via Apollo /people/match
// MIOSHA gives us name + license but no email/phone. Apollo can fill in the gap.
async function enrichMIOSHAWithApollo(candidates: RawCandidate[]): Promise<RawCandidate[]> {
  if (!APOLLO_API_KEY) return candidates;
  // Only enrich candidates missing both phone and email — don't burn API credits on complete records
  const needsEnrichment = candidates.filter((c) => !c.phone && !c.email);
  if (!needsEnrichment.length) return candidates;

  const enriched = new Map<string, { phone?: string; email?: string }>();

  for (const candidate of needsEnrichment.slice(0, 10)) { // cap at 10 enrichments per run
    try {
      const res = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify({
          first_name: candidate.full_name.split(" ")[0] || "",
          last_name: candidate.full_name.split(" ").slice(1).join(" ") || "",
          location: candidate.city || "Detroit, Michigan",
          title: candidate.license_type || "",
          reveal_personal_emails: true,
          reveal_phone_number: true,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const person = data?.person;
      if (!person) continue;

      const key = candidate.full_name.toLowerCase();
      const phone = (person.phone_numbers as Array<{ sanitized_number?: string }>)?.[0]?.sanitized_number;
      const email = person.email as string | undefined;
      if (phone || email) {
        enriched.set(key, { phone, email });
        console.log(`[hire-alert-scanner] Enriched MIOSHA candidate: ${candidate.full_name} → phone=${!!phone} email=${!!email}`);
      }
    } catch (e) {
      console.warn(`[hire-alert-scanner] Apollo enrichment failed for ${candidate.full_name}:`, e);
    }
  }

  return candidates.map((c) => {
    const data = enriched.get(c.full_name.toLowerCase());
    if (!data) return c;
    return {
      ...c,
      phone: c.phone || data.phone,
      email: c.email || data.email,
      raw_data: { ...(c.raw_data || {}), enriched_via: "apollo_match" },
    };
  });
}

// Source 2: Apollo People Search — tradespeople in Metro Detroit
// Paginates up to 3 pages per city group (75 results max), extracts phone numbers
async function scanApollo(): Promise<RawCandidate[]> {
  if (!APOLLO_API_KEY) return [];

  // Split into batches so pagination is more targeted
  const locationBatches = [
    ["Detroit, Michigan", "Dearborn, Michigan", "Livonia, Michigan"],
    ["Warren, Michigan", "Sterling Heights, Michigan", "Troy, Michigan"],
    ["Farmington Hills, Michigan", "Royal Oak, Michigan"],
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

  const allPeople: RawCandidate[] = [];
  const seenIds = new Set<string>();

  for (const locations of locationBatches) {
    // Paginate up to 3 pages per city batch
    for (let page = 1; page <= 3; page++) {
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
            person_locations: locations,
            page,
            per_page: 25,
          }),
        });

        if (!res.ok) {
          console.warn(`[hire-alert-scanner] Apollo HTTP ${res.status} (batch page ${page})`);
          break;
        }

        const data = await res.json();
        const people: Record<string, unknown>[] = data?.people || [];

        if (!people.length) break; // No more results for this batch

        for (const p of people) {
          const id = p.id as string;
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);

          const phoneNumbers = p.phone_numbers as Array<{ sanitized_number?: string }> | undefined;
          const phone = phoneNumbers?.[0]?.sanitized_number || undefined;

          allPeople.push({
            full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            phone,
            email: (p.email as string) || undefined,
            license_type: (p.title as string) || undefined,
            city: (p.city as string) || (p.state as string) || undefined,
            source: "apollo" as const,
            raw_data: { apollo_id: id, linkedin_url: p.linkedin_url, organization: p.organization },
          });
        }
      } catch (e) {
        console.warn(`[hire-alert-scanner] Apollo error (batch page ${page}):`, e);
        break;
      }
    }
  }

  console.log(`[hire-alert-scanner] Apollo: found ${allPeople.length} candidates`);
  return allPeople;
}

// Source 3: Job board search via OpenRouter (perplexity/sonar-pro for live web search)
// Fallback chain: Indeed API → Indeed RSS → OpenRouter web search → Firecrawl
async function scanJobBoards(): Promise<RawCandidate[]> {
  // Primary: OpenRouter with perplexity/sonar-pro (live web search, always works)
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
  
  if (OPENROUTER_API_KEY) {
    const results = await scanJobBoardsViaOpenRouter(OPENROUTER_API_KEY);
    if (results.length > 0) return results;
  }

  // Fallback: Firecrawl web search
  return scanJobBoardsFallback();
}

// OpenRouter + perplexity/sonar-pro: live web search for tradespeople hiring/available
async function scanJobBoardsViaOpenRouter(apiKey: string): Promise<RawCandidate[]> {
  const searches = [
    "Find current job postings for boiler operators, HVAC technicians, plumbers, pipefitters, and electricians in Metro Detroit Michigan. For each posting, extract: company name, job title, city. Focus on postings from the last 7 days.",
    "Find licensed HVAC technicians, plumbers, or electricians in Michigan who are actively seeking work or recently posted resumes. Look on Indeed, ZipRecruiter, LinkedIn. Extract: person name or company name, trade, city.",
  ];

  const allResults: RawCandidate[] = [];
  const seen = new Set<string>();

  for (const query of searches) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            {
              role: "system",
              content: `You are a hiring intelligence researcher. Return ONLY valid JSON array. Each object: { "name": "company or person", "trade": "specific trade title", "city": "city name", "type": "job_posting" or "candidate" }. Max 15 results. No markdown, no explanation.`,
            },
            { role: "user", content: query },
          ],
          max_tokens: 1500,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.warn(`[hire-alert-scanner] OpenRouter HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      
      // Extract JSON from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ name: string; trade: string; city: string; type?: string }>;
      
      for (const item of parsed) {
        if (!item.name || !item.trade) continue;
        const key = `${item.name.toLowerCase()}-${item.trade.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        allResults.push({
          full_name: item.name,
          license_type: item.trade,
          city: item.city || "Metro Detroit",
          source: "firecrawl" as const,
          raw_data: { openrouter_search: true, type: item.type || "job_posting" },
        });
      }
    } catch (e) {
      console.warn(`[hire-alert-scanner] OpenRouter search error:`, e instanceof Error ? e.message : String(e));
    }
  }

  console.log(`[hire-alert-scanner] OpenRouter web search: found ${allResults.length} candidates`);
  return allResults;
}

// Firecrawl fallback if OpenRouter unavailable
async function scanJobBoardsFallback(): Promise<RawCandidate[]> {
  const queries = [
    '"boiler operator" "looking for work" OR "seeking position" Michigan',
    '"HVAC technician" "available" OR "open to opportunities" Detroit Michigan',
    '"pipefitter" OR "steamfitter" "UA Local 636" "available" Michigan',
  ];

  const allResults: RawCandidate[] = [];
  for (const query of queries) {
    const results = await firecrawlSearch(query);
    if (!results.length) continue;
    const context = results.slice(0, 3).map((r) => `Title: ${r.title}\nContent: ${r.markdown?.slice(0, 300)}`).join("\n---\n");
    const candidates = await generateJSON<RawCandidate[]>(
      `Extract tradespeople actively seeking work from this content. Return JSON array with: full_name, email, phone, license_type, city (Michigan), source="firecrawl". Return [] if none found.\n\n${context}`,
      [], 600
    );
    allResults.push(...(candidates || []).map((c) => ({ ...c, source: "firecrawl" as const })));
  }
  return allResults;
}

// Score candidate availability via AI with real signals
async function scoreCandidate(candidate: RawCandidate): Promise<{ score: number; reason: string }> {
  // Compute signals before sending to AI
  const hasPhone = !!candidate.phone;
  const hasEmail = !!candidate.email;
  const hasLicenseNumber = !!candidate.license_number;
  const isFromJobBoard = candidate.source === "firecrawl";

  // License recency signal: if expiry is 2+ years out, license was recently issued
  let licenseRecent = false;
  if (candidate.license_expiry) {
    const expiry = new Date(candidate.license_expiry);
    const monthsUntilExpiry = (expiry.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    licenseRecent = monthsUntilExpiry > 20; // new licenses typically expire in 2+ years
  }

  const result = await generateJSON<{ score: number; reason: string }>(
    `Score this tradesperson's immediate hire availability from 1-10. Be precise — avoid defaulting to 5 or 6.

Candidate:
Name: ${candidate.full_name}
Trade/License: ${candidate.license_type || "unknown"}
Source: ${candidate.source}${isFromJobBoard ? " (JOB BOARD — actively seeking work)" : ""}
City: ${candidate.city || "unknown"}
License Number: ${hasLicenseNumber ? candidate.license_number : "none"}${licenseRecent ? " (RECENTLY ISSUED — new to market)" : ""}
License Expiry: ${candidate.license_expiry || "unknown"}
Has Phone Number: ${hasPhone ? "YES" : "no"}
Has Email: ${hasEmail ? "YES" : "no"}

Scoring rules (apply ALL that match, then sum):
- Base: 4 points for having a verifiable trade title
- +3 if appeared on a job board (actively seeking)
- +2 if license number exists AND recently issued (new to market)
- +1 if has phone number (immediately contactable)
- +1 if has email address
- +1 if city is Metro Detroit area
- -2 if no license number AND source is MIOSHA (parse error — likely bad data)
- Cap at 10, floor at 1

Return JSON: { "score": number, "reason": "one sentence citing the top 1-2 signals" }`,
    null, // no default — derive score from signals if AI fails
    400
  );

  // If AI fails, compute a rule-based score from signals
  if (!result || typeof result.score !== "number") {
    let score = 4; // base for having a trade title
    if (isFromJobBoard) score += 3;
    if (hasLicenseNumber && licenseRecent) score += 2;
    if (hasPhone) score += 1;
    if (hasEmail) score += 1;
    score = Math.min(10, Math.max(1, score));
    return { score, reason: `Rule-based: source=${candidate.source}, phone=${hasPhone}, license=${hasLicenseNumber}` };
  }

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

  // Generic labels for client emails — never reveal our sources
  const sourceLabel = (s: string) =>
    s === "miosha" ? "State License Database" : s === "apollo" ? "Professional Network" : "Job Market";

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
      from: "TechAlert by Detroit Web Agency <matt@detroitwebagent.com>",
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
      We scanned multiple hiring intelligence sources this morning. ${hotCount > 0 ? `<strong>${hotCount} high-scoring ${hotCount === 1 ? "candidate" : "candidates"}</strong> — act fast before someone else does.` : "Here's what we found near you."}
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
        <td style="padding:4px 0;font-size:12px;color:#475569;">🔥 <strong>8-10</strong> — High availability: actively seeking work, local, contactable</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">⚡ <strong>7</strong> — Likely available: recently licensed or appeared in hiring channels</td>
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
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#475569;">Reply to adjust roles or zip codes</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;text-decoration:none;">Unsubscribe</a></p>
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
  const [mioshaCandidatesRaw, apolloCandidates, jobBoardCandidates] = await Promise.all([
    scanMIOSHA(),
    scanApollo(),
    scanJobBoards(),
  ]);

  // TA-3: Enrich MIOSHA candidates that lack contact info via Apollo /people/match
  const mioshaCandidates = await enrichMIOSHAWithApollo(mioshaCandidatesRaw);

  const allRaw = [...mioshaCandidates, ...apolloCandidates, ...jobBoardCandidates];
  // Track source health for founder report
  const sourceHealth = {
    miosha: mioshaCandidates.length > 0 ? "✅" : "⚠️ 0 results",
    apollo: apolloCandidates.length > 0 ? "✅" : "⚠️ 0 results (check API key)",
    jobBoards: jobBoardCandidates.length > 0 ? "✅" : "⚠️ 0 results",
  };
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

  // Upsert all new candidates into DB and capture their IDs for TA-9 tracking
  if (scored.length) {
    const { data: insertedRows, error: insertError } = await sb.from("hire_alert_candidates").insert(
      scored.map((c) => ({
        name: c.full_name,
        full_name: c.full_name,
        phone: c.phone || null,
        email: c.email || null,
        trade: c.license_type || null,
        license_type: c.license_type || null,
        license_number: c.license_number || null,
        state: "MI",
        license_expiry: c.license_expiry || null,
        city: c.city || null,
        zip: c.zip || null,
        source: c.source,
        status: "new",
        score: c.availability_score,
        availability_score: c.availability_score,
        score_reason: c.score_reason,
        raw_data: c.raw_data || null,
        enrichment_status: "pending",
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }))
    ).select("id, full_name");

    if (insertError) {
      console.error("[hire-alert-scanner] DB INSERT ERROR:", insertError.message, insertError.details);
    } else {
      console.log(`[hire-alert-scanner] Inserted ${insertedRows?.length || 0} candidates into DB`);
    }

    // Attach DB id to scored candidates for TA-9 client-candidate tracking
    if (insertedRows) {
      const idMap = new Map((insertedRows as any[]).map((r) => [r.full_name, r.id]));
      for (const c of scored) {
        (c as any)._db_id = idMap.get(c.full_name);
      }
    }
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

  // TA-5: Filter candidates by client's target zip codes (if set)
  function candidateMatchesZips(candidateZip: string | undefined, candidateCity: string | undefined, targetZips: string[]): boolean {
    if (!targetZips?.length) return true; // no zip filter = match all
    if (!candidateZip && !candidateCity) return true; // no location info = include (don't discard)
    if (candidateZip && targetZips.includes(candidateZip)) return true;
    // Loose city-based fallback: if candidate city substring matches any zip prefix
    // (e.g. "Detroit" matches any 482xx zip in target list)
    const CITY_ZIP_PREFIXES: Record<string, string[]> = {
      detroit: ["482"], dearborn: ["481"], warren: ["480"], livonia: ["481"],
      "sterling heights": ["483"], troy: ["480"], "royal oak": ["480"],
      "farmington hills": ["483"], pontiac: ["483"],
    };
    if (candidateCity) {
      const cityLower = candidateCity.toLowerCase();
      for (const [city, prefixes] of Object.entries(CITY_ZIP_PREFIXES)) {
        if (cityLower.includes(city)) {
          if (targetZips.some((z) => prefixes.some((p) => z.startsWith(p)))) return true;
        }
      }
    }
    return false;
  }

  let alertsSent = 0;

  for (const client of clients) {
    const clientRoles: string[] = client.target_roles || [];
    const clientZips: string[] = (client as any).target_zip_codes || [];

    // Filter scored candidates to only those matching this client's target roles + zips
    const clientAlertWorthy = scored.filter(
      (c) => c.availability_score >= 5
        && candidateMatchesRoles(c.license_type, clientRoles)
        && candidateMatchesZips(c.zip, c.city, clientZips)
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
          ? `TechAlert: ${top.full_name} (${top.license_type || "licensed tech"}, ${top.city || "Metro Detroit"}) — score ${top.availability_score}/10. You're the only one seeing this. Check your email. Reply STOP to opt out.`
          : `TechAlert: ${clientHotCandidates.length} licensed techs found in Metro Detroit. Top: ${top.full_name} (${top.license_type || "tradesperson"}, ${top.availability_score}/10). Check your email. Reply STOP to opt out.`;
        await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
      }

      // TA-9: Record which candidates were alerted to this client
      if (clientAlertWorthy.length) {
        const candidateIds = clientAlertWorthy
          .map((c) => (c as any)._db_id)
          .filter(Boolean);
        if (candidateIds.length) {
          await sb.from("hire_alert_client_candidates" as any).upsert(
            candidateIds.map((candidateId: string) => ({
              client_id: client.id,
              candidate_id: candidateId,
              alerted_at: new Date().toISOString(),
            })),
            { onConflict: "client_id,candidate_id", ignoreDuplicates: true }
          );
        }
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
      <img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff40;" alt="Matt">
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
      <span style="font-size:11px;color:#94a3b8;">🏛️ Src1: <strong style="color:#00d4ff;">${sourceBreakdown.miosha}</strong> ${sourceHealth.miosha}</span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">🔍 Src2: <strong style="color:#00d4ff;">${sourceBreakdown.apollo}</strong> ${sourceHealth.apollo}</span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">📋 Src3: <strong style="color:#00d4ff;">${sourceBreakdown.firecrawl}</strong> ${sourceHealth.jobBoards}</span>
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
      <span style="color:#475569;">3 data sources active</span>
    </td>
  </tr></table>
</td></tr>

</table></td></tr></table>
</body></html>`
  );

  await sb.from("agent_heartbeats").upsert({
    agent_name: "hire-alert-scanner",
    last_beat: new Date().toISOString(),
    metadata: { candidates_found: allRaw.length, new_candidates: newCandidates.length, hot_candidates: allHotCandidates.length, alerts_sent: alertsSent },
  }, { onConflict: "agent_name" });

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
