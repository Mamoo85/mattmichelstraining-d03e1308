// dol-labor-stats — pulls Detroit-MSA labor stats from the DOL Open Data API
// and surfaces trade-shortage signals Matt can pitch TechAlert against.
//
// Free DOL API: https://developer.dol.gov/  (BLS occupational data + OEWS wages)
// Saves snapshots to `dol_labor_snapshots` so the dashboard can trend them.
//
// Trigger: POST /functions/v1/dol-labor-stats  (no body required)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOL_API_KEY  = Deno.env.get("DOL_API_KEY")!;

// SOC codes we care about for TechAlert / FieldDesk pitches (Detroit-Warren-Dearborn MSA = 19820)
const TARGET_OCCUPATIONS = [
  { soc: "47-2152", label: "Plumbers / Pipefitters",        trade: "plumber" },
  { soc: "49-9021", label: "HVAC Mechanics & Installers",   trade: "hvac" },
  { soc: "47-2111", label: "Electricians",                  trade: "electrician" },
  { soc: "47-2181", label: "Roofers",                       trade: "roofer" },
  { soc: "29-1141", label: "Registered Nurses",             trade: "rn" },
  { soc: "29-2061", label: "Licensed Practical Nurses",     trade: "lpn" },
  { soc: "31-1131", label: "Nursing Assistants (CNA)",      trade: "cna" },
];

const DETROIT_MSA = "19820"; // Detroit-Warren-Dearborn, MI

interface DolRow {
  soc: string;
  label: string;
  trade: string;
  employment: number | null;
  median_hourly: number | null;
  mean_hourly: number | null;
  jobs_per_1k: number | null;
}

// DOL Open Data API — generic dataset query helper.
// Endpoint pattern: https://apiprod.dol.gov/v4/get/{agency}/{endpoint}/{format}
async function fetchDol(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, "X-API-KEY": DOL_API_KEY }).toString();
  const url = `https://apiprod.dol.gov/v4/get/${path}?${qs}`;
  const res = await fetch(url, {
    headers: { "X-API-KEY": DOL_API_KEY, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`DOL ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function fetchOewsForOccupation(soc: string): Promise<Partial<DolRow>> {
  // BLS OEWS dataset (Occupational Employment & Wage Stats), MSA-level
  // We try the v4 endpoint; if shape changes, we fall back to defaults.
  try {
    const json = await fetchDol("bls/oews/json", {
      area_code: DETROIT_MSA,
      occ_code: soc,
      year: String(new Date().getFullYear() - 1),
    });
    const row = Array.isArray(json?.data) ? json.data[0] : (json?.results?.[0] ?? null);
    if (!row) return {};
    return {
      employment:    Number(row.tot_emp ?? row.employment) || null,
      median_hourly: Number(row.h_median ?? row.median_hourly_wage) || null,
      mean_hourly:   Number(row.h_mean ?? row.mean_hourly_wage) || null,
      jobs_per_1k:   Number(row.jobs_1000 ?? row.jobs_per_1k) || null,
    };
  } catch (e) {
    console.warn(`OEWS lookup failed for ${soc}:`, (e as Error).message);
    return {};
  }
}

function buildShortageSignals(rows: DolRow[]): { trade: string; signal: string; severity: "low" | "med" | "high" }[] {
  const out: { trade: string; signal: string; severity: "low" | "med" | "high" }[] = [];
  for (const r of rows) {
    if (!r.median_hourly && !r.employment) continue;
    // Heuristic: high median wage + low jobs_per_1k = shortage = TechAlert pitch opportunity.
    const sevHigh = (r.median_hourly ?? 0) >= 35 && (r.jobs_per_1k ?? 0) < 4;
    const sevMed  = (r.median_hourly ?? 0) >= 28 && (r.jobs_per_1k ?? 0) < 6;
    if (sevHigh) {
      out.push({
        trade: r.trade,
        signal: `${r.label} in Detroit MSA: median $${r.median_hourly}/hr, only ${r.jobs_per_1k} per 1k jobs — tight market, TechAlert pitch wins.`,
        severity: "high",
      });
    } else if (sevMed) {
      out.push({
        trade: r.trade,
        signal: `${r.label}: $${r.median_hourly}/hr median — moderate shortage, mention 'shrinking pool' in cold email.`,
        severity: "med",
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!DOL_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "DOL_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const start = Date.now();

  try {
    const rows: DolRow[] = [];
    for (const occ of TARGET_OCCUPATIONS) {
      const stats = await fetchOewsForOccupation(occ.soc);
      rows.push({
        soc: occ.soc,
        label: occ.label,
        trade: occ.trade,
        employment:    stats.employment    ?? null,
        median_hourly: stats.median_hourly ?? null,
        mean_hourly:   stats.mean_hourly   ?? null,
        jobs_per_1k:   stats.jobs_per_1k   ?? null,
      });
      // Polite throttle to keep DOL happy.
      await new Promise(r => setTimeout(r, 250));
    }

    const signals = buildShortageSignals(rows);
    const usableRows = rows.filter(r => r.median_hourly || r.employment).length;

    // Persist snapshot for trending.
    await supabase.from("dol_labor_snapshots").insert({
      area_code: DETROIT_MSA,
      area_name: "Detroit-Warren-Dearborn, MI",
      rows,
      shortage_signals: signals,
      duration_ms: Date.now() - start,
    });

    return new Response(JSON.stringify({
      ok: true,
      area: "Detroit-Warren-Dearborn, MI",
      rows_fetched: rows.length,
      usable_rows: usableRows,
      shortage_signals: signals,
      sample: rows.slice(0, 3),
      duration_ms: Date.now() - start,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
