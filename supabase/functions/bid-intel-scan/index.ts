import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function searchSamGov(trade: string, territory: string): Promise<any[]> {
  if (!SAM_GOV_API_KEY) return [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  try {
    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&keyword=${encodeURIComponent(trade)}&postedFrom=${thirtyDaysAgo}&limit=20`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.opportunitiesData || []).map((opp: any) => ({
      source_url: `https://sam.gov/opp/${opp.noticeId}`,
      source_name: "SAM.gov",
      title: opp.title || "Untitled",
      description: opp.description?.substring(0, 2000) || "",
      bid_due_date: opp.responseDeadLine || null,
      estimated_value: opp.award?.amount || null,
      location: opp.placeOfPerformance?.state?.code || territory,
    }));
  } catch { return []; }
}

async function scrapeBidBoards(trade: string, territory: string): Promise<any[]> {
  if (!FIRECRAWL_API_KEY) return [];
  const results: any[] = [];
  const queries = [
    `${trade} subcontractor bid ${territory}`,
    `${trade} construction bid invitation ${territory}`,
  ];
  for (const query of queries) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url: `https://www.bidnet.com/bids-search?query=${encodeURIComponent(query)}`, formats: ["markdown"] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const md = data.data?.markdown || "";
      if (md.length > 100) {
        results.push({
          source_url: `https://www.bidnet.com/bids-search?query=${encodeURIComponent(query)}`,
          source_name: "BidNet",
          title: `BidNet: ${trade} opportunities in ${territory}`,
          description: md.substring(0, 3000),
          bid_due_date: null,
          estimated_value: null,
          location: territory,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

async function aiScoreOpportunity(opp: any, trade: string, territory: string): Promise<any> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Score this bid opportunity 0-100 for a ${trade} subcontractor in ${territory}. Factors: trade match (40pts), location proximity (30pts), project size fit (15pts), timeline feasibility (15pts). Return JSON only: {"fit_score":number,"trade_match":"string","reasoning":"string","title":"string","estimated_value":"string or null"}\n\nOpportunity:\nTitle: ${opp.title}\nDescription: ${opp.description?.substring(0, 2000)}\nLocation: ${opp.location}\nDue: ${opp.bid_due_date || "Unknown"}\nValue: ${opp.estimated_value || "Unknown"}`,
        }],
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch { return { fit_score: 0 }; }
}

async function generateProposal(client: any, opp: any, score: any): Promise<any> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: `Generate a professional bid proposal draft for ${client.company_name}, a ${client.trade} subcontractor. Opportunity: ${opp.title}. ${opp.description?.substring(0, 1000)}. Use these historical rates: ${JSON.stringify(client.historical_pricing || {})}. Return JSON only: {"proposal_html":"<html string>","estimated_total":"dollar amount string"}`,
        }],
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch { return null; }
}

async function processClient(client: any): Promise<{ opportunities: number; proposals: number; urgentBids: number }> {
  const [samResults, bidResults] = await Promise.all([
    searchSamGov(client.trade, client.service_territory),
    scrapeBidBoards(client.trade, client.service_territory),
  ]);

  const allOpps = [...samResults, ...bidResults];
  let oppCount = 0;
  let proposalCount = 0;
  let urgentCount = 0;
  const digestItems: any[] = [];

  for (const opp of allOpps) {
    const score = await aiScoreOpportunity(opp, client.trade, client.service_territory);
    const fitScore = score.fit_score || 0;

    const { error } = await supabase.from("bid_intel_opportunities").upsert({
      client_id: client.id,
      source_url: opp.source_url,
      source_name: opp.source_name,
      title: score.title || opp.title,
      description: opp.description?.substring(0, 5000),
      trade_match: score.trade_match || client.trade,
      bid_due_date: opp.bid_due_date || null,
      estimated_value: score.estimated_value || opp.estimated_value?.toString() || null,
      fit_score: fitScore,
      location: opp.location,
    }, { onConflict: "client_id,source_url", ignoreDuplicates: true });

    if (!error) {
      oppCount++;
      digestItems.push({ ...score, title: score.title || opp.title, due: opp.bid_due_date, source: opp.source_name });

      if (fitScore >= 70) {
        const proposal = await generateProposal(client, opp, score);
        if (proposal?.proposal_html) {
          await supabase.from("bid_intel_proposals").insert({
            client_id: client.id,
            opportunity_id: null,
            proposal_html: proposal.proposal_html,
            estimated_total: proposal.estimated_total || "TBD",
            status: "pending_approval",
          });
          proposalCount++;
        }
      }

      if (opp.bid_due_date) {
        const daysUntil = Math.ceil((new Date(opp.bid_due_date).getTime() - Date.now()) / 86400000);
        if (daysUntil <= 3 && daysUntil >= 0) urgentCount++;
      }
    }
  }

  if (digestItems.length > 0 && client.email) {
    const rowsHtml = digestItems.map((i: any) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.title}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center"><strong>${i.fit_score}</strong>/100</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.due || "—"}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.source}</td></tr>`
    ).join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "M² System <matt@mattmichelstraining.com>",
        to: [client.email],
        subject: `Bid Intelligence — ${digestItems.length} opportunit${digestItems.length > 1 ? "ies" : "y"} found`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">Daily Bid Report</h2><p>Hi ${client.company_name},</p><p>We found <strong>${digestItems.length}</strong> bid opportunities matching your trade (${client.trade}).${proposalCount > 0 ? ` <strong>${proposalCount}</strong> auto-generated proposal draft${proposalCount > 1 ? "s" : ""} ready for your review.` : ""}</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Opportunity</th><th style="padding:8px;text-align:center">Fit</th><th style="padding:8px;text-align:left">Due</th><th style="padding:8px;text-align:left">Source</th></tr></thead><tbody>${rowsHtml}</tbody></table><p style="margin-top:16px;color:#64748b;font-size:13px">M² Performance Training — Bid Intelligence</p></div>`,
      }),
    });
  }

  if (urgentCount > 0 && client.phone) {
    await sendSMS(client.phone, TWILIO_PHONE, `BID ALERT: ${urgentCount} bid(s) due within 72 hours. Check your email for details. — M² Bid Intelligence`, "bid_intel_monitor");
  }

  await supabase.from("bid_intel_clients").update({ last_scan_at: new Date().toISOString() }).eq("id", client.id);
  return { opportunities: oppCount, proposals: proposalCount, urgentBids: urgentCount };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { data: clients } = await supabase
      .from("bid_intel_clients")
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
