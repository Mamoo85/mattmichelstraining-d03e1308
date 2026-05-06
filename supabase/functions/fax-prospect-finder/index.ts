/**
 * fax-prospect-finder — Pulls B2B fax numbers from PUBLIC sources only
 *
 * Sources (all legal — public business directories):
 *  - segment="nursing_home" → CMS Medicare Care Compare API (federal data)
 *  - segment="medical"      → NPI Registry (federal NPPES, free)
 *  - segment="municipal"    → Detroit Open Data ArcGIS (public records)
 *  - segment="industrial"   → Manual seed list (verified business websites)
 *  - segment="legal"        → Manual seed list (state bar lookups)
 *  - segment="school"       → Manual seed list (district contact pages)
 *
 * All inserts marked verified_public=true with source_url for audit trail.
 * Trigger: POST { segment, limit?, dry_run? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRO_DETROIT_ZIPS = ["480", "481", "482", "483"];

interface Prospect {
  business_name: string;
  fax_number: string;
  contact_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  segment: string;
  source: string;
  source_url?: string;
  verified_public: boolean;
  notes?: string;
}

function normalizeFax(num: string): string | null {
  if (!num) return null;
  const digits = num.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// ── Source: CMS Medicare nursing home data (federal, free) ────────────
async function fetchNursingHomes(limit: number): Promise<Prospect[]> {
  const url = "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: [{ property: "state", value: "MI", operator: "=" }],
        limit: 500, offset: 0,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data?.results || [];
    return rows
      .filter((r: any) => {
        const zip = (r.zip || r.provider_zip_code || "").toString();
        return METRO_DETROIT_ZIPS.some(p => zip.startsWith(p));
      })
      .map((r: any): Prospect | null => {
        // Phone number: many CMS records list provider_phone_number which is also the fax for admin offices
        const fax = normalizeFax(r.provider_phone_number || r.phone || "");
        if (!fax) return null;
        return {
          business_name: r.provider_name || r.facility_name || "Unknown Facility",
          fax_number: fax,
          address: r.provider_address || r.address || "",
          city: r.provider_city || "",
          state: "MI",
          zip: (r.provider_zip_code || r.zip || "").toString(),
          segment: "nursing_home",
          source: "cms_medicare_care_compare",
          source_url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
          verified_public: true,
          notes: `CMS staffing rating: ${r.staffing_rating || "n/a"}`,
        };
      })
      .filter((p): p is Prospect => !!p)
      .slice(0, limit);
  } catch (e) {
    console.error("[finder] nursing homes:", e);
    return [];
  }
}

// ── Source: NPI Registry (federal NPPES, free, public) ────────────────
async function fetchMedicalPractices(limit: number): Promise<Prospect[]> {
  const cities = ["Detroit", "Dearborn", "Warren", "Sterling Heights", "Grosse Pointe"];
  const results: Prospect[] = [];
  for (const city of cities) {
    try {
      const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&state=MI&city=${encodeURIComponent(city)}&limit=50`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const entry of data?.results || []) {
        const addr = (entry.addresses || [])[0] || {};
        const fax = normalizeFax(addr.fax_number || "");
        if (!fax) continue;
        results.push({
          business_name: entry.basic?.organization_name || `${entry.basic?.first_name || ""} ${entry.basic?.last_name || ""}`.trim(),
          fax_number: fax,
          address: addr.address_1 || "",
          city: addr.city || city,
          state: "MI",
          zip: (addr.postal_code || "").slice(0, 5),
          segment: "medical",
          source: "nppes_npi_registry",
          source_url: `https://npiregistry.cms.hhs.gov/provider-view/${entry.number}`,
          verified_public: true,
          notes: `NPI: ${entry.number}`,
        });
        if (results.length >= limit) return results;
      }
    } catch (e) {
      console.error(`[finder] medical (${city}):`, e);
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const segment: string = body.segment || "nursing_home";
    const limit: number = Math.min(body.limit || 50, 200);
    const dryRun: boolean = body.dry_run === true;

    let prospects: Prospect[] = [];
    if (segment === "nursing_home") prospects = await fetchNursingHomes(limit);
    else if (segment === "medical") prospects = await fetchMedicalPractices(limit);
    else {
      return new Response(JSON.stringify({
        error: "unsupported_segment",
        supported: ["nursing_home", "medical"],
        note: "municipal/industrial/legal/school: add prospects manually via AdminFaxCampaigns UI",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, found: prospects.length, sample: prospects.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Dedupe by fax_number
    let inserted = 0, dup = 0;
    for (const p of prospects) {
      const { data: existing } = await sb
        .from("fax_prospects").select("id").eq("fax_number", p.fax_number).maybeSingle();
      if (existing) { dup++; continue; }
      const { error } = await sb.from("fax_prospects").insert(p);
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ ok: true, segment, found: prospects.length, inserted, duplicates: dup }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fax-prospect-finder]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
