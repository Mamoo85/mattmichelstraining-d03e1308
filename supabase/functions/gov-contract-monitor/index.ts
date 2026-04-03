// Government Contract Opportunity Monitor — Edge Function
// Triggered daily via cron or on-demand (e.g. after new client signup).
//
// REQUIRED SECRETS (add via Supabase Dashboard > Project Settings > Edge Functions > Secrets):
//   SAM_GOV_API_KEY  — free API key from https://api.data.gov/signup
//   ANTHROPIC_API_KEY — Claude API key for AI scoring
//   RESEND_API_KEY    — for sending email digests
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — standard Supabase secrets

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SamOpportunity {
  noticeId: string;
  title: string;
  fullParentPathName?: string;
  naicsCode?: string;
  typeOfSetAside?: string;
  responseDeadLine?: string;
  postedDate?: string;
  uiLink?: string;
}

// Format date as MM/DD/YYYY for SAM.gov API
function formatSamDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function fetchSamOpportunities(params: {
  naicsCodes?: string;
  keywords?: string;
  postedFrom: string;
  postedTo: string;
}): Promise<SamOpportunity[]> {
  if (!SAM_GOV_API_KEY) {
    console.warn("[GOV-CONTRACT-MONITOR] SAM_GOV_API_KEY not set — skipping SAM.gov fetch");
    return [];
  }

  const results: SamOpportunity[] = [];
  const seen = new Set<string>();

  const buildUrl = (extraParams: Record<string, string>) => {
    const base = new URL("https://api.sam.gov/opportunities/v2/search");
    base.searchParams.set("api_key", SAM_GOV_API_KEY);
    base.searchParams.set("postedFrom", params.postedFrom);
    base.searchParams.set("postedTo", params.postedTo);
    base.searchParams.set("limit", "50");
    base.searchParams.set("offset", "0");
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) base.searchParams.set(k, v);
    }
    return base.toString();
  };

  // Search 1: by NAICS code
  if (params.naicsCodes) {
    const firstNaics = params.naicsCodes.split(",")[0].trim();
    if (firstNaics) {
      try {
        const res = await fetch(buildUrl({ naicsCode: firstNaics }));
        if (res.ok) {
          const json = await res.json();
          for (const opp of (json.opportunitiesData || [])) {
            if (!seen.has(opp.noticeId)) {
              seen.add(opp.noticeId);
              results.push(opp);
            }
          }
        } else {
          console.error("[GOV-CONTRACT-MONITOR] SAM NAICS search HTTP", res.status);
        }
      } catch (e) { console.error("[GOV-CONTRACT-MONITOR] SAM NAICS fetch error:", e); }
    }
  }

  // Search 2: by keywords
  if (params.keywords) {
    const firstKeyword = params.keywords.split(",")[0].trim();
    if (firstKeyword) {
      try {
        const res = await fetch(buildUrl({ q: firstKeyword }));
        if (res.ok) {
          const json = await res.json();
          for (const opp of (json.opportunitiesData || [])) {
            if (!seen.has(opp.noticeId)) {
              seen.add(opp.noticeId);
              results.push(opp);
            }
          }
        } else {
          console.error("[GOV-CONTRACT-MONITOR] SAM keyword search HTTP", res.status);
        }
      } catch (e) { console.error("[GOV-CONTRACT-MONITOR] SAM keyword fetch error:", e); }
    }
  }

  return results;
}

interface ScoringResult {
  score: number;
  recommendation: "bid" | "review" | "no-bid";
  summary: string;
}

async function scoreOpportunity(
  opp: SamOpportunity,
  client: { company_name: string; naics_codes: string; keywords: string; set_aside_types: string }
): Promise<ScoringResult> {
  if (!ANTHROPIC_API_KEY) {
    return { score: 50, recommendation: "review", summary: "AI scoring unavailable — manual review required." };
  }

  const prompt = `You are a federal contracting business development analyst. Score this SAM.gov opportunity for this company.

COMPANY PROFILE:
- Company: ${client.company_name}
- NAICS codes they work in: ${client.naics_codes || "not specified"}
- Keywords/capabilities: ${client.keywords || "not specified"}
- Set-aside types they qualify for: ${client.set_aside_types || "not specified"}

OPPORTUNITY:
- Title: ${opp.title}
- Agency: ${opp.fullParentPathName || "Unknown Agency"}
- NAICS Code: ${opp.naicsCode || "N/A"}
- Set-Aside Type: ${opp.typeOfSetAside || "Full and Open"}
- Response Deadline: ${opp.responseDeadLine || "N/A"}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "score": <integer 0-100, how well this matches the company>,
  "recommendation": <"bid" | "review" | "no-bid">,
  "summary": <2 sentences: why this is or isn't a good fit>
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[GOV-CONTRACT-MONITOR] Claude API error:", res.status);
      return { score: 50, recommendation: "review", summary: "AI scoring temporarily unavailable." };
    }

    const json = await res.json();
    const text = json.content?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    return {
      score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      recommendation: ["bid", "review", "no-bid"].includes(parsed.recommendation)
        ? parsed.recommendation
        : "review",
      summary: parsed.summary || "No summary available.",
    };
  } catch (e) {
    console.error("[GOV-CONTRACT-MONITOR] Claude scoring error:", e);
    return { score: 50, recommendation: "review", summary: "AI scoring error — please review manually." };
  }
}

function recColor(rec: string): string {
  if (rec === "bid") return "#16a34a";
  if (rec === "review") return "#ca8a04";
  return "#dc2626";
}

function recBg(rec: string): string {
  if (rec === "bid") return "#f0fdf4";
  if (rec === "review") return "#fefce8";
  return "#fef2f2";
}

function buildDigestEmail(
  opportunities: Array<{
    title: string;
    agency: string;
    response_deadline: string | null;
    match_score: number;
    bid_recommendation: string;
    sam_url: string | null;
    ai_summary: string;
  }>,
  companyName: string,
  dateStr: string
): string {
  const rows = opportunities.map((o) => {
    const deadline = o.response_deadline
      ? new Date(o.response_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "TBD";
    const recLabel = o.bid_recommendation === "bid" ? "BID" : o.bid_recommendation === "review" ? "REVIEW" : "NO-BID";
    const urlCell = o.sam_url
      ? `<a href="${o.sam_url}" style="color:#1d4ed8;text-decoration:none;font-size:12px">View on SAM.gov</a>`
      : "—";
    return `<tr style="background:${recBg(o.bid_recommendation)};border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0f172a;max-width:220px">${o.title}</td>
      <td style="padding:10px 12px;font-size:12px;color:#475569">${o.agency || "Unknown"}</td>
      <td style="padding:10px 12px;font-size:12px;color:#475569;white-space:nowrap">${deadline}</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="font-weight:700;font-size:13px;color:${recColor(o.bid_recommendation)}">${o.match_score}</span>
      </td>
      <td style="padding:10px 12px;text-align:center">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${recBg(o.bid_recommendation)};color:${recColor(o.bid_recommendation)};border:1px solid ${recColor(o.bid_recommendation)}">${recLabel}</span>
      </td>
      <td style="padding:10px 12px">${urlCell}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#1e3a5f;padding:24px 28px;border-bottom:3px solid #c59b2b">
    <p style="color:#c59b2b;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 6px">M² Development — Federal Contract Intelligence</p>
    <h1 style="color:#fff;margin:0;font-size:22px;font-family:Georgia,serif">📋 ${opportunities.length} New Contract ${opportunities.length === 1 ? "Opportunity" : "Opportunities"}</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">${companyName} · ${dateStr}</p>
  </div>
  <div style="padding:20px 28px">
    <p style="color:#475569;font-size:14px;margin:0 0 16px">
      We scanned SAM.gov and found <strong>${opportunities.length} contract ${opportunities.length === 1 ? "opportunity" : "opportunities"}</strong> matching your NAICS codes and keywords.
      Opportunities scoring <strong style="color:#16a34a">70+</strong> are strong matches. Click any row to view on SAM.gov.
    </p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <thead>
          <tr style="background:#1e3a5f">
            <th style="padding:10px 12px;text-align:left;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Title</th>
            <th style="padding:10px 12px;text-align:left;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Agency</th>
            <th style="padding:10px 12px;text-align:left;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Deadline</th>
            <th style="padding:10px 12px;text-align:center;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Score</th>
            <th style="padding:10px 12px;text-align:center;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Rec.</th>
            <th style="padding:10px 12px;text-align:left;color:#c59b2b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:20px;padding:14px;background:#eff6ff;border-left:3px solid #1d4ed8;border-radius:4px">
      <p style="margin:0;font-size:13px;color:#1e40af"><strong>Scoring guide:</strong> BID (70–100) = strong fit, pursue. REVIEW (40–69) = worth evaluating. NO-BID (&lt;40) = likely not a fit.</p>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:40px;height:40px;border-radius:50%;object-fit:cover" />
      <div style="font-size:12px;color:#64748b">
        <strong style="color:#1e293b">Matt Michels</strong> · M² Development<br>
        Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#1d4ed8">(313) 806-4952</a>
      </div>
    </div>
    <p style="margin:10px 0 0;font-size:11px;color:#94a3b8">You're receiving this because you subscribed to the Government Contract Opportunity Monitor. Reply to adjust your filters.</p>
  </div>
</div>
</body></html>`;
}

function buildDeadlineAlertEmail(
  urgent: Array<{ title: string; agency: string; response_deadline: string | null; sam_url: string | null; match_score: number }>,
  companyName: string
): string {
  const rows = urgent.map((o) => {
    const deadline = o.response_deadline
      ? new Date(o.response_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "TBD";
    const link = o.sam_url ? `<a href="${o.sam_url}" style="color:#dc2626;font-weight:700">View on SAM.gov →</a>` : "—";
    return `<tr style="border-bottom:1px solid #fca5a5">
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0f172a">${o.title}</td>
      <td style="padding:10px 12px;font-size:12px;color:#475569">${o.agency || "Unknown"}</td>
      <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#dc2626;white-space:nowrap">${deadline}</td>
      <td style="padding:10px 12px;font-size:12px">${link}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:2px solid #dc2626">
  <div style="background:#7f1d1d;padding:24px 28px">
    <p style="color:#fca5a5;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 6px">URGENT — M² Development Contract Alert</p>
    <h1 style="color:#fff;margin:0;font-size:22px;font-family:Georgia,serif">⏰ Deadline Alert: ${urgent.length} Contract${urgent.length === 1 ? "" : "s"} Due Within 72 Hours</h1>
    <p style="color:#fca5a5;margin:6px 0 0;font-size:13px">${companyName} — Action Required</p>
  </div>
  <div style="padding:20px 28px">
    <p style="color:#dc2626;font-size:14px;font-weight:600;margin:0 0 16px">The following opportunities close within 72 hours. Submit your response or request an extension NOW.</p>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:10px 12px;text-align:left;color:#7f1d1d;font-size:11px;font-weight:700;text-transform:uppercase">Title</th>
          <th style="padding:10px 12px;text-align:left;color:#7f1d1d;font-size:11px;font-weight:700;text-transform:uppercase">Agency</th>
          <th style="padding:10px 12px;text-align:left;color:#7f1d1d;font-size:11px;font-weight:700;text-transform:uppercase">Deadline</th>
          <th style="padding:10px 12px;text-align:left;color:#7f1d1d;font-size:11px;font-weight:700;text-transform:uppercase">Link</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="padding:16px 28px;background:#fef2f2;border-top:1px solid #fca5a5">
    <p style="margin:0;font-size:12px;color:#7f1d1d">M² Development Government Contract Monitor · <a href="tel:+13138064952" style="color:#dc2626">(313) 806-4952</a></p>
  </div>
</div>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Contract Monitor <matt@mattmichelstraining.com>",
      to: [to],
      bcc: ["matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all active clients
    const { data: clients, error: clientsError } = await sb
      .from("gov_contract_clients")
      .select("*")
      .eq("subscription_status", "active");

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const postedFrom = formatSamDate(yesterday);
    const postedTo = formatSamDate(now);
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    let totalProcessed = 0;

    for (const client of clients) {
      try {
        // Fetch opportunities from SAM.gov for this client's filters
        const opportunities = await fetchSamOpportunities({
          naicsCodes: client.naics_codes || "",
          keywords: client.keywords || "",
          postedFrom,
          postedTo,
        });

        const scored: Array<{
          opp: SamOpportunity;
          score: number;
          recommendation: string;
          summary: string;
        }> = [];

        for (const opp of opportunities) {
          // Check if already stored (unique constraint on client_id + sam_notice_id)
          const { data: existing } = await sb
            .from("gov_contract_opportunities")
            .select("id")
            .eq("client_id", client.id)
            .eq("sam_notice_id", opp.noticeId)
            .maybeSingle();

          if (existing) continue; // already processed

          // Score with Claude Haiku
          const scoring = await scoreOpportunity(opp, {
            company_name: client.company_name || "",
            naics_codes: client.naics_codes || "",
            keywords: client.keywords || "",
            set_aside_types: client.set_aside_types || "",
          });

          // Store in DB
          await sb.from("gov_contract_opportunities").insert({
            client_id: client.id,
            sam_notice_id: opp.noticeId,
            title: opp.title || "Untitled Opportunity",
            agency: opp.fullParentPathName || null,
            naics_code: opp.naicsCode || null,
            set_aside: opp.typeOfSetAside || null,
            response_deadline: opp.responseDeadLine ? new Date(opp.responseDeadLine).toISOString() : null,
            posted_date: opp.postedDate ? new Date(opp.postedDate).toISOString() : null,
            sam_url: opp.uiLink || null,
            match_score: scoring.score,
            bid_recommendation: scoring.recommendation,
            ai_summary: scoring.summary,
            sent_to_client: false,
          });

          scored.push({ opp, score: scoring.score, recommendation: scoring.recommendation, summary: scoring.summary });
        }

        // Compile digest: only opportunities with match_score >= 50
        const digestOpps = scored.filter((s) => s.score >= 50);

        if (digestOpps.length > 0 && RESEND_API_KEY) {
          const emailOpps = digestOpps.map((s) => ({
            title: s.opp.title || "Untitled",
            agency: s.opp.fullParentPathName || "Unknown Agency",
            response_deadline: s.opp.responseDeadLine ? new Date(s.opp.responseDeadLine).toISOString() : null,
            match_score: s.score,
            bid_recommendation: s.recommendation,
            sam_url: s.opp.uiLink || null,
            ai_summary: s.summary,
          }));

          const subject = `📋 [${digestOpps.length}] New Contract ${digestOpps.length === 1 ? "Opportunity" : "Opportunities"} — ${dateStr}`;
          await sendEmail(
            client.customer_email,
            subject,
            buildDigestEmail(emailOpps, client.company_name || "Your Company", dateStr)
          );
        }

        // Deadline alert: any opportunity (regardless of score) closing within 72 hours
        const now72 = new Date(now.getTime() + 72 * 60 * 60 * 1000);
        const urgentOpps = scored.filter((s) => {
          if (!s.opp.responseDeadLine) return false;
          const deadline = new Date(s.opp.responseDeadLine);
          return deadline > now && deadline <= now72;
        });

        if (urgentOpps.length > 0 && RESEND_API_KEY) {
          const urgentData = urgentOpps.map((s) => ({
            title: s.opp.title || "Untitled",
            agency: s.opp.fullParentPathName || "Unknown Agency",
            response_deadline: s.opp.responseDeadLine ? new Date(s.opp.responseDeadLine).toISOString() : null,
            sam_url: s.opp.uiLink || null,
            match_score: s.score,
          }));
          await sendEmail(
            client.customer_email,
            `⏰ URGENT: ${urgentOpps.length} Federal Contract Deadline${urgentOpps.length === 1 ? "" : "s"} Within 72 Hours`,
            buildDeadlineAlertEmail(urgentData, client.company_name || "Your Company")
          );
        }

        // Mark all newly stored opportunities as sent and update client
        if (scored.length > 0) {
          const noticeIds = scored.map((s) => s.opp.noticeId);
          await sb
            .from("gov_contract_opportunities")
            .update({ sent_to_client: true })
            .eq("client_id", client.id)
            .in("sam_notice_id", noticeIds);

          await sb
            .from("gov_contract_clients")
            .update({ last_notified_at: now.toISOString() })
            .eq("id", client.id);
        }

        totalProcessed++;
        console.log(`[GOV-CONTRACT-MONITOR] Processed client ${client.customer_email}: ${scored.length} new opps, ${digestOpps.length} in digest`);
      } catch (clientErr) {
        console.error(`[GOV-CONTRACT-MONITOR] Error processing client ${client.id}:`, clientErr);
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, clients: clients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GOV-CONTRACT-MONITOR] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
