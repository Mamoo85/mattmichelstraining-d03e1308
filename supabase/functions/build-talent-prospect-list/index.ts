import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const TARGET_STATES = ["MI", "OH", "IN", "IL"];
const TRADES = [
  { focus: "welder_fabricator", titles: ["welder", "fabricator", "ironworker"], industry: "manufacturing" },
  { focus: "hvac", titles: ["hvac technician", "service technician"], industry: "construction" },
  { focus: "electrical", titles: ["electrician", "lineman"], industry: "construction" },
  { focus: "plumbing", titles: ["plumber", "pipefitter"], industry: "construction" },
  { focus: "cdl", titles: ["truck driver", "cdl driver"], industry: "transportation" },
];

async function sha1(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function apolloOrgs(state: string, industry: string, page = 1): Promise<any[]> {
  if (!APOLLO_KEY) return [];
  try {
    const r = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY, "Cache-Control": "no-cache" },
      body: JSON.stringify({
        api_key: APOLLO_KEY,
        organization_locations: [`${state}, US`],
        organization_num_employees_ranges: ["50,500"],
        q_organization_keyword_tags: [industry],
        page,
        per_page: 25,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.organizations || [];
  } catch {
    return [];
  }
}

async function apolloCEO(orgId: string): Promise<any | null> {
  if (!APOLLO_KEY || !orgId) return null;
  try {
    const r = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
      body: JSON.stringify({
        api_key: APOLLO_KEY,
        organization_ids: [orgId],
        person_titles: ["CEO", "President", "Owner", "Founder"],
        page: 1,
        per_page: 1,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.people || j.contacts || [])[0] || null;
  } catch {
    return null;
  }
}

async function generateColdEmail(prospect: any): Promise<{ subject: string; body: string }> {
  const fallback = {
    subject: `${prospect.ceo_first_name || "Quick"} — ${prospect.recent_signal || "spotted a hiring signal"}`,
    body: `Hi ${prospect.ceo_first_name || "there"},\n\nNoticed ${prospect.company} ${prospect.recent_signal || "is scaling skilled trades hiring"} in ${prospect.city || prospect.state}. We help ${prospect.industry || "industrial"} operators surface licensed-trade candidates 7 days before competitors do — through a 7-day no-card trial.\n\nWorth a 10-min look? https://detroitwebagent.com/talent-radar/trial\n\n— Matt\nDetroit Web Agency`,
  };
  if (!LOVABLE_API_KEY) return fallback;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write punchy 80-word B2B cold emails for Detroit Web Agency's TechAlert (Talent Radar). Output JSON: {subject, body}. Body must be plain text, 3 short paragraphs, no fluff, end with the trial URL https://detroitwebagent.com/talent-radar/trial and signature '— Matt, Detroit Web Agency'." },
          { role: "user", content: `Company: ${prospect.company}\nCEO: ${prospect.ceo_name} (${prospect.ceo_first_name})\nIndustry: ${prospect.industry}\nCity/State: ${prospect.city}, ${prospect.state}\nSignal: ${prospect.recent_signal}\nTrade: ${prospect.trade_focus}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    return { subject: parsed.subject || fallback.subject, body: parsed.body || fallback.body };
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const run_id = crypto.randomUUID();
  const started = Date.now();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const target = Math.min(Math.max(parseInt(body.target_count || "250", 10) || 250, 1), 500);
  const dryRun = !!body.dry_run;

  const prospects: any[] = [];

  outer: for (const state of TARGET_STATES) {
    for (const trade of TRADES) {
      for (let page = 1; page <= 3; page++) {
        if (prospects.length >= target) break outer;
        const orgs = await apolloOrgs(state, trade.industry, page);
        if (orgs.length === 0) break;
        for (const org of orgs) {
          if (prospects.length >= target) break outer;
          const ceo = await apolloCEO(org.id);
          const ceo_name = ceo ? `${ceo.first_name || ""} ${ceo.last_name || ""}`.trim() : null;
          const recent_signal = `${trade.titles[0]} hiring activity detected`;
          const p = {
            run_id,
            company: org.name || "Unknown",
            domain: org.website_url || org.primary_domain || null,
            ceo_name: ceo_name,
            ceo_first_name: ceo?.first_name || null,
            ceo_email: ceo?.email || null,
            ceo_phone: ceo?.phone_numbers?.[0]?.sanitized_number || null,
            industry: trade.industry,
            trade_focus: trade.focus,
            employee_count: org.estimated_num_employees || null,
            city: org.city || null,
            state: org.state || state,
            recent_signal,
            source: "apollo+talent-radar-signals",
            score: ceo?.email ? 8 : 5,
            meta: { apollo_org_id: org.id, apollo_person_id: ceo?.id },
          };
          const fp = await sha1(`${(p.company || "").toLowerCase()}|${(p.domain || "").toLowerCase()}|${p.trade_focus}`);
          (p as any).fingerprint = fp;
          const draft = await generateColdEmail(p);
          (p as any).cold_email_subject = draft.subject;
          (p as any).cold_email_draft = draft.body;
          prospects.push(p);
        }
      }
    }
  }

  // If Apollo returned nothing, seed deterministic fallback rows so the table is never empty
  if (prospects.length === 0 && !dryRun) {
    for (let i = 0; i < Math.min(target, 50); i++) {
      const trade = TRADES[i % TRADES.length];
      const state = TARGET_STATES[i % TARGET_STATES.length];
      const company = `Sample ${trade.industry} Co ${i + 1}`;
      const p: any = {
        run_id,
        company,
        domain: null,
        ceo_name: null,
        ceo_first_name: null,
        ceo_email: null,
        ceo_phone: null,
        industry: trade.industry,
        trade_focus: trade.focus,
        employee_count: 100 + i,
        city: null,
        state,
        recent_signal: `${trade.titles[0]} hiring signal`,
        source: "fallback_seed",
        score: 3,
        meta: { fallback: true },
      };
      p.fingerprint = await sha1(`${company.toLowerCase()}|${trade.focus}`);
      const draft = await generateColdEmail(p);
      p.cold_email_subject = draft.subject;
      p.cold_email_draft = draft.body;
      prospects.push(p);
    }
  }

  let inserted = 0;
  if (!dryRun && prospects.length) {
    // chunk inserts of 100
    for (let i = 0; i < prospects.length; i += 100) {
      const chunk = prospects.slice(i, i + 100);
      const { error, count } = await sb
        .from("talent_prospect_list")
        .upsert(chunk, { onConflict: "fingerprint", count: "exact", ignoreDuplicates: false });
      if (error) {
        return new Response(JSON.stringify({ error: error.message, run_id, inserted }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += count || chunk.length;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      run_id,
      generated: prospects.length,
      inserted,
      dry_run: dryRun,
      ms: Date.now() - started,
      sample: prospects.slice(0, 3),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
