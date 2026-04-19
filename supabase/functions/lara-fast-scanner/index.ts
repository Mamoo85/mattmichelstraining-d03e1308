// lara-fast-scanner — INSTANT NEW LICENSE RADAR (multi-prefix)
// Probes Accela CapDetail (server-rendered HTML, NOT a SPA) for each LARA
// license-prefix on a 30-min cron. Each new ID found = new license issued.
//
// Prefixes covered: VAL (vehicle/general), ELE (electrician), PLM (plumber),
// BOI (boiler), MEC (mechanical/HVAC). Cursors persisted in
// `lara_prefix_cursors`. Total budget per run ≈ 90s, ~12 probes per prefix.
//
// Health probe: GET/POST with ?probe=1 returns {ok:true} in <500ms.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

// Each prefix is one license category. capID1 is the calendar-year prefix used
// by Accela; we keep "23" (most recent fully-issued series). Probes per prefix
// are intentionally conservative to stay within the 90s budget.
const PREFIXES: Array<{ prefix: string; capId1: string; mappedType: string; probesPerRun: number }> = [
  { prefix: "VAL", capId1: "23VAL", mappedType: "Trade Professional", probesPerRun: 12 },
  { prefix: "ELE", capId1: "23ELE", mappedType: "Electrician",        probesPerRun: 12 },
  { prefix: "PLM", capId1: "23PLM", mappedType: "Plumber",            probesPerRun: 12 },
  { prefix: "BOI", capId1: "23BOI", mappedType: "Boiler Operator",    probesPerRun: 12 },
  { prefix: "MEC", capId1: "23MEC", mappedType: "HVAC Technician",    probesPerRun: 12 },
];

// ---- Person-name guard (mirrors logic in main scraper) ----
const COMPANY_TOKENS = /\b(inc|llc|corp|co\.|company|services|service|solutions|group|enterprises|systems|industries|construction|plumbing|hvac|mechanical|electric|electrical|heating|cooling|dba|d\/b\/a|holdings|realty)\b/i;
function isPersonName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 60) return false;
  if (/^[\(\d\s\)\-\+\.]+/.test(trimmed)) return false;
  const alphaWords = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z][a-zA-Z\-']+$/.test(w) && w.length >= 2);
  if (alphaWords.length < 2) return false;
  if (COMPANY_TOKENS.test(trimmed)) return false;
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 8) return false;
  return true;
}

interface Probe {
  full_name: string;
  license_type: string;
  license_number: string;
  city: string | null;
}

async function probeCapDetail(
  capId1: string,
  capId3: number,
  defaultType: string,
  diagnostic: { logged: boolean }
): Promise<Probe | null> {
  const url = `https://aca-prod.accela.com/LARA/Cap/CapDetail.aspx?Module=Licensing&capID1=${capId1}&capID2=00000&capID3=${capId3}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Diagnostic: dump first 500 chars of the FIRST successful response per run
    // so future "0 results" debugging takes 30s, not 30 minutes.
    if (!diagnostic.logged && html.length > 200) {
      console.log(`[lara-fast-scanner] DIAGNOSTIC capId=${capId1}-${capId3} html_len=${html.length} head=${JSON.stringify(html.slice(0, 500))}`);
      diagnostic.logged = true;
    }

    const nameMatch = html.match(/Licensee\s*[:<][^>]*>\s*([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})/i);
    const licMatch = html.match(/License\s*Number[:<][^>]*>\s*([A-Z0-9\-]+)/i);
    const typeMatch = html.match(/License\s*Type[:<][^>]*>\s*([A-Za-z\s]+?)</i);
    const cityMatch = html.match(/(?:City|Address)[^<]*<[^>]*>\s*[^,]*,\s*([A-Za-z\s]+?),\s*MI/i);

    if (!nameMatch || !isPersonName(nameMatch[1])) return null;

    // Prefer the LARA-declared type if clearly recognizable, else fall back to
    // the prefix's default mapping.
    const lt = (typeMatch?.[1] || "").toUpperCase();
    let mappedType = defaultType;
    if (lt.includes("ELECTR")) mappedType = "Electrician";
    else if (lt.includes("PLUMB")) mappedType = "Plumber";
    else if (lt.includes("BOILER")) mappedType = "Boiler Operator";
    else if (lt.includes("HVAC") || lt.includes("MECHANIC")) mappedType = "HVAC Technician";

    return {
      full_name: nameMatch[1].trim(),
      license_type: mappedType,
      license_number: licMatch?.[1] || `${capId1}-${capId3}`,
      city: cityMatch?.[1]?.trim() || null,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── HEALTH PROBE — fast path for service-health UI ──
  const url = new URL(req.url);
  if (url.searchParams.get("probe") === "1") {
    return new Response(JSON.stringify({ ok: true, name: "lara-fast-scanner" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  const BUDGET_MS = 90_000;

  // Read all cursors in one query.
  const { data: cursorRows } = await sb
    .from("lara_prefix_cursors")
    .select("prefix, last_id");
  const cursorMap = new Map<string, number>();
  for (const r of cursorRows || []) cursorMap.set(r.prefix, r.last_id);

  const totals = { probed: 0, found: 0, inserted: 0 };
  const perPrefix: Array<{ prefix: string; probed: number; found: number; inserted: number; from: number; to: number }> = [];
  const diagnostic = { logged: false };

  for (const cfg of PREFIXES) {
    if (Date.now() - startedAt > BUDGET_MS) break;

    const startId = cursorMap.get(cfg.prefix) ?? 6_400_000;
    let probed = 0;
    let found = 0;
    let inserted = 0;

    for (let i = 1; i <= cfg.probesPerRun; i++) {
      if (Date.now() - startedAt > BUDGET_MS) break;
      const capId3 = startId + i;
      probed++;

      const result = await probeCapDetail(cfg.capId1, capId3, cfg.mappedType, diagnostic);
      if (result) {
        found++;
        const { data: existing } = await sb
          .from("hire_alert_candidates")
          .select("id")
          .eq("license_number", result.license_number)
          .maybeSingle();

        if (!existing) {
          const { error } = await sb.from("hire_alert_candidates").insert({
            name: result.full_name,
            full_name: result.full_name,
            license_type: result.license_type,
            license_number: result.license_number,
            city: result.city,
            source: `lara_${cfg.prefix.toLowerCase()}`,
            last_seen_at: new Date().toISOString(),
          } as any);
          if (!error) inserted++;
        }
      }

      // Politeness delay (1 req/sec across all prefixes)
      await new Promise((r) => setTimeout(r, 1_000));
    }

    // Advance cursor for this prefix
    await sb.from("lara_prefix_cursors").upsert(
      { prefix: cfg.prefix, last_id: startId + probed, updated_at: new Date().toISOString() },
      { onConflict: "prefix" }
    );

    // Per-prefix run row in hire_alert_runs so admin sees lara_ele / lara_plm / etc.
    await sb.from("hire_alert_runs").insert({
      run_at: new Date().toISOString(),
      source: `lara_${cfg.prefix.toLowerCase()}`,
      candidates_found: probed,
      new_candidates: inserted,
      alerts_sent: 0,
      errors: 0,
      status: "ok",
      completed_at: new Date().toISOString(),
    } as any);

    // Checkpoint
    await sb.from("hire_alert_scanner_checkpoints").upsert(
      {
        source: `lara_${cfg.prefix.toLowerCase()}`,
        status: "ok",
        last_completed_at: new Date().toISOString(),
        last_count: inserted,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source" }
    );

    totals.probed += probed;
    totals.found += found;
    totals.inserted += inserted;
    perPrefix.push({ prefix: cfg.prefix, probed, found, inserted, from: startId, to: startId + probed });
  }

  const summary = {
    ok: true,
    totals,
    per_prefix: perPrefix,
    duration_ms: Date.now() - startedAt,
    diagnostic_logged: diagnostic.logged,
  };
  console.log(`[lara-fast-scanner] ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
