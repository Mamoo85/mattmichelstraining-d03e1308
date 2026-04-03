import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Trademark-themed email template ──────────────────────────────────────────
function tmEmail(opts: {
  greeting: string;
  headline: string;
  body: string;
  cta?: { text: string; url: string };
}): string {
  const ctaBlock = opts.cta
    ? `<div style="text-align:center;margin:24px 0"><a href="${opts.cta.url}" style="display:inline-block;background:#1a3a6e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;font-family:sans-serif">${opts.cta.text}</a></div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f2547;padding:20px 28px;border-bottom:3px solid #c9a227">
    <p style="color:#c9a227;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Development · Trademark Watch</p>
    <h1 style="color:#fff;margin:0;font-size:20px;font-family:Georgia,serif">${opts.headline}</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8">
    <p style="margin:0 0 16px">${opts.greeting}</p>
    ${opts.body}
    ${ctaBlock}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">Matt Michels</strong><br>Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#c9a227">(313) 806-4952</a>
      </div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
  </div>
</div></body></html>`;
}

// ── Claude Haiku similarity analysis ─────────────────────────────────────────
async function analyzeWithClaude(
  watchedMark: string,
  watchedGs: string,
  candidateMark: string,
  candidateGs: string,
  applicant: string
): Promise<{ score: number; recommendation: "oppose" | "monitor" | "ignore"; analysis: string }> {
  if (!ANTHROPIC_API_KEY) {
    return { score: 50, recommendation: "monitor", analysis: "AI analysis unavailable — manual review recommended." };
  }

  const prompt = `You are a US trademark attorney evaluating potential conflicts.

WATCHED MARK: "${watchedMark}"
WATCHED GOODS/SERVICES: "${watchedGs || "not specified"}"

CANDIDATE APPLICATION:
Mark: "${candidateMark}"
Applicant: "${applicant}"
Goods/Services: "${candidateGs || "not specified"}"

Evaluate the likelihood of confusion under the DuPont factors. Respond with EXACTLY this JSON format and nothing else:
{
  "score": <integer 0-100 where 0=no conflict, 100=identical conflict>,
  "recommendation": "<oppose|monitor|ignore>",
  "analysis": "<exactly 2 sentences: first sentence states the similarity basis, second sentence gives the action rationale>"
}

Guidelines:
- score 70-100: recommend "oppose" (file opposition within 30 days)
- score 40-69: recommend "monitor" (watch for further development)
- score 0-39: recommend "ignore" (low conflict risk)`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("[TMW-SCAN] Claude error:", await res.text());
    return { score: 50, recommendation: "monitor", analysis: "AI analysis temporarily unavailable." };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const parsed = JSON.parse(text.trim());
    return {
      score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      recommendation: ["oppose", "monitor", "ignore"].includes(parsed.recommendation) ? parsed.recommendation : "monitor",
      analysis: parsed.analysis || "No analysis provided.",
    };
  } catch {
    return { score: 50, recommendation: "monitor", analysis: "AI analysis parsing error — manual review recommended." };
  }
}

// ── USPTO TMSEARCH search ─────────────────────────────────────────────────────
async function searchUSPTO(markText: string): Promise<any[]> {
  try {
    const url = `https://tmsearch.uspto.gov/api/search?query=${encodeURIComponent(markText)}&hits=20`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "M2-Trademark-Watch/1.0" },
    });
    if (!res.ok) {
      console.error(`[TMW-SCAN] USPTO search failed (${res.status}) for "${markText}"`);
      return [];
    }
    const data = await res.json();
    // USPTO TMSEARCH returns { hits: { hits: [...] } } structure
    const hits = data?.hits?.hits || data?.results || data?.hits || [];
    return Array.isArray(hits) ? hits : [];
  } catch (e) {
    console.error(`[TMW-SCAN] USPTO fetch error for "${markText}":`, e);
    return [];
  }
}

function parseUSPTOHit(hit: any): { serialNumber: string; markText: string; applicant: string; goodsServices: string; filingDate: string | null } {
  // Handle both nested _source and flat structures
  const src = hit._source || hit;
  return {
    serialNumber: src.serialNumber || src.serial_number || src.serialNo || hit._id || "",
    markText: src.markIdentification || src.mark_identification || src.wordMark || src.mark || "",
    applicant: src.applicantName || src.applicant_name || src.ownerName || src.applicant || "",
    goodsServices: src.goodsAndServices || src.goods_services || src.description || "",
    filingDate: src.filingDate || src.filing_date || src.filedDate || null,
  };
}

// ── Score color for email ─────────────────────────────────────────────────────
function recColor(rec: string): string {
  if (rec === "oppose") return "#dc2626";
  if (rec === "monitor") return "#d97706";
  return "#16a34a";
}

function recLabel(rec: string): string {
  if (rec === "oppose") return "OPPOSE";
  if (rec === "monitor") return "MONITOR";
  return "IGNORE";
}

// ── Build weekly digest email body ───────────────────────────────────────────
function buildDigestBody(markText: string, findings: any[]): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const alertFindings = findings.filter((f) => f.similarity_score >= 40);

  if (alertFindings.length === 0) {
    return `<p style="margin:0 0 12px"><strong>No new similar marks filed this week.</strong></p>
<p style="margin:0 0 8px;color:#475569">We scanned USPTO filings for marks similar to <strong>"${markText}"</strong> and found no new applications that warrant attention.</p>
<p style="margin:0;color:#64748b;font-size:13px">We continue monitoring weekly. You'll hear from us the moment something changes.</p>`;
  }

  const opposeCount = alertFindings.filter((f) => f.recommendation === "oppose").length;
  const monitorCount = alertFindings.filter((f) => f.recommendation === "monitor").length;

  let html = `<p style="margin:0 0 12px">Weekly scan for <strong>"${markText}"</strong> — ${dateStr}</p>`;

  if (opposeCount > 0) {
    html += `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
<strong style="color:#dc2626">⚠️ ${opposeCount} mark${opposeCount > 1 ? "s" : ""} flagged for opposition.</strong> You have a <strong>30-day window</strong> from the publication date to file an opposition with the USPTO. Do not delay.
</div>`;
  }

  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
<thead><tr style="background:#0f2547;color:#fff">
  <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:700">Mark / Applicant</th>
  <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700">Score</th>
  <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700">Action</th>
  <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:700">Filed</th>
</tr></thead><tbody>`;

  for (const f of alertFindings) {
    const color = recColor(f.recommendation);
    html += `<tr style="border-bottom:1px solid #e2e8f0">
  <td style="padding:10px;font-size:13px">
    <strong>${f.mark_text || "—"}</strong><br>
    <span style="color:#64748b;font-size:12px">${f.applicant_name || "Unknown applicant"}</span><br>
    <span style="color:#94a3b8;font-size:11px">Serial: ${f.serial_number}</span>
  </td>
  <td style="padding:10px;text-align:center;font-size:18px;font-weight:900;color:${color}">${f.similarity_score}</td>
  <td style="padding:10px;text-align:center">
    <span style="background:${color};color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700">${recLabel(f.recommendation)}</span>
  </td>
  <td style="padding:10px;font-size:12px;color:#475569">${f.filing_date || "—"}</td>
</tr>
<tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc">
  <td colspan="4" style="padding:8px 10px;font-size:12px;color:#475569;font-style:italic">${f.ai_analysis || ""}</td>
</tr>`;
  }

  html += `</tbody></table>
<p style="margin:0 0 8px;font-size:13px;color:#64748b"><strong>Score guide:</strong> 70–100 = Oppose (high confusion risk) · 40–69 = Monitor (watch for development) · 0–39 = Ignore (low risk)</p>
<p style="margin:0;font-size:12px;color:#94a3b8">This is an informational service. Consult a licensed trademark attorney before filing any opposition.</p>`;

  return html;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggerEmail: string | null = body?.email || null;

    // Fetch active clients
    let clientQuery = (sb.from as any)("trademark_watch_clients")
      .select("id, customer_email, customer_name, company_name, subscription_status")
      .eq("subscription_status", "active");

    if (triggerEmail) {
      clientQuery = clientQuery.eq("customer_email", triggerEmail);
    }

    const { data: clients, error: clientErr } = await clientQuery;
    if (clientErr) throw clientErr;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalScanned = 0;
    let totalNew = 0;

    for (const client of clients) {
      // Fetch all marks for this client
      const { data: marks } = await (sb.from as any)("trademark_watch_marks")
        .select("*")
        .eq("client_id", client.id);

      if (!marks || marks.length === 0) continue;

      for (const mark of marks) {
        // Search USPTO
        const hits = await searchUSPTO(mark.mark_text);
        totalScanned += hits.length;

        // Load existing serial numbers to detect new ones
        const { data: existingFindings } = await (sb.from as any)("trademark_watch_findings")
          .select("serial_number")
          .eq("mark_id", mark.id);

        const existingSerials = new Set((existingFindings || []).map((f: any) => f.serial_number));

        const newFindings: any[] = [];

        for (const hit of hits) {
          const parsed = parseUSPTOHit(hit);
          if (!parsed.serialNumber || existingSerials.has(parsed.serialNumber)) continue;
          // Skip identical mark (their own registration)
          if (parsed.serialNumber === mark.registration_number) continue;

          // AI analysis
          const ai = await analyzeWithClaude(
            mark.mark_text,
            mark.goods_services || "",
            parsed.markText,
            parsed.goodsServices,
            parsed.applicant
          );

          const finding = {
            mark_id: mark.id,
            serial_number: parsed.serialNumber,
            applicant_name: parsed.applicant || null,
            mark_text: parsed.markText || null,
            goods_services: parsed.goodsServices || null,
            filing_date: parsed.filingDate || null,
            similarity_score: ai.score,
            recommendation: ai.recommendation,
            ai_analysis: ai.analysis,
            reported_at: null,
          };

          // Upsert to avoid race conditions
          const { error: insertErr } = await (sb.from as any)("trademark_watch_findings")
            .upsert(finding, { onConflict: "mark_id,serial_number", ignoreDuplicates: true });

          if (!insertErr) {
            newFindings.push(finding);
            totalNew++;
          }
        }

        // Update last_scanned_at
        await (sb.from as any)("trademark_watch_marks")
          .update({ last_scanned_at: new Date().toISOString() })
          .eq("id", mark.id);

        // Build and send weekly digest
        if (RESEND_API_KEY && client.customer_email) {
          // Fetch all unreported findings for this mark (score >= 40)
          const { data: allFindings } = await (sb.from as any)("trademark_watch_findings")
            .select("*")
            .eq("mark_id", mark.id)
            .is("reported_at", null)
            .order("similarity_score", { ascending: false });

          const reportFindings = (allFindings || []).filter((f: any) => f.similarity_score >= 40);

          // Send digest (even if empty — weekly touchpoint)
          const digestFindings = allFindings || [];
          const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.customer_email],
              bcc: ["matthewmichels4@gmail.com"],
              subject: `Trademark Watch Report for "${mark.mark_text}" — ${dateStr}`,
              html: tmEmail({
                greeting: `Hey${client.customer_name ? " " + client.customer_name : ""} —`,
                headline: `Trademark Watch Report for "${mark.mark_text}"`,
                body: buildDigestBody(mark.mark_text, digestFindings),
                cta: {
                  text: "View Full Dashboard",
                  url: "https://www.mattmichelstraining.com/trademark-watch/dashboard",
                },
              }),
            }),
          });

          // Mark reported
          if (digestFindings.length > 0) {
            const reportedIds = digestFindings.map((f: any) => f.id);
            await (sb.from as any)("trademark_watch_findings")
              .update({ reported_at: new Date().toISOString() })
              .in("id", reportedIds);
          }

          // Alert Matt if there are high-priority findings
          const opposeCount = digestFindings.filter((f: any) => f.recommendation === "oppose").length;
          if (opposeCount > 0) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"],
                bcc: ["matthewmichels4@gmail.com"],
                subject: `⚠️ Trademark Opposition Alert — "${mark.mark_text}" for ${client.company_name || client.customer_email}`,
                html: `<p><strong>${opposeCount} mark(s) flagged for opposition</strong> for client ${client.company_name || client.customer_email} (${client.customer_email}).<br>Watched mark: <strong>${mark.mark_text}</strong><br>Report sent to client.</p>`,
              }),
            });
          }
        }
      }
    }

    console.log(`[TMW-SCAN] Done. Clients: ${clients.length}, Hits scanned: ${totalScanned}, New findings: ${totalNew}`);

    return new Response(JSON.stringify({ ok: true, clients: clients.length, scanned: totalScanned, new_findings: totalNew }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TMW-SCAN] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
