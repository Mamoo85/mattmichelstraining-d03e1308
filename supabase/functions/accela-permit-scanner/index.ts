// Accela Permit Scanner — pulls construction/mechanical/electrical/plumbing permits
// from Accela-hosted Michigan jurisdictions and feeds Demand Radar → Industry Pulse.
//
// Auth: OAuth2 client_credentials with ACCELA_APP_ID / ACCELA_APP_SECRET.
// Scope: pulls Detroit (BSEED) + Metro Detroit suburbs + auto-discovers any MI agency
// the app is approved for. Writes signal_type='permit_surge' rows into industry_pulse_signals.
// Logs every run into demand_radar_runs so the Live Log can see failures.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACCELA_APP_ID = Deno.env.get("ACCELA_APP_ID");
const ACCELA_APP_SECRET = Deno.env.get("ACCELA_APP_SECRET");

const ACCELA_BASE = "https://apis.accela.com";

// Seed list — known Accela-powered Michigan jurisdictions. Discovery call below
// will add any others the app gets approved for.
const SEED_AGENCIES = [
  "DETROIT_MI",      // BSEED
  "ROYALOAK_MI",
  "WARREN_MI",
  "STERLINGHEIGHTS_MI",
  "TROY_MI",
  "LIVONIA_MI",
  "DEARBORN_MI",
  "CANTON_MI",
  "NOVI_MI",
  "FARMINGTON_MI",
  "SOUTHFIELD_MI",
];

// Permit types we care about for Industry Pulse / TechAlert cross-sell
const TARGET_TYPES = [
  "Building", "Mechanical", "Electrical", "Plumbing",
  "Boiler", "HVAC", "Commercial", "Industrial",
];

interface RunMetrics {
  source: string;
  signals_found: number;
  signals_new: number;
  status: "ok" | "error" | "partial";
  errors: string | null;
  duration_ms: number;
}

// Accela's app-level (client_credentials) OAuth requires an agency_name.
// We try each agency in TARGET_AGENCIES until one succeeds; cache per-agency tokens.
const tokenCache = new Map<string, { token: string; exp: number }>();

async function getAccelaToken(agency: string): Promise<string | null> {
  if (!ACCELA_APP_ID || !ACCELA_APP_SECRET) return null;
  const cached = tokenCache.get(agency);
  if (cached && cached.exp > Date.now()) return cached.token;
  try {
    const res = await fetch(`${ACCELA_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: ACCELA_APP_ID,
        client_secret: ACCELA_APP_SECRET,
        scope: "search_records get_record",
        agency_name: agency,
        environment: "PROD",
      }),
    });
    if (!res.ok) {
      console.error(`Accela token error [${agency}]:`, res.status, await res.text());
      return null;
    }
    const json = await res.json();
    if (!json.access_token) return null;
    const ttl = (json.expires_in || 3600) * 1000 - 60_000;
    tokenCache.set(agency, { token: json.access_token, exp: Date.now() + ttl });
    return json.access_token;
  } catch (e) {
    console.error(`Accela token exception [${agency}]:`, e);
    return null;
  }
}

async function searchPermits(token: string, agency: string, sinceISO: string) {
  const url = new URL(`${ACCELA_BASE}/v4/records`);
  url.searchParams.set("openedDateFrom", sinceISO.split("T")[0]);
  url.searchParams.set("limit", "100");
  url.searchParams.set("module", "Building");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: token,
      "x-accela-appid": ACCELA_APP_ID!,
      "x-accela-agency": agency,
    },
  });

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, records: [] };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, records: [] };
  }
  const json = await res.json().catch(() => ({}));
  return { ok: true, status: 200, records: Array.isArray(json?.result) ? json.result : [] };
}

function mapToSignal(record: any, agency: string) {
  const type = String(record?.type?.text || record?.type?.value || "").trim();
  const description = String(record?.description || record?.shortNotes || "").trim();
  const address = record?.addresses?.[0];
  const location = address
    ? [address.streetName, address.city, address.state].filter(Boolean).join(", ")
    : agency.replace(/_MI$/, ", MI").replace(/_/g, " ");

  const company = record?.contacts?.find((c: any) => c?.businessName)?.businessName
    || record?.customForms?.[0]?.values?.find((v: any) => /contractor|company|business/i.test(v?.label))?.value
    || null;

  let confidence = 5;
  if (/commercial|industrial/i.test(type + " " + description)) confidence = 8;
  else if (/boiler|hvac|mechanical/i.test(type + " " + description)) confidence = 7;

  return {
    signal_type: "permit_surge",
    company_name: company,
    location,
    vertical: type.toLowerCase().includes("boiler") ? "boiler"
      : type.toLowerCase().includes("hvac") || type.toLowerCase().includes("mechanical") ? "hvac"
      : type.toLowerCase().includes("plumb") ? "plumbing"
      : type.toLowerCase().includes("electric") ? "electrical"
      : "construction",
    expansion_type: null,
    predicted_needs: description || `${type} permit issued in ${location}`,
    confidence,
    source_url: record?.recordId?.id ? `https://aca.accela.com/${agency}/Cap/CapDetail.aspx?Module=Building&capID1=${record.recordId.id}` : null,
    detected_at: record?.openedDate || new Date().toISOString(),
    status: "new",
    raw_payload: { accela_agency: agency, record_id: record?.recordId?.id, type, ...record },
  };
}

async function logRun(supabase: any, metrics: RunMetrics) {
  await supabase.from("demand_radar_runs").insert(metrics);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (!ACCELA_APP_ID || !ACCELA_APP_SECRET) {
    await logRun(supabase, {
      source: "accela-permit-scanner",
      signals_found: 0,
      signals_new: 0,
      status: "error",
      errors: "Missing ACCELA_APP_ID or ACCELA_APP_SECRET",
      duration_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ error: "Missing Accela credentials" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = await getAccelaToken();
  if (!token) {
    await logRun(supabase, {
      source: "accela-permit-scanner",
      signals_found: 0,
      signals_new: 0,
      status: "error",
      errors: "OAuth token request failed",
      duration_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ error: "Accela auth failed" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sinceISO = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  let totalFound = 0;
  let totalNew = 0;
  const errors: string[] = [];
  const perAgency: Record<string, { found: number; new: number; status: number; auth?: string }> = {};
  let anyTokenSucceeded = false;

  for (const agency of SEED_AGENCIES) {
    try {
      const token = await getAccelaToken(agency);
      if (!token) {
        perAgency[agency] = { found: 0, new: 0, status: 401, auth: "no_token" };
        errors.push(`${agency}:auth_failed`);
        continue;
      }
      anyTokenSucceeded = true;
      const { ok, status, records } = await searchPermits(token, agency, sinceISO);
      perAgency[agency] = { found: records.length, new: 0, status };
      if (!ok) {
        if (status !== 401 && status !== 403) errors.push(`${agency}:${status}`);
        continue;
      }
      const targeted = records.filter((r: any) => {
        const t = String(r?.type?.text || r?.type?.value || "");
        return TARGET_TYPES.some((tt) => t.toLowerCase().includes(tt.toLowerCase()));
      });
      totalFound += targeted.length;

      for (const rec of targeted) {
        const signal = mapToSignal(rec, agency);
        const { error } = await supabase
          .from("industry_pulse_signals")
          .upsert(signal, { onConflict: "source_url", ignoreDuplicates: true });
        if (!error) {
          totalNew++;
          perAgency[agency].new++;
        }
      }
    } catch (e: any) {
      errors.push(`${agency}:${e?.message || "exception"}`);
    }
  }

  const status: RunMetrics["status"] = !anyTokenSucceeded
    ? "error"
    : errors.length === 0 ? "ok" : (totalNew > 0 ? "partial" : "error");

  await logRun(supabase, {
    source: "accela-permit-scanner",
    signals_found: totalFound,
    signals_new: totalNew,
    status,
    errors: errors.length ? errors.join("; ").slice(0, 500) : null,
    duration_ms: Date.now() - startedAt,
  });

  // Phase 20: waterfall drop-off snapshot
  try {
    await supabase.from("raw_signals_dump").insert({
      scanner: "accela-permit-scanner",
      source: "accela",
      vertical: "commercial",
      raw_payload: { per_agency: perAgency, errors },
      pulled_count: totalFound,
      kept_after_gate: totalFound,
      enriched_count: totalNew,
      final_inserted: totalNew,
      duration_ms: Date.now() - startedAt,
      notes: `agencies=${SEED_AGENCIES.length} status=${status}`,
    });
  } catch (e) { console.warn("[accela-permit-scanner] raw dump failed:", e); }

  return new Response(JSON.stringify({
    ok: true,
    signals_found: totalFound,
    signals_new: totalNew,
    agencies_scanned: SEED_AGENCIES.length,
    per_agency: perAgency,
    errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
