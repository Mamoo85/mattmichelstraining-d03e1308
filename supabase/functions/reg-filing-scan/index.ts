import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function naicsToTerms(naics: string): string[] {
  const p = naics.substring(0, 3);
  const map: Record<string, string[]> = {
    "311": ["food processing EPA", "food safety OSHA"],
    "312": ["beverage manufacturing EPA", "brewery wastewater"],
    "313": ["textile manufacturing EPA", "textile wastewater discharge"],
    "321": ["wood products EPA", "sawmill air emissions"],
    "322": ["paper manufacturing EPA", "pulp mill discharge"],
    "324": ["petroleum refining EPA", "refinery emissions"],
    "325": ["chemical manufacturing EPA", "chemical plant discharge"],
    "326": ["plastics manufacturing EPA", "rubber processing emissions"],
    "327": ["glass ceramics EPA", "concrete batch plant"],
    "331": ["primary metals EPA", "steel mill emissions"],
    "332": ["fabricated metal EPA", "metal finishing wastewater"],
    "333": ["machinery manufacturing OSHA", "machine shop EPA"],
    "334": ["electronics manufacturing EPA", "semiconductor waste"],
    "335": ["electrical equipment EPA", "transformer PCB"],
    "336": ["automotive manufacturing EPA", "vehicle assembly emissions"],
    "337": ["furniture manufacturing EPA", "wood finishing VOC"],
    "339": ["medical device manufacturing EPA", "pharmaceutical waste"],
  };
  return map[p] || [`${p} manufacturing EPA regulation`];
}

const stateEpaUrls: Record<string, string> = {
  MI: "https://www.michigan.gov/egle",
  OH: "https://epa.ohio.gov",
  IL: "https://epa.illinois.gov",
  IN: "https://www.in.gov/idem",
  PA: "https://www.dep.pa.gov",
  TX: "https://www.tceq.texas.gov",
  CA: "https://www.dtsc.ca.gov",
};

async function aiSummarize(text: string, clientState: string): Promise<any> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: `You are a regulatory compliance analyst. Summarize this regulation for a ${clientState} manufacturer. Return JSON: {"title":"string","agency":"string","impact_level":"critical|high|medium|low","action_required":true/false,"deadline":"YYYY-MM-DD or null","summary":"string","draft_filing_needed":true/false}\n\nRegulation:\n${text.substring(0, 3000)}`,
        }],
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch { return null; }
}

async function fetchFederalRegister(terms: string[]): Promise<any[]> {
  const results: any[] = [];
  for (const term of terms.slice(0, 3)) {
    try {
      const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(term)}&per_page=10&order=newest`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const doc of (data.results || [])) {
        results.push({
          source_url: doc.html_url || doc.document_number,
          source_type: "federal_register",
          raw_title: doc.title,
          raw_text: `${doc.title}. ${doc.abstract || ""}. Agency: ${doc.agencies?.map((a: any) => a.name).join(", ") || "Unknown"}. Published: ${doc.publication_date}`,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

async function scrapeStateEpa(state: string, terms: string[]): Promise<any[]> {
  const baseUrl = stateEpaUrls[state];
  if (!baseUrl || !FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      body: JSON.stringify({ url: baseUrl, formats: ["markdown"] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const md = data.data?.markdown || "";
    if (md.length < 100) return [];
    return [{ source_url: baseUrl, source_type: "state_epa", raw_title: `${state} EPA Updates`, raw_text: md.substring(0, 4000) }];
  } catch { return []; }
}

async function processClient(client: any): Promise<{ items: number; criticals: number }> {
  const naicsCodes: string[] = client.naics_codes || [];
  const allTerms = naicsCodes.flatMap(naicsToTerms);
  const states = [client.state, ...(client.additional_states || [])].filter(Boolean);

  const [fedResults, ...stateResults] = await Promise.all([
    fetchFederalRegister(allTerms),
    ...states.map((s: string) => scrapeStateEpa(s, allTerms)),
  ]);

  const allResults = [...fedResults, ...stateResults.flat()];
  let itemCount = 0;
  let criticalCount = 0;
  const digestItems: any[] = [];

  for (const result of allResults) {
    const analysis = await aiSummarize(result.raw_text, client.state);
    if (!analysis) continue;

    const { error } = await supabase.from("reg_filing_items").upsert({
      client_id: client.id,
      source_url: result.source_url,
      source_type: result.source_type,
      title: analysis.title || result.raw_title,
      agency: analysis.agency || "Unknown",
      impact_level: analysis.impact_level || "low",
      action_required: analysis.action_required || false,
      deadline: analysis.deadline || null,
      summary: analysis.summary || "",
    }, { onConflict: "client_id,source_url", ignoreDuplicates: true });

    if (!error) {
      itemCount++;
      digestItems.push(analysis);

      if (["critical", "high"].includes(analysis.impact_level) && analysis.action_required && analysis.draft_filing_needed) {
        const draftRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "anthropic/claude-sonnet-4-6",
            max_tokens: 1200,
            response_format: { type: "json_object" },
            messages: [{
              role: "user",
              content: `Draft a compliance filing response for ${client.company_name} regarding: ${analysis.title}. Summary: ${analysis.summary}. Deadline: ${analysis.deadline || "TBD"}. Return JSON: {"filing_type":"string","draft_html":"<html string>"}`,
            }],
          }),
        });
        try {
          const draftData = await draftRes.json();
          const draft = JSON.parse(draftData.choices?.[0]?.message?.content || "{}");
          if (draft.draft_html) {
            await supabase.from("reg_filing_drafts").insert({
              client_id: client.id,
              item_id: null,
              filing_type: draft.filing_type || "compliance_response",
              draft_html: draft.draft_html,
              status: "pending_approval",
            });
          }
        } catch { /* skip */ }
      }

      if (analysis.deadline) {
        await supabase.from("reg_filing_deadlines").upsert({
          client_id: client.id,
          item_id: null,
          title: analysis.title,
          due_date: analysis.deadline,
          status: "upcoming",
        }, { onConflict: "client_id,title", ignoreDuplicates: true });
      }

      if (analysis.impact_level === "critical") criticalCount++;
    }
  }

  if (digestItems.length > 0 && client.email) {
    const itemsHtml = digestItems.map((i: any) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.title}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0"><span style="color:${i.impact_level === "critical" ? "#dc2626" : i.impact_level === "high" ? "#f59e0b" : "#10b981"}">${i.impact_level.toUpperCase()}</span></td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.deadline || "—"}</td></tr>`
    ).join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "M² System <matt@mattmichelstraining.com>",
        to: [client.email],
        subject: `Regulatory Filing Monitor — ${digestItems.length} new finding${digestItems.length > 1 ? "s" : ""}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">Regulatory Scan Report</h2><p>Hi ${client.company_name},</p><p>We found <strong>${digestItems.length}</strong> new regulatory items for your review.</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Title</th><th style="padding:8px;text-align:left">Impact</th><th style="padding:8px;text-align:left">Deadline</th></tr></thead><tbody>${itemsHtml}</tbody></table><p style="margin-top:16px;color:#64748b;font-size:13px">M² Performance Training — Regulatory Filing Monitor</p></div>`,
      }),
    });
  }

  if (criticalCount > 0 && client.phone) {
    await sendSMS(client.phone, TWILIO_PHONE, `${criticalCount} critical regulatory finding${criticalCount > 1 ? "s" : ""} need your attention. Details in your email. — Matt (313) 992-1219`, "reg_filing_monitor");
  }

  await supabase.from("reg_filing_clients").update({ last_scan_at: new Date().toISOString() }).eq("id", client.id);
  return { items: itemCount, criticals: criticalCount };
}

async function deadlineCheck(): Promise<string> {
  const { data: deadlines } = await supabase
    .from("reg_filing_deadlines")
    .select("*, reg_filing_clients!inner(email, phone, company_name)")
    .eq("status", "upcoming")
    .gte("due_date", new Date().toISOString().split("T")[0]);

  let reminded = 0;
  for (const dl of deadlines || []) {
    const daysUntil = Math.ceil((new Date(dl.due_date).getTime() - Date.now()) / 86400000);
    const reminders: number[] = dl.reminder_days || [30, 14, 7, 3, 1];
    if (!reminders.includes(daysUntil)) continue;

    const client = dl.reg_filing_clients;
    if (client?.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `Deadline Reminder: ${dl.title} — ${daysUntil} day${daysUntil !== 1 ? "s" : ""} remaining`,
          html: `<div style="font-family:sans-serif"><h2 style="color:#e8621a">Filing Deadline Reminder</h2><p><strong>${dl.title}</strong> is due in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong> (${dl.due_date}).</p><p>Please review and take action.</p><p style="color:#64748b;font-size:13px">M² Regulatory Filing Monitor</p></div>`,
        }),
      });
    }

    if (daysUntil <= 3 && client?.phone) {
      await sendSMS(client.phone, TWILIO_PHONE, `Heads up: "${dl.title}" is due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}. Check your email. — Matt (313) 992-1219`, "reg_filing_monitor");
    }

    await supabase.from("reg_filing_deadlines").update({ last_reminded: new Date().toISOString() }).eq("id", dl.id);
    reminded++;
  }
  return `Deadline check complete: ${reminded} reminders sent`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let mode = "scan";
    try { const body = await req.json(); mode = body?.mode || "scan"; } catch { /* default scan */ }

    if (mode === "deadline_check") {
      const result = await deadlineCheck();
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: clients } = await supabase
      .from("reg_filing_clients")
      .select("*")
      .eq("active", true)
      .eq("subscription_status", "active");

    if (!clients?.length) {
      return new Response(JSON.stringify({ success: true, message: "No active clients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    for (const client of clients) {
      const r = await processClient(client);
      results.push({ client_id: client.id, company: client.company_name, ...r });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
