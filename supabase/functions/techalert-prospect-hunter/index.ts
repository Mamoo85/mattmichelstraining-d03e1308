// techalert-prospect-hunter — daily 6am ET cron
// Finds HVAC/boiler/plumbing/electrical shops in Metro Detroit actively
// hiring techs on job boards. These are perfect TechAlert prospects.
//
// CRITICAL: Outputs (cold emails, postcards, Matt-facing copy) MUST NEVER
// reveal that we monitor licensing databases, scrape job boards, or use
// any third-party intelligence vendor. We are "a Detroit-area hiring
// monitoring service." Period.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = [
  { key: "hvac_tech", q: "HVAC technician", boiler: false },
  { key: "boiler_operator", q: "boiler operator OR stationary engineer", boiler: true },
  { key: "plumber", q: "plumber OR pipefitter", boiler: false },
  { key: "electrician", q: "electrician OR industrial electrician", boiler: false },
];

const METRO_QUERY = "Metro Detroit OR Detroit OR Warren OR Sterling Heights OR Livonia OR Dearborn OR Troy OR Southfield Michigan";

interface Posting {
  company_name: string;
  city?: string;
  role: string;
  days_posted?: number;
  source_url?: string;
  source_label?: string;
  is_boiler: boolean;
}

async function sonarSearch(role: typeof ROLES[number]): Promise<Posting[]> {
  if (!OPENROUTER_API_KEY) return [];
  const prompt = `Find ACTIVE job postings on Indeed, ZipRecruiter, SimplyHired, and LinkedIn Jobs for "${role.q}" in ${METRO_QUERY}. Return ONLY a JSON array, no prose. Each item: {"company_name": "string", "city": "string", "days_posted": number_estimate_or_null, "source_url": "url", "source_label": "Indeed|ZipRecruiter|SimplyHired|LinkedIn"}. Find at least 12 distinct companies. Skip staffing agencies, temp agencies, recruiters. Only direct employers (HVAC contractors, plumbing companies, electrical contractors, mechanical contractors, manufacturers).`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error(`[hunter] sonar ${role.key} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return (Array.isArray(arr) ? arr : [])
      .filter((x: any) => x?.company_name)
      .map((x: any) => ({
        company_name: String(x.company_name).trim(),
        city: x.city ? String(x.city).trim() : undefined,
        role: role.key,
        days_posted: typeof x.days_posted === "number" ? x.days_posted : null,
        source_url: x.source_url || undefined,
        source_label: x.source_label || undefined,
        is_boiler: role.boiler,
      } as Posting));
  } catch (e) {
    console.error(`[hunter] sonar ${role.key} error:`, e instanceof Error ? e.message : e);
    return [];
  }
}

function scorePosting(p: Posting, openRolesCount: number, repostCount: number): number {
  let score = 0;
  if ((p.days_posted ?? 0) > 14) score += 3;
  if (repostCount > 0) score += 2;
  if (openRolesCount >= 2) score += 2;
  if (p.is_boiler) score += 1;
  return Math.max(1, score);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0, updated = 0, scanned = 0;

  try {
    const all: Posting[] = [];
    for (const role of ROLES) {
      const found = await sonarSearch(role);
      all.push(...found);
      scanned += found.length;
    }

    // Group by company to compute open_roles_count
    const byCompany = new Map<string, Posting[]>();
    for (const p of all) {
      const key = p.company_name.toLowerCase().trim();
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(p);
    }

    for (const [_, postings] of byCompany) {
      const openRolesCount = new Set(postings.map((p) => p.role)).size;
      for (const p of postings) {
        // Check existing for repost detection
        const { data: existing } = await sb
          .from("techalert_prospect_targets")
          .select("id, repost_count, status")
          .ilike("company_name", p.company_name)
          .eq("role", p.role)
          .maybeSingle();

        const repostCount = existing ? (existing.repost_count ?? 0) + 1 : 0;
        const score = scorePosting(p, openRolesCount, repostCount);

        if (existing) {
          await sb.from("techalert_prospect_targets").update({
            days_posted: p.days_posted,
            repost_count: repostCount,
            open_roles_count: openRolesCount,
            score,
            source_url: p.source_url,
            source_label: p.source_label,
            city: p.city,
            is_boiler: p.is_boiler,
          }).eq("id", existing.id);
          updated++;
        } else {
          const { error } = await sb.from("techalert_prospect_targets").insert({
            company_name: p.company_name,
            city: p.city,
            role: p.role,
            days_posted: p.days_posted,
            repost_count: 0,
            open_roles_count: openRolesCount,
            is_boiler: p.is_boiler,
            score,
            source_url: p.source_url,
            source_label: p.source_label,
            status: "new",
          });
          if (!error) inserted++;
        }
      }
    }

    // Log heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-prospect-hunter",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { scanned, inserted, updated, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, scanned, inserted, updated, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hunter] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
