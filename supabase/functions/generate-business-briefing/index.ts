import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const [
      contractorClients,
      hireAlertClients,
      fieldCrmClients,
      missedCallClients,
      industryPulseClients,
      contractorLeads,
      contractorLeadSites,
      hireAlertCandidates,
      deadLeadCampaigns,
      activeContractors,
    ] = await Promise.all([
      safeCount("contractor_clients"),
      safeCount("hire_alert_clients"),
      safeCount("field_crm_clients"),
      safeCount("missed_call_clients"),
      safeCount("industry_pulse_clients"),
      safeCount("contractor_leads"),
      safeCount("contractor_lead_sites"),
      safeCount("hire_alert_candidates"),
      safeCount("dead_lead_campaigns"),
      safeCount("contractor_clients", (q) => q.eq("active", true)),
    ]);

    const stats = {
      contractor_clients_total: contractorClients,
      contractor_clients_active: activeContractors,
      hire_alert_clients: hireAlertClients,
      field_crm_clients: fieldCrmClients,
      missed_call_clients: missedCallClients,
      industry_pulse_clients: industryPulseClients,
      contractor_leads_lifetime: contractorLeads,
      territories_open: contractorLeadSites,
      candidates_surfaced: hireAlertCandidates,
      dead_lead_campaigns: deadLeadCampaigns,
    };

    // Estimated MRR
    const mrr =
      activeContractors * 399 +
      hireAlertClients * 149 +
      fieldCrmClients * 199 +
      missedCallClients * 99 +
      industryPulseClients * 149;

    const businessContext = `
Owner: Matt Michels — Grosse Pointe, MI
Brands: Detroit Web Agency (B2B SaaS) + Matt Michels Training (fitness)
Stack: React 18 + Vite + Tailwind + Supabase Edge Functions + Stripe + Resend + Twilio
Codebase: ~311 pages, ~598 edge functions, ~461 migrations, 31 AI agents, 67+ products

Live products + pricing:
- Contractor Leads (PPL marketplace) — $399/mo territory lock, $50/lead
- TechAlert (HireRadar) — $149/mo MIOSHA license + job board monitor
- FieldDesk — $199/mo field service CRM (replaces eWay/FieldServio)
- Missed Call Catch — $99/mo Twilio text-back
- Demand Radar (Industry Pulse) — $149/mo wholesale distributor signals
- Dead Lead Reactivation — $50 per positive reply, contractor self-serve
- 60+ smaller SMS/monitoring products ($19–$59/mo each)

Live stats:
${JSON.stringify(stats, null, 2)}

Estimated MRR (active subscriptions × list price): $${mrr.toLocaleString()}/mo

Goal: $10k+/mo fully automated. Matt only returns calls/texts/emails. Everything else autonomous.
`.trim();

    const systemPrompt = `You are a senior strategy analyst writing a Gemini Deep Think briefing packet for a solo founder. Output is Markdown only — no preamble, no closing remarks. Use the EXACT 8-section structure below. Be specific, data-driven, and brutal where warranted. No corporate fluff.

# 1. Business Snapshot
# 2. Revenue Map (current + projected)
# 3. Competitive Position
# 4. Top 3 Growth Levers (next 90 days)
# 5. Top 3 Risks
# 6. Resource Allocation Recommendation
# 7. Open Questions for Deep Think
# 8. Action Plan (week-by-week, 4 weeks)`;

    const userPrompt = `Generate the briefing packet using this live business context:\n\n${businessContext}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit — try again in a minute." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Lovable AI credits exhausted — top up in Settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const markdown = aiData.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ markdown, stats, mrr, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("briefing error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
