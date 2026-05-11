// Preflight check for scanner source batches.
// Validates required API keys exist and (where cheap/safe) makes a lightweight
// auth probe to detect invalid/expired credentials WITHOUT running the batch.
//
// GET/POST /scanner-sources-preflight            -> checks all known batches
// POST     /scanner-sources-preflight {batch:1}  -> single batch
//
// Response: { ok, checked_at, batches: [{ batch, sources: [{ name, required_secrets, status, detail }] }] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type SecretStatus = "ok" | "missing" | "invalid" | "unknown";

interface SourceCheck {
  name: string;
  batch: number;
  required_secrets: string[];
  probe?: () => Promise<{ status: SecretStatus; detail?: string }>;
}

const hasSecret = (name: string) => {
  const v = Deno.env.get(name);
  return typeof v === "string" && v.trim().length > 0;
};

const missingSecrets = (names: string[]) => names.filter((n) => !hasSecret(n));

// ---- Probes ---------------------------------------------------------------

async function probeAttom(): Promise<{ status: SecretStatus; detail?: string }> {
  const key = Deno.env.get("ATTOM_API_KEY");
  if (!key) return { status: "missing", detail: "ATTOM_API_KEY not set" };
  try {
    const res = await fetch(
      "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?postalcode=48226&pagesize=1",
      { headers: { apikey: key, Accept: "application/json" } },
    );
    await res.text();
    if (res.status === 401 || res.status === 403) {
      return { status: "invalid", detail: `ATTOM auth failed: HTTP ${res.status}` };
    }
    if (!res.ok) return { status: "unknown", detail: `ATTOM HTTP ${res.status}` };
    return { status: "ok" };
  } catch (e) {
    return { status: "unknown", detail: `ATTOM probe error: ${(e as Error).message}` };
  }
}

async function probeRentcast(): Promise<{ status: SecretStatus; detail?: string }> {
  const key = Deno.env.get("RENTCAST_API_KEY");
  if (!key) return { status: "missing", detail: "RENTCAST_API_KEY not set" };
  try {
    const res = await fetch(
      "https://api.rentcast.io/v1/listings/sale?city=Detroit&state=MI&limit=1",
      { headers: { "X-Api-Key": key, Accept: "application/json" } },
    );
    await res.text();
    if (res.status === 401 || res.status === 403) {
      return { status: "invalid", detail: `RentCast auth failed: HTTP ${res.status}` };
    }
    if (!res.ok) return { status: "unknown", detail: `RentCast HTTP ${res.status}` };
    return { status: "ok" };
  } catch (e) {
    return { status: "unknown", detail: `RentCast probe error: ${(e as Error).message}` };
  }
}

// ---- Registry -------------------------------------------------------------

const SOURCES: SourceCheck[] = [
  // Batch 1 — zero-auth public APIs
  { name: "nws_active_alerts_mi", batch: 1, required_secrets: [] },
  { name: "epa_echo_enforcement_mi", batch: 1, required_secrets: [] },
  { name: "fcc_uls_recent_grants", batch: 1, required_secrets: [] },
  { name: "detroit_dpd_incidents", batch: 1, required_secrets: [] },
  { name: "michigan_sos_new_entities", batch: 1, required_secrets: [] },

  // Batch 2 — paid keys
  { name: "attom_property_snapshot", batch: 2, required_secrets: ["ATTOM_API_KEY"], probe: probeAttom },
  { name: "rentcast_sale_listings", batch: 2, required_secrets: ["RENTCAST_API_KEY"], probe: probeRentcast },
  { name: "rentcast_rental_listings", batch: 2, required_secrets: ["RENTCAST_API_KEY"], probe: probeRentcast },
];

// ---- Handler --------------------------------------------------------------

async function checkSource(s: SourceCheck) {
  const missing = missingSecrets(s.required_secrets);
  if (missing.length > 0) {
    return {
      name: s.name,
      required_secrets: s.required_secrets,
      status: "missing" as SecretStatus,
      detail: `Missing: ${missing.join(", ")}`,
    };
  }
  if (s.probe) {
    const r = await s.probe();
    return { name: s.name, required_secrets: s.required_secrets, ...r };
  }
  return {
    name: s.name,
    required_secrets: s.required_secrets,
    status: "ok" as SecretStatus,
    detail: s.required_secrets.length === 0 ? "no auth required" : "secret present (no probe)",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let onlyBatch: number | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.batch === "number") onlyBatch = body.batch;
    } catch { /* ignore */ }
  } else {
    const url = new URL(req.url);
    const b = url.searchParams.get("batch");
    if (b) onlyBatch = Number(b);
  }

  const filtered = onlyBatch ? SOURCES.filter((s) => s.batch === onlyBatch) : SOURCES;
  const results = await Promise.all(filtered.map(checkSource));

  // Group by batch
  const batches: Record<number, typeof results> = {};
  for (let i = 0; i < filtered.length; i++) {
    const b = filtered[i].batch;
    (batches[b] ||= []).push(results[i]);
  }

  const summary = {
    ok: results.every((r) => r.status === "ok"),
    checked_at: new Date().toISOString(),
    counts: {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      missing: results.filter((r) => r.status === "missing").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      unknown: results.filter((r) => r.status === "unknown").length,
    },
    batches: Object.entries(batches).map(([batch, sources]) => ({
      batch: Number(batch),
      sources,
    })),
  };

  return new Response(JSON.stringify(summary, null, 2), {
    status: summary.ok ? 200 : 424, // 424 Failed Dependency when something is wrong
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
