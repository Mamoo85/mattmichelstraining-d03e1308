// marketplace-lead-gov-enrich
// Adds SAM.gov, USPS, HUD, EPA ECHO, NPI, MI SOS Sonar data into free_enrichment.gov blob.
// Called per-lead from marketplace-lead-free-enrich-batch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEnrichment } from "../_shared/enrichment-audit.ts";
import { fetchMortgageSignals } from "../_shared/signal-waterfall.ts";
import { fetchMarketSnapshot } from "../_shared/market-waterfall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

async function safeFetch(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// USPS address standardization (free, requires no key — uses Nominatim as fallback proxy
// since the official USPS API requires registration; here we just normalize via OpenStreetMap).
async function uspsStandardize(address: string, city: string, state: string, zip: string) {
  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
  const data = await safeFetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&addressdetails=1`,
    { headers: { "User-Agent": "DWA-MarketplaceEnrich/1.0" } },
    5000,
  );
  if (!Array.isArray(data) || !data[0]) return null;
  const d = data[0];
  return {
    standardized: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    confidence: d.importance ?? null,
  };
}

// HUD Fair Market Rents by ZIP — free, no key
async function hudFairMarketRent(zip: string) {
  const data = await safeFetch(`https://www.huduser.gov/hudapi/public/fmr/data/${zip}`, {}, 5000);
  if (!data?.data?.basicdata) return null;
  const b = data.data.basicdata;
  return {
    fmr_2br: b["Two-Bedroom"] ?? null,
    fmr_3br: b["Three-Bedroom"] ?? null,
    metro_name: data.data.metro_name ?? null,
  };
}

// SAM.gov — federal contractor lookup for W-2 income badge
async function samGovLookup(name: string) {
  if (!SAM_GOV_API_KEY || !name) return null;
  const q = encodeURIComponent(name);
  const data = await safeFetch(
    `https://api.sam.gov/entity-information/v3/entities?q=${q}&api_key=${SAM_GOV_API_KEY}&samRegistered=Yes`,
    {},
    6000,
  );
  if (!data?.entityData?.length) return { is_contractor: false };
  const entity = data.entityData[0];
  return {
    is_contractor: true,
    uei: entity.entityRegistration?.ueiSAM ?? null,
    legal_name: entity.entityRegistration?.legalBusinessName ?? null,
  };
}

// EPA ECHO violations near address
async function epaEchoCheck(zip: string) {
  const data = await safeFetch(
    `https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_pid=${zip}&p_act=Y&responseset=1`,
    {},
    6000,
  );
  if (!data?.Results?.Facilities) return null;
  const facilities = data.Results.Facilities;
  return {
    violation_count: Array.isArray(facilities) ? facilities.length : 0,
  };
}

// NPI Registry — healthcare professional badge (free, no key)
async function npiLookup(firstName: string, lastName: string, state: string) {
  if (!firstName || !lastName) return null;
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&state=${state}&limit=1`;
  const data = await safeFetch(url, {}, 5000);
  if (!data?.results?.length) return { is_healthcare: false };
  const r = data.results[0];
  return {
    is_healthcare: true,
    npi: r.number,
    taxonomy: r.taxonomies?.[0]?.desc ?? null,
  };
}

// Michigan SOS LLC status via Sonar (Perplexity)
async function miSosSonar(name: string) {
  if (!OPENROUTER_API_KEY || !name) return null;
  const data = await safeFetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [
          {
            role: "user",
            content: `Is "${name}" an active Michigan LLC? Reply ONLY: ACTIVE, INACTIVE, or UNKNOWN.`,
          },
        ],
        max_tokens: 20,
      }),
    },
    8000,
  );
  const text = data?.choices?.[0]?.message?.content?.trim().toUpperCase() || "";
  const status = text.includes("ACTIVE") ? "active" : text.includes("INACTIVE") ? "inactive" : "unknown";
  return { llc_status: status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("mortgage_radar_leads")
      .select("id, owner_name, address, city, state, zip, free_enrichment")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [first, last] = (lead.owner_name || "").trim().split(/\s+/, 2);

    const wrap = <T,>(provider: string, fields: string[], fn: () => Promise<T | null>) =>
      logEnrichment<T>(
        {
          lead_id,
          vertical: "mortgage",
          function_name: "marketplace-lead-gov-enrich",
          stage: "gov",
          provider,
          triggered_by: "on_demand",
        },
        async () => {
          const r = await fn();
          if (r === null || r === undefined) throw new Error(`${provider}_miss`);
          return { data: r, fields_added: fields };
        },
      ).then((res) => res.data ?? null);

    const [usps, hud, sam, epa, npi, sos] = await Promise.all([
      wrap("usps_nominatim", ["usps"], () => uspsStandardize(lead.address || "", lead.city || "", lead.state || "MI", lead.zip || "")),
      lead.zip ? wrap("hud_fmr", ["hud_fmr"], () => hudFairMarketRent(lead.zip!)) : Promise.resolve(null),
      lead.owner_name ? wrap("sam_gov", ["sam_gov"], () => samGovLookup(lead.owner_name!)) : Promise.resolve(null),
      lead.zip ? wrap("epa_echo", ["epa_echo"], () => epaEchoCheck(lead.zip!)) : Promise.resolve(null),
      first && last ? wrap("npi_registry", ["npi_registry"], () => npiLookup(first, last, lead.state || "MI")) : Promise.resolve(null),
      lead.owner_name ? wrap("perplexity_sonar", ["mi_sos"], () => miSosSonar(lead.owner_name!)) : Promise.resolve(null),
    ]);

    const govBlob = {
      usps,
      hud_fmr: hud,
      sam_gov: sam,
      epa_echo: epa,
      npi_registry: npi,
      mi_sos: sos,
      enriched_at: new Date().toISOString(),
    };

    const merged = {
      ...(typeof lead.free_enrichment === "object" && lead.free_enrichment !== null
        ? lead.free_enrichment
        : {}),
      gov: govBlob,
    };

    await supabase
      .from("mortgage_radar_leads")
      .update({ free_enrichment: merged })
      .eq("id", lead_id);

    return new Response(JSON.stringify({ ok: true, gov: govBlob }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
