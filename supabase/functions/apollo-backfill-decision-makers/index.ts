// apollo-backfill-decision-makers
// One-shot (or repeatable) backfill: populate decision_makers JSONB on
// industry_pulse_signals rows that have no contacts yet.
//
// Apollo's mixed_people/search is the engine. We dedupe by company_name so
// we only spend one credit per unique company even if it has many signals.
//
// Trigger: POST /functions/v1/apollo-backfill-decision-makers
//   Body (optional): { "limit": 50, "min_confidence": 6, "dry_run": false }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DecisionMaker = {
  name: string;
  title: string;
  email: string;
  email_status?: string;
  linkedin_url?: string;
  seniority?: string;
};

async function findDecisionMakers(companyName: string): Promise<{
  contacts: DecisionMaker[];
  status: number;
  error?: string;
}> {
  if (!APOLLO_API_KEY || !companyName) {
    return { contacts: [], status: 0, error: "missing api key or company" };
  }
  try {
    const body = {
      organization_name: companyName,
      person_titles: [
        "owner", "president", "ceo", "coo", "cfo",
        "general manager", "operations manager", "plant manager",
        "vp operations", "vp of operations", "director of operations",
        "hr director", "human resources", "hr manager",
        "purchasing manager", "procurement manager", "facilities manager",
      ],
      page: 1,
      per_page: 5,
    };
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { contacts: [], status: res.status, error: txt.slice(0, 200) };
    }
    const data = await res.json();
    const people = (data?.people || []) as any[];
    const contacts = people.slice(0, 3).map((p) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: p.title || "",
      email: p.email || "",
      email_status: p.email_status || undefined,
      linkedin_url: p.linkedin_url || undefined,
      seniority: p.seniority || undefined,
    })).filter((p) => p.name);
    return { contacts, status: res.status };
  } catch (e) {
    return { contacts: [], status: -1, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* GET / empty body */ }
  const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 200);
  const minConf = Number(body.min_confidence ?? 6);
  const dryRun = body.dry_run === true;

  if (!APOLLO_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "APOLLO_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pull candidates: high-confidence signals missing decision-makers
  const { data: signals, error: selErr } = await sb
    .from("industry_pulse_signals")
    .select("id, company_name, confidence, vertical, location")
    .gte("confidence", minConf)
    .or("decision_makers.is.null,decision_makers.eq.[]")
    .not("company_name", "is", null)
    .order("confidence", { ascending: false })
    .limit(500);

  if (selErr) {
    return new Response(JSON.stringify({ ok: false, error: selErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dedupe by company_name → enrich each unique company once, then update all rows
  const byCompany = new Map<string, { ids: string[]; sample: any }>();
  for (const s of signals || []) {
    const key = (s.company_name || "").trim().toLowerCase();
    if (!key) continue;
    if (!byCompany.has(key)) byCompany.set(key, { ids: [], sample: s });
    byCompany.get(key)!.ids.push(s.id);
  }

  const uniqueCompanies = Array.from(byCompany.entries()).slice(0, limit);
  const results: any[] = [];
  let totalContacts = 0, hits = 0, misses = 0, errors = 0;

  for (const [key, { ids, sample }] of uniqueCompanies) {
    if (dryRun) {
      results.push({ company: sample.company_name, signals: ids.length, dry_run: true });
      continue;
    }

    const { contacts, status, error } = await findDecisionMakers(sample.company_name);

    if (status === 403 || status === 401) {
      errors++;
      results.push({ company: sample.company_name, status, error: "forbidden — check Apollo plan/key" });
      // Don't keep hammering on auth failures
      break;
    }
    if (status >= 400 || status < 0) {
      errors++;
      results.push({ company: sample.company_name, status, error });
      continue;
    }

    if (contacts.length === 0) {
      misses++;
      results.push({ company: sample.company_name, contacts: 0 });
    } else {
      hits++;
      totalContacts += contacts.length;
      // Update every signal row for this company
      const { error: upErr } = await sb
        .from("industry_pulse_signals")
        .update({
          decision_makers: contacts,
          decision_makers_enriched_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (upErr) {
        errors++;
        results.push({ company: sample.company_name, error: `update failed: ${upErr.message}` });
      } else {
        results.push({
          company: sample.company_name,
          signals_updated: ids.length,
          contacts: contacts.length,
          top_contact: contacts[0]?.name + " — " + contacts[0]?.title,
        });
      }
    }

    // Gentle pacing — Apollo allows ~60 req/min on paid plans
    await new Promise((r) => setTimeout(r, 350));
  }

  return new Response(JSON.stringify({
    ok: true,
    summary: {
      candidates_in_db: (signals || []).length,
      unique_companies: byCompany.size,
      processed: uniqueCompanies.length,
      hits,
      misses,
      errors,
      total_contacts_added: totalContacts,
      dry_run: dryRun,
    },
    results,
  }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
