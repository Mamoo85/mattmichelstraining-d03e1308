// lara-fast-scanner — INSTANT NEW LICENSE RADAR
// Runs every 30 min on a lightweight cron. Sole purpose: probe the next batch
// of LARA Accela VAL license IDs sequentially. New license issued = new ID
// in the system = caught within ~30 minutes (vs. 4-hour main scanner cadence).
//
// This is the "we alert you the moment a license hits the system" promise.
// Kept standalone so it never gets starved by the heavier 20-source scanner.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
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

async function probeValId(valId: number): Promise<Probe | null> {
  const url = `https://aca-prod.accela.com/LARA/Cap/CapDetail.aspx?Module=Licensing&capID1=23VAL&capID2=00000&capID3=${valId}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const nameMatch = html.match(/Licensee\s*[:<][^>]*>\s*([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})/i);
    const licMatch = html.match(/License\s*Number[:<][^>]*>\s*([A-Z0-9\-]+)/i);
    const typeMatch = html.match(/License\s*Type[:<][^>]*>\s*([A-Za-z\s]+?)</i);
    const cityMatch = html.match(/(?:City|Address)[^<]*<[^>]*>\s*[^,]*,\s*([A-Za-z\s]+?),\s*MI/i);

    if (!nameMatch || !isPersonName(nameMatch[1])) return null;

    const lt = (typeMatch?.[1] || "").toUpperCase();
    let mappedType = "Trade Professional";
    if (lt.includes("ELECTR")) mappedType = "Electrician";
    else if (lt.includes("PLUMB")) mappedType = "Plumber";
    else if (lt.includes("BOILER")) mappedType = "Boiler Operator";
    else if (lt.includes("HVAC") || lt.includes("MECHANIC")) mappedType = "HVAC Technician";

    return {
      full_name: nameMatch[1].trim(),
      license_type: mappedType,
      license_number: licMatch?.[1] || `VAL-${valId}`,
      city: cityMatch?.[1]?.trim() || null,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  // Read current cursor
  const { data: cursor } = await sb
    .from("lara_val_cursor")
    .select("last_val_id")
    .eq("id", 1)
    .maybeSingle();
  const startId = cursor?.last_val_id || 6_500_000;

  const PROBE_COUNT = 60; // 30 min cron, 1 req/sec → ~60s budget
  const BUDGET_MS = 90_000;
  let probed = 0;
  let found = 0;
  let inserted = 0;

  for (let i = 1; i <= PROBE_COUNT; i++) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    const valId = startId + i;
    probed++;

    const result = await probeValId(valId);
    if (result) {
      found++;
      // Skip dup license numbers
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
          source: "lara_val",
          last_seen_at: new Date().toISOString(),
        } as any);
        if (!error) inserted++;
      }
    }

    // Politeness delay (1 req/sec)
    await new Promise((r) => setTimeout(r, 1_000));
  }

  // Advance cursor
  await sb.from("lara_val_cursor").upsert(
    { id: 1, last_val_id: startId + probed, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  // Log per-source run row so admin run table reflects this worker's activity
  await sb.from("hire_alert_runs").insert({
    run_at: new Date().toISOString(),
    source: "lara_val",
    candidates_found: probed,
    new_candidates: inserted,
    alerts_sent: 0,
    errors: 0,
    status: "ok",
    completed_at: new Date().toISOString(),
  } as any);

  // Mark checkpoint complete (release the perpetual "processing" lock)
  await sb.from("hire_alert_scanner_checkpoints").upsert(
    {
      source: "lara_val",
      status: "ok",
      last_completed_at: new Date().toISOString(),
      last_count: inserted,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source" }
  );

  const summary = {
    ok: true,
    probed,
    found,
    inserted,
    cursor_from: startId,
    cursor_to: startId + probed,
    duration_ms: Date.now() - startedAt,
  };
  console.log(`[lara-fast-scanner] ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
