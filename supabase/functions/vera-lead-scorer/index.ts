// Vera — Lead Qualifier. Scores today's new leads 1-10 using Lovable AI.
// Runs on-demand from /dwa-admin → Agent Toolkit.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Lead {
  id: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  city?: string | null;
  notes?: string | null;
  website?: string | null;
}

async function scoreLead(lead: Lead): Promise<{ score: number; reason: string }> {
  if (!LOVABLE_API_KEY) {
    // Heuristic fallback when AI unavailable
    let score = 5;
    if (lead.email) score += 1;
    if (lead.phone) score += 1;
    if (lead.website) score += 1;
    if (lead.notes && lead.notes.length > 30) score += 1;
    return { score: Math.min(10, score), reason: "Heuristic score (AI unavailable)" };
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `Score this B2B lead 1-10 for likelihood of buying website + automation services. Reply ONLY in JSON: {"score": N, "reason": "..."}. Lead: ${JSON.stringify(lead)}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return { score: Math.max(1, Math.min(10, Number(parsed.score) || 5)), reason: String(parsed.reason || "") };
    }
  } catch (e) {
    console.error("[vera] AI scoring failed:", e);
  }
  return { score: 5, reason: "Default score (AI parse failed)" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Pull recent leads from web_design_leads + b2b_clients
  const [{ data: webLeads }, { data: b2b }] = await Promise.all([
    sb.from("web_design_leads").select("id, business_name, email, phone, industry, city, notes, website").gte("created_at", since).limit(20),
    sb.from("b2b_clients").select("id, business_name, email, phone, industry, city, notes, website").gte("created_at", since).limit(20),
  ]);

  const leads: Lead[] = [...(webLeads || []), ...(b2b || [])];
  if (leads.length === 0) {
    return new Response(JSON.stringify({ ok: true, scored: 0, message: "No new leads in last 24h" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const scored = await Promise.all(leads.map(async (l) => {
    const { score, reason } = await scoreLead(l);
    return { lead_id: l.id, business: l.business_name || "Unknown", score, reason };
  }));

  // Log to ai_action_queue so AdminBoardReport sees it
  await sb.from("ai_action_queue").insert(scored.map((s) => ({
    action_type: "vera_lead_score",
    status: "pending",
    ai_result: `${s.business}: ${s.score}/10 — ${s.reason}`,
    context: { lead_id: s.lead_id, score: s.score },
  })));

  // Heartbeat
  await sb.from("agent_heartbeats").upsert({
    agent_name: "vera",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { scored: scored.length },
  }, { onConflict: "agent_name" });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, 5);

  return new Response(JSON.stringify({
    ok: true,
    scored: scored.length,
    count: scored.length,
    top_leads: top,
    result_summary: `Scored ${scored.length} leads. Top: ${top.map(t => `${t.business}(${t.score})`).join(", ")}`,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
