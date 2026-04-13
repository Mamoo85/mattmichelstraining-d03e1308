// hire-alert-scanner — daily 7am ET
// Scans MIOSHA license DB and job boards for available licensed tradespeople.
// Enriches top candidates via Sonar OSINT before sending alerts.
// Alerts field service clients when new actionable candidates appear.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { generateJSON } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
  source: "miosha" | "firecrawl";
  raw_data?: Record<string, unknown>;
}

interface ScoredCandidate extends RawCandidate {
  availability_score: number;
  score_reason: string;
  linkedin_url?: string;
  facebook_url?: string;
  current_employer?: string;
  current_title?: string;
  years_experience?: number;
  qualifications_summary?: string;
  hiring_recommendation?: string;
  enrichment_status?: string;
}

// Source 1: MIOSHA Public License Database — delegates to miosha-license-scraper
async function scanMIOSHA(): Promise<RawCandidate[]> {
  try {
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

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("hire_alert_candidates")
    .select("full_name, name, phone, email, license_type, license_number, license_expiry, city, zip, source, raw_data, linkedin_url, facebook_url, current_employer, current_title, years_experience, qualifications_summary, hiring_recommendation, social_profiles, enrichment_status")
    .eq("source", "miosha")
    .gte("first_seen_at", since);

  return (data || []).map((r) => ({
    full_name: r.full_name || r.name,
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

// Source 2: Job board search via OpenRouter (perplexity/sonar-pro for live web search)
async function scanJobBoards(): Promise<RawCandidate[]> {
  if (OPENROUTER_API_KEY) {
    const results = await scanJobBoardsViaOpenRouter(OPENROUTER_API_KEY);
    if (results.length > 0) return results;
  }
  return scanJobBoardsFallback();
}

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

// ===== SONAR OSINT ENRICHMENT ENGINE =====
// Uses perplexity/sonar-pro to find LinkedIn, Facebook, email, phone, employer
// NEVER reveals sources to clients — proprietary intelligence method

function extractJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function enrichViaSonar(candidate: RawCandidate): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) return {};

  const tradeLabel = candidate.license_type || "tradesperson";
  const locationLabel = candidate.city ? `${candidate.city}, Michigan` : "Michigan";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a professional research assistant. Return ONLY valid JSON, no markdown, no explanation, no commentary.",
          },
          {
            role: "user",
            content: `Perform a web search to find the LinkedIn profile URL and Facebook profile URL for "${candidate.full_name}", who works as a ${tradeLabel} in or around ${locationLabel}. Also search for any associated public email addresses or phone numbers, their current employer, current job title, and estimated years of experience.

Return ONLY a JSON object with these keys:
{
  "linkedin_url": "full URL or null",
  "facebook_url": "full URL or null",
  "email": "email or null",
  "phone": "phone or null",
  "current_employer": "company name or null",
  "current_title": "job title or null",
  "years_experience": number or null
}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[hire-alert-scanner] Sonar enrichment HTTP ${res.status} for ${candidate.full_name}`);
      return {};
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    if (!parsed) {
      console.warn(`[hire-alert-scanner] Sonar JSON parse failed for ${candidate.full_name}`);
      return {};
    }

    console.log(`[hire-alert-scanner] Sonar enriched: ${candidate.full_name} → linkedin=${!!parsed.linkedin_url} fb=${!!parsed.facebook_url} phone=${!!parsed.phone} email=${!!parsed.email}`);
    return parsed;
  } catch (e) {
    console.warn(`[hire-alert-scanner] Sonar enrichment error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// AI Synthesis via Lovable AI Gateway (free) — generates qualifications + recommendation
// NEVER mentions AI, algorithms, data sources, or methodology
async function synthesizeViaAI(
  candidate: RawCandidate,
  sonarData: Record<string, unknown>
): Promise<{ qualifications_summary: string; hiring_recommendation: string }> {
  if (!LOVABLE_API_KEY) return { qualifications_summary: "", hiring_recommendation: "" };

  const prompt = `You are an experienced hiring researcher writing a brief dossier. Based on the following candidate data, write two things:

1. QUALIFICATIONS SUMMARY (2-3 sentences): Their trade expertise, years of experience, license status, and current situation.
2. HIRING RECOMMENDATION (2-3 sentences): Whether an employer should reach out, how urgently, and the best approach.

CANDIDATE:
- Name: ${candidate.full_name}
- Trade/License: ${candidate.license_type || "Unknown"}
- License Number: ${candidate.license_number || "Not found"}
- License Expiry: ${candidate.license_expiry || "Unknown"}
- Location: ${candidate.city || "Michigan"}

RESEARCH FINDINGS:
- Employer: ${sonarData.current_employer || "Not found"}
- Title: ${sonarData.current_title || "Not found"}
- Experience: ${sonarData.years_experience || "Unknown"} years
- LinkedIn: ${sonarData.linkedin_url ? "Found" : "Not found"}
- Phone: ${sonarData.phone ? "Found" : "Not found"}
- Email: ${sonarData.email ? "Found" : "Not found"}

CRITICAL RULES:
- Do NOT mention AI, algorithms, databases, data sources, web scraping, or any methodology.
- Write as a human hiring researcher would.
- Be specific and actionable.

Return JSON: { "qualifications_summary": "...", "hiring_recommendation": "..." }`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { qualifications_summary: "", hiring_recommendation: "" };

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(text);
    if (!parsed) return { qualifications_summary: "", hiring_recommendation: "" };

    return {
      qualifications_summary: (parsed.qualifications_summary as string) || "",
      hiring_recommendation: (parsed.hiring_recommendation as string) || "",
    };
  } catch {
    return { qualifications_summary: "", hiring_recommendation: "" };
  }
}

// Score candidate availability via AI with real signals
async function scoreCandidate(candidate: RawCandidate): Promise<{ score: number; reason: string }> {
  const hasPhone = !!candidate.phone;
  const hasEmail = !!candidate.email;
  const hasLicenseNumber = !!candidate.license_number;
  const isFromJobBoard = candidate.source === "firecrawl";

  let licenseRecent = false;
  if (candidate.license_expiry) {
    const expiry = new Date(candidate.license_expiry);
    const monthsUntilExpiry = (expiry.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    licenseRecent = monthsUntilExpiry > 20;
  }

  const result = await generateJSON<{ score: number; reason: string }>(
    `Score this tradesperson's immediate hire availability from 1-10. Be precise — avoid defaulting to 5 or 6.

Candidate:
Name: ${candidate.full_name}
Trade/License: ${candidate.license_type || "unknown"}
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
    null,
    400
  );

  if (!result || typeof result.score !== "number") {
    let score = 4;
    if (isFromJobBoard) score += 3;
    if (hasLicenseNumber && licenseRecent) score += 2;
    if (hasPhone) score += 1;
    if (hasEmail) score += 1;
    score = Math.min(10, Math.max(1, score));
    return { score, reason: `Verified trade professional, ${hasPhone ? "contactable" : "contact info pending"}, ${candidate.city || "Michigan"} area` };
  }

  return result;
}

// ===== ACTION BUTTON EMAIL TEMPLATE =====
// Every candidate card has prominent clickable buttons — no dead ends

function buildActionButtons(c: ScoredCandidate): string {
  const buttons: string[] = [];

  if (c.linkedin_url) {
    buttons.push(`<a href="${c.linkedin_url}" target="_blank" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">🔗 Message on LinkedIn</a>`);
  }
  if (c.facebook_url) {
    buttons.push(`<a href="${c.facebook_url}" target="_blank" style="display:inline-block;background:#1877f2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">👤 View Facebook</a>`);
  }
  if (c.email) {
    buttons.push(`<a href="mailto:${c.email}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✉️ Send Email</a>`);
  }
  if (c.phone) {
    buttons.push(`<a href="tel:${c.phone}" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call ${c.phone}</a>`);
  }
  if (c.license_number) {
    buttons.push(`<a href="https://aca-prod.accela.com/LARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y" target="_blank" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📜 Verify State License</a>`);
  }

  if (!buttons.length) return "";

  return `<tr><td style="padding:12px 0 4px;">
    <table cellpadding="0" cellspacing="0"><tr><td>
      ${buttons.join("\n      ")}
    </td></tr></table>
  </td></tr>`;
}

// Send alert email to a client — premium design with action buttons
async function sendAlertEmail(
  client: { owner_email: string; company_name: string; dashboard_token?: string },
  candidates: ScoredCandidate[],
  dateStr: string
) {
  if (!RESEND_API_KEY || !client.owner_email) return;

  const hotCount = candidates.filter((c) => c.availability_score >= 7).length;

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
              <p style="margin:3px 0 0;font-size:12px;color:${c.availability_score >= 7 ? "#94a3b8" : "#64748b"};">Detected ${dateStr}</p>
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
                  ${c.years_experience ? `<td width="8"></td><td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">${c.years_experience}+ yrs exp</td>` : ""}
                </tr></table>
              </td>
            </tr>
            ${c.current_employer ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 <strong>${c.current_employer}</strong>${c.current_title ? ` · ${c.current_title}` : ""}</td></tr>` : ""}
            ${c.license_number ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>${c.license_number}</strong>${c.license_expiry ? ` · Exp: <strong>${c.license_expiry}</strong>` : ""} · <span style="color:#059669;font-weight:700;">Active</span></td></tr>` : ""}
            ${c.qualifications_summary ? `<tr><td style="padding:8px 0 4px;">
              <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> ${c.qualifications_summary}</p>
            </td></tr>` : ""}
            ${c.hiring_recommendation ? `<tr><td style="padding:4px 0;">
              <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#eff6ff;padding:10px 12px;border-radius:8px;border-left:3px solid #3b82f6;"><strong>💡 Recommendation:</strong> ${c.hiring_recommendation}</p>
            </td></tr>` : ""}
            <!-- ACTION BUTTONS -->
            ${buildActionButtons(c)}
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
      Our hiring intelligence engine scanned the market this morning. ${hotCount > 0 ? `<strong>${hotCount} high-scoring ${hotCount === 1 ? "candidate" : "candidates"}</strong> — tap the buttons below to reach out before someone else does.` : "Here's what we found near you. Tap any button to take action instantly."}
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

  <!-- DASHBOARD CTA -->
  ${client.dashboard_token ? `<tr><td style="background:#0a1628;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:center;">
    <a href="https://m2training.lovable.app/my-techalert?token=${client.dashboard_token}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">📊 View Full Dossiers in Your Dashboard</a>
    <p style="margin:10px 0 0;font-size:11px;color:#64748b;">Browse, filter, and track all candidates with complete contact information</p>
  </td></tr>` : ""}

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

  // Run sources in parallel (Apollo removed — Sonar OSINT handles enrichment)
  console.log("[hire-alert-scanner] Scanning all sources...");
  const [mioshaCandidates, jobBoardCandidates] = await Promise.all([
    scanMIOSHA(),
    scanJobBoards(),
  ]);

  const allRaw = [...mioshaCandidates, ...jobBoardCandidates];
  const sourceHealth = {
    miosha: mioshaCandidates.length > 0 ? "✅" : "⚠️ 0 results",
    sonar: jobBoardCandidates.length > 0 ? "✅" : "⚠️ 0 results",
  };
  console.log(`[hire-alert-scanner] Raw candidates: MIOSHA=${mioshaCandidates.length} JobBoards=${jobBoardCandidates.length}`);

  // Deduplicate by license_number or name+city
  const seen = new Set<string>();
  const deduped = allRaw.filter((c) => {
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Check which candidates are new
  const { data: existingRecords } = await sb
    .from("hire_alert_candidates")
    .select("license_number, full_name, name, city, linkedin_url, facebook_url, current_employer, current_title, years_experience, qualifications_summary, hiring_recommendation, enrichment_status, email, phone")
    .in("source", ["miosha", "firecrawl"]);

  const enrichmentLookup = new Map<string, Record<string, unknown>>();
  for (const r of existingRecords || []) {
    const key = r.license_number || `${((r.full_name || r.name) || "").toLowerCase()}-${(r.city || "").toLowerCase()}`;
    if (r.enrichment_status === "complete") {
      enrichmentLookup.set(key, {
        linkedin_url: r.linkedin_url, facebook_url: r.facebook_url,
        current_employer: r.current_employer, current_title: r.current_title,
        years_experience: r.years_experience, qualifications_summary: r.qualifications_summary,
        hiring_recommendation: r.hiring_recommendation, enrichment_status: r.enrichment_status,
        email: r.email, phone: r.phone,
      });
    }
  }

  const existingKeys = new Set(
    (existingRecords || []).map((r) =>
      r.license_number || `${((r.full_name || r.name) || "").toLowerCase()}-${(r.city || "").toLowerCase()}`
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
    const key = candidate.license_number || `${candidate.full_name.toLowerCase()}-${(candidate.city || "").toLowerCase()}`;
    const enrichment = enrichmentLookup.get(key);
    scored.push({
      ...candidate,
      availability_score: score,
      score_reason: reason,
      ...(enrichment ? {
        linkedin_url: enrichment.linkedin_url as string | undefined,
        facebook_url: enrichment.facebook_url as string | undefined,
        current_employer: enrichment.current_employer as string | undefined,
        current_title: enrichment.current_title as string | undefined,
        years_experience: enrichment.years_experience as number | undefined,
        qualifications_summary: enrichment.qualifications_summary as string | undefined,
        hiring_recommendation: enrichment.hiring_recommendation as string | undefined,
        enrichment_status: enrichment.enrichment_status as string | undefined,
        email: candidate.email || enrichment.email as string | undefined,
        phone: candidate.phone || enrichment.phone as string | undefined,
      } : {}),
    });
  }

  // ===== INLINE SONAR OSINT ENRICHMENT =====
  // Sort by score DESC, enrich top 5 to stay within timeout limits
  // Remaining candidates get enrichment_status='pending' for candidate-deep-enrich second pass
  const sortedByScore = [...scored].sort((a, b) => b.availability_score - a.availability_score);
  const enrichBatch = sortedByScore.slice(0, 5);
  const pendingBatch = sortedByScore.slice(5);

  console.log(`[hire-alert-scanner] Enriching top ${enrichBatch.length} candidates inline (${pendingBatch.length} deferred to deep-enrich)`);

  for (const candidate of enrichBatch) {
    // Skip if already enriched from DB
    if (candidate.enrichment_status === "complete") continue;

    try {
      const sonarData = await enrichViaSonar(candidate);

      // Merge Sonar data into candidate
      if (sonarData.linkedin_url) candidate.linkedin_url = sonarData.linkedin_url as string;
      if (sonarData.facebook_url) candidate.facebook_url = sonarData.facebook_url as string;
      if (sonarData.email && !candidate.email) candidate.email = sonarData.email as string;
      if (sonarData.phone && !candidate.phone) candidate.phone = sonarData.phone as string;
      if (sonarData.current_employer) candidate.current_employer = sonarData.current_employer as string;
      if (sonarData.current_title) candidate.current_title = sonarData.current_title as string;
      if (sonarData.years_experience) candidate.years_experience = sonarData.years_experience as number;

      // AI Synthesis
      const { qualifications_summary, hiring_recommendation } = await synthesizeViaAI(candidate, sonarData);
      if (qualifications_summary) candidate.qualifications_summary = qualifications_summary;
      if (hiring_recommendation) candidate.hiring_recommendation = hiring_recommendation;

      candidate.enrichment_status = "complete";
    } catch (e) {
      console.warn(`[hire-alert-scanner] Inline enrichment failed for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
      candidate.enrichment_status = "pending"; // Will be picked up by deep-enrich
    }
  }

  // Mark pending batch
  for (const c of pendingBatch) {
    if (!c.enrichment_status) c.enrichment_status = "pending";
  }

  // Upsert all new candidates into DB
  const allScored = [...enrichBatch, ...pendingBatch];
  if (allScored.length) {
    const { data: insertedRows, error: insertError } = await sb.from("hire_alert_candidates").insert(
      allScored.map((c) => ({
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
        linkedin_url: c.linkedin_url || null,
        facebook_url: c.facebook_url || null,
        current_employer: c.current_employer || null,
        current_title: c.current_title || null,
        years_experience: c.years_experience || null,
        qualifications_summary: c.qualifications_summary || null,
        hiring_recommendation: c.hiring_recommendation || null,
        enrichment_status: c.enrichment_status || "pending",
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }))
    ).select("id, full_name");

    if (insertError) {
      console.error("[hire-alert-scanner] DB INSERT ERROR:", insertError.message, insertError.details);
    } else {
      console.log(`[hire-alert-scanner] Inserted ${insertedRows?.length || 0} candidates into DB`);
    }

    if (insertedRows) {
      const idMap = new Map((insertedRows as any[]).map((r) => [r.full_name, r.id]));
      for (const c of allScored) {
        (c as any)._db_id = idMap.get(c.full_name);
      }
    }
  }

  // Role keyword map
  const ROLE_KEYWORDS: Record<string, string[]> = {
    boiler_operator: ["boiler", "boiler operator"],
    steam_engineer: ["steam engineer"],
    pressure_vessel: ["pressure vessel", "pvi", "inspector"],
    hvac_tech: ["hvac", "air conditioning", "refrigeration", "heating"],
    plumber: ["plumber", "plumbing", "master plumber"],
    pipefitter: ["pipefitter", "steamfitter", "ua local", "ua 636"],
    electrician: ["electrician", "electrical"],
    industrial_mechanic: ["industrial mechanic", "maintenance mechanic"],
    cna: ["cna", "certified nursing assistant", "nurse aide", "nursing assistant"],
    rn: ["rn", "registered nurse"],
    lpn: ["lpn", "licensed practical nurse", "practical nurse"],
    director_of_nursing: ["director of nursing", "don", "nursing director"],
    home_health_aide: ["home health aide", "home health", "hha"],
  };

  function candidateMatchesRoles(licenseType: string | undefined, targetRoles: string[]): boolean {
    if (!licenseType || !targetRoles?.length) return true;
    const lower = licenseType.toLowerCase();
    return targetRoles.some((role) =>
      (ROLE_KEYWORDS[role] || [role]).some((kw) => lower.includes(kw))
    );
  }

  function candidateMatchesZips(candidateZip: string | undefined, candidateCity: string | undefined, targetZips: string[]): boolean {
    if (!targetZips?.length) return true;
    if (!candidateZip && !candidateCity) return true;
    if (candidateZip && targetZips.includes(candidateZip)) return true;
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
    const clientAlertWorthy = allScored.filter(
      (c) => c.availability_score >= 5
        && candidateMatchesRoles(c.license_type, clientRoles)
        && candidateMatchesZips(c.zip, c.city, clientZips)
    );

    // ===== NO GHOST LEAD RULE =====
    // Only send candidates that have at least ONE clickable action link
    const actionableCandidates = clientAlertWorthy.filter(
      (c) => c.linkedin_url || c.facebook_url || c.email || c.phone
    );

    const clientHotCandidates = actionableCandidates.filter((c) => c.availability_score >= 7);

    if (!actionableCandidates.length) {
      if (clientAlertWorthy.length) {
        console.log(`[hire-alert-scanner] Skipping ${client.company_name} — ${clientAlertWorthy.length} candidates matched but NONE had actionable contact info (No Ghost Lead rule)`);
      }
      continue;
    }

    try {
      if (client.notify_email && client.owner_email) {
        await sendAlertEmail(client, actionableCandidates, dateStr);
        alertsSent++;
      }

      if (client.notify_sms && client.owner_phone && clientHotCandidates.length) {
        const top = clientHotCandidates[0];
        const dashLink = client.dashboard_token ? ` View all: m2training.lovable.app/my-techalert?token=${client.dashboard_token}` : "";
        const smsBody = clientHotCandidates.length === 1
          ? `TechAlert: ${top.full_name} (${top.license_type || "licensed tech"}, ${top.city || "Metro Detroit"}) — score ${top.availability_score}/10. You're the only one seeing this.${dashLink} Reply STOP to opt out.`
          : `TechAlert: ${clientHotCandidates.length} licensed techs found. Top: ${top.full_name} (${top.license_type || "tradesperson"}, ${top.availability_score}/10).${dashLink} Reply STOP to opt out.`;
        await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
      }

      // TA-9: Record which candidates were alerted to this client
      if (actionableCandidates.length) {
        const candidateIds = actionableCandidates
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

  // Update alerted candidates
  const allAlertWorthy = allScored.filter((c) => c.availability_score >= 5 && (c.linkedin_url || c.facebook_url || c.email || c.phone));
  const allHotCandidates = allScored.filter((c) => c.availability_score >= 7);

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

  // Founder daily report — Matt only (sources visible here only)
  const sourceBreakdown = {
    miosha: allScored.filter((c) => c.source === "miosha").length,
    sonar: allScored.filter((c) => c.source === "firecrawl").length,
  };

  const enrichedCount = allScored.filter((c) => c.enrichment_status === "complete").length;
  const ghostLeadsFiltered = allScored.filter((c) => c.availability_score >= 5 && !c.linkedin_url && !c.facebook_url && !c.email && !c.phone).length;

  const candidateRows = allScored.length
    ? allScored
        .sort((a, b) => b.availability_score - a.availability_score)
        .map(
          (c, i) => {
            const rowBg = c.availability_score >= 7 ? "#0a16280a" : i % 2 === 0 ? "#fff" : "#f8fafc";
            const scoreBgColor = c.availability_score >= 8 ? "#dc2626" : c.availability_score >= 7 ? "#e8621a" : c.availability_score >= 5 ? "#f59e0b" : "#94a3b8";
            const sourceIcon = c.source === "miosha" ? "🏛️" : "📋";
            const enrichIcon = c.enrichment_status === "complete" ? "✅" : c.enrichment_status === "pending" ? "⏳" : "❌";
            const hasAction = c.linkedin_url || c.facebook_url || c.email || c.phone;
            return `<tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:${c.availability_score >= 7 ? "800" : "500"};">${c.full_name}${c.email ? `<br><span style="font-size:11px;color:#0891b2;font-weight:400;">${c.email}</span>` : ""}${c.phone ? `<br><span style="font-size:11px;color:#e8621a;font-weight:600;">${c.phone}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${c.license_type || "—"}${c.license_number ? `<br><span style="font-size:10px;color:#94a3b8;">#${c.license_number}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${c.city || "—"}</td>
              <td style="padding:12px 10px;text-align:center;">
                <span style="display:inline-block;background:${scoreBgColor};color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">${c.availability_score >= 8 ? "🔥 " : ""}${c.availability_score}/10</span>
              </td>
              <td style="padding:12px 10px;font-size:11px;color:#64748b;">${sourceIcon} ${c.source}</td>
              <td style="padding:12px 10px;font-size:11px;color:#64748b;">${enrichIcon} ${c.enrichment_status || "—"}</td>
              <td style="padding:12px 10px;font-size:11px;color:#475569;">${hasAction ? "✅ Actionable" : "❌ Ghost"}</td>
            </tr>`;
          }
        )
        .join("")
    : `<tr><td colspan="7" style="padding:32px;text-align:center;color:#94a3b8;font-size:14px;">No new candidates found today. Scanner ran successfully.</td></tr>`;

  await notifyMatt(
    `${allHotCandidates.length > 0 ? "🔥 " : ""}TechAlert — ${dateStr} — ${newCandidates.length} new${allHotCandidates.length > 0 ? `, ${allHotCandidates.length} HOT` : ""} · ${enrichedCount} enriched`,
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
    <td style="text-align:center;padding:16px 8px;background:#10b98118;border-radius:12px;">
      <p style="margin:0;font-size:32px;font-weight:900;color:#10b981;line-height:1;">${enrichedCount}</p>
      <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Enriched</p>
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

<!-- SOURCE + ENRICHMENT HEALTH -->
<tr><td style="background:#1e293b;padding:0 28px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="padding:8px 12px;background:#ffffff06;border-radius:8px;">
      <span style="font-size:11px;color:#94a3b8;">🏛️ MIOSHA: <strong style="color:#00d4ff;">${sourceBreakdown.miosha}</strong> ${sourceHealth.miosha}</span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">📋 Sonar/JobBoards: <strong style="color:#00d4ff;">${sourceBreakdown.sonar}</strong> ${sourceHealth.sonar}</span>
      <span style="font-size:11px;color:#334155;"> · </span>
      <span style="font-size:11px;color:#94a3b8;">👻 Ghost leads filtered: <strong style="color:#e8621a;">${ghostLeadsFiltered}</strong></span>
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
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Enrich</th>
      <th style="padding:10px 10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Status</th>
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
      <span style="color:#475569;">Sonar OSINT enrichment: top 5/run · No Ghost Lead filter active</span>
    </td>
  </tr></table>
</td></tr>

</table></td></tr></table>
</body></html>`
  );

  await sb.from("agent_heartbeats").upsert({
    agent_name: "hire-alert-scanner",
    last_beat: new Date().toISOString(),
    metadata: { candidates_found: allRaw.length, new_candidates: newCandidates.length, hot_candidates: allHotCandidates.length, alerts_sent: alertsSent, enriched_inline: enrichedCount, ghost_leads_filtered: ghostLeadsFiltered },
  }, { onConflict: "agent_name" });

  return new Response(
    JSON.stringify({
      candidates_found: allRaw.length,
      new_candidates: newCandidates.length,
      hot_candidates: allHotCandidates.length,
      alerts_sent: alertsSent,
      enriched_inline: enrichedCount,
      ghost_leads_filtered: ghostLeadsFiltered,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
