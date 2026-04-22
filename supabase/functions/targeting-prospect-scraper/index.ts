/**
 * targeting-prospect-scraper — Unified router. Audience type drives the source.
 *
 * POST { audience_type, county?, limit?, dry_run? }
 *
 * Routes:
 *   nursing_home        → CMS Medicare Care Compare (free)
 *   healthcare_staffing → NPI Registry (taxonomy filter) + Sonar fallback
 *   trades_staffing     → Sonar (Google + BBB scrape)
 *   hvac/plumbing/etc   → LARA Accela (delegates to existing lara-accela-scraper if available)
 *   supply_house        → Sonar industry directory
 *   general_contractor  → LARA + Sonar
 *   industrial_mfg      → SAM.gov + Sonar manufacturers list
 *   senior_care         → CMS home-health + assisted-living
 *   school              → MI Dept of Education public CSV
 *
 * All write to public.prospect_pool (deduped).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRO_DETROIT_ZIPS = ["480", "481", "482", "483"];
const COUNTY_TO_ZIPS: Record<string, string[]> = {
  Wayne: ["481", "482"],
  Oakland: ["480", "483"],
  Macomb: ["480", "481"],
};
const COUNTY_CITIES: Record<string, string[]> = {
  Wayne: ["Detroit", "Dearborn", "Livonia", "Westland", "Taylor", "Romulus", "Wyandotte", "Lincoln Park", "Allen Park", "Grosse Pointe"],
  Oakland: ["Troy", "Royal Oak", "Pontiac", "Farmington Hills", "Southfield", "Novi", "Bloomfield Hills", "Birmingham", "Auburn Hills"],
  Macomb: ["Warren", "Sterling Heights", "Clinton Township", "Macomb", "Roseville", "St. Clair Shores", "Eastpointe", "Mount Clemens"],
};

interface Prospect {
  business_name: string;
  contact_name?: string;
  audience_type: string;
  channel_hint: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  phone?: string;
  fax_number?: string;
  email?: string;
  website?: string;
  source: string;
  source_url?: string;
  source_id?: string;
  verified_address?: boolean;
  verified_fax?: boolean;
  cms_staffing_rating?: number;
  meta?: Record<string, unknown>;
}

function normPhone(s: string): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

function zipsForCounty(county?: string): string[] {
  if (!county) return METRO_DETROIT_ZIPS;
  return COUNTY_TO_ZIPS[county] || METRO_DETROIT_ZIPS;
}

function citiesForCounty(county?: string): string[] {
  if (!county) return [...COUNTY_CITIES.Wayne, ...COUNTY_CITIES.Oakland, ...COUNTY_CITIES.Macomb];
  return COUNTY_CITIES[county] || COUNTY_CITIES.Wayne;
}

// ── Sonar (Perplexity via OpenRouter) helper for B2B directory scrapes ───────
async function sonarSearch(prompt: string): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You return ONLY valid JSON arrays. No prose. No markdown fences. Each item must be a real, verifiable business with a real US address." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[sonar] http", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content || "";
    const cleaned = txt.replace(/```json\s*|\s*```/g, "").trim();
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) return [];
    return JSON.parse(m[0]);
  } catch (e) {
    console.error("[sonar]", e);
    return [];
  }
}

// ── Source: CMS nursing homes ─────────────────────────────────────────────────
async function fetchNursingHomes(county: string | undefined, limit: number): Promise<Prospect[]> {
  const zipPrefixes = zipsForCounty(county);
  try {
    const res = await fetch("https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: [{ property: "state", value: "MI", operator: "=" }],
        limit: 500, offset: 0,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data?.results || [];
    return rows
      .filter((r: any) => {
        const zip = (r.zip || r.provider_zip_code || "").toString();
        return zipPrefixes.some(p => zip.startsWith(p));
      })
      .map((r: any): Prospect => ({
        business_name: r.provider_name || r.facility_name || "Unknown Facility",
        audience_type: "nursing_home",
        channel_hint: "both",
        address_line1: r.provider_address || r.address || "",
        city: r.provider_city || "",
        state: "MI",
        zip: (r.provider_zip_code || r.zip || "").toString().slice(0, 5),
        county,
        phone: normPhone(r.provider_phone_number || r.phone || "") || undefined,
        source: "cms_medicare_care_compare",
        source_url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        source_id: r.federal_provider_number || r.provider_id,
        verified_address: !!(r.provider_address && r.provider_city),
        cms_staffing_rating: r.staffing_rating ? parseInt(r.staffing_rating) : undefined,
        meta: { overall_rating: r.overall_rating, residents: r.number_of_certified_beds },
      }))
      .slice(0, limit);
  } catch (e) {
    console.error("[nursing]", e);
    return [];
  }
}

// ── Source: NPI registry — healthcare staffing agencies ──────────────────────
async function fetchHealthcareStaffing(county: string | undefined, limit: number): Promise<Prospect[]> {
  const cities = citiesForCounty(county);
  const out: Prospect[] = [];
  // NPI taxonomy: "Nursing Service Providers" 251J00000X, "Home Health" 251E00000X, "Temporary Medical Staffing" 251K00000X
  const taxonomies = ["251K00000X", "251J00000X", "251E00000X"];
  for (const city of cities.slice(0, 5)) {
    for (const tax of taxonomies) {
      try {
        const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&state=MI&city=${encodeURIComponent(city)}&taxonomy_description=${tax}&limit=50`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) continue;
        const data = await res.json();
        for (const e of data?.results || []) {
          const addr = (e.addresses || [])[0] || {};
          out.push({
            business_name: e.basic?.organization_name || `${e.basic?.first_name || ""} ${e.basic?.last_name || ""}`.trim(),
            audience_type: "healthcare_staffing",
            channel_hint: "both",
            address_line1: addr.address_1,
            address_line2: addr.address_2,
            city: addr.city || city,
            state: "MI",
            zip: (addr.postal_code || "").slice(0, 5),
            county,
            phone: normPhone(addr.telephone_number || ""),
            fax_number: normPhone(addr.fax_number || ""),
            source: "nppes_npi_registry",
            source_url: `https://npiregistry.cms.hhs.gov/provider-view/${e.number}`,
            source_id: e.number,
            verified_address: !!(addr.address_1 && addr.city),
            verified_fax: !!normPhone(addr.fax_number || ""),
            meta: { taxonomy: tax },
          });
          if (out.length >= limit) return out;
        }
      } catch (err) { console.error("[npi]", city, tax, err); }
    }
  }
  // Sonar fallback if NPI thin
  if (out.length < 5) {
    const prompt = `Real healthcare staffing agencies and nurse staffing firms with offices in ${county || "Metro Detroit"}, Michigan. Return JSON array of {business_name, address, city, state, zip, phone, fax, website}. Max 15 items.`;
    const sonar = await sonarSearch(prompt);
    for (const s of sonar) {
      out.push({
        business_name: s.business_name || s.name,
        audience_type: "healthcare_staffing",
        channel_hint: "both",
        address_line1: s.address,
        city: s.city,
        state: s.state || "MI",
        zip: (s.zip || "").toString().slice(0, 5),
        county,
        phone: normPhone(s.phone || ""),
        fax_number: normPhone(s.fax || ""),
        website: s.website,
        source: "sonar_b2b",
        verified_address: !!(s.address && s.city),
        verified_fax: !!normPhone(s.fax || ""),
      });
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}

// ── Source: Sonar — trades staffing agencies ─────────────────────────────────
async function fetchTradesStaffing(county: string | undefined, limit: number): Promise<Prospect[]> {
  const prompt = `Real skilled trades staffing agencies in ${county || "Metro Detroit"}, Michigan that place HVAC technicians, plumbers, electricians, welders, machinists, or industrial maintenance workers. Examples: Tradesmen International, Aerotek, PeopleReady Skilled Trades, local franchises. Return JSON array of {business_name, address, city, state, zip, phone, fax, website}. Max ${limit}.`;
  const sonar = await sonarSearch(prompt);
  return sonar.map((s: any): Prospect => ({
    business_name: s.business_name || s.name,
    audience_type: "trades_staffing",
    channel_hint: "both",
    address_line1: s.address,
    city: s.city,
    state: s.state || "MI",
    zip: (s.zip || "").toString().slice(0, 5),
    county,
    phone: normPhone(s.phone || ""),
    fax_number: normPhone(s.fax || ""),
    website: s.website,
    source: "sonar_b2b",
    verified_address: !!(s.address && s.city),
    verified_fax: !!normPhone(s.fax || ""),
  })).filter((p) => p.business_name).slice(0, limit);
}

// ── Source: Sonar — supply houses ────────────────────────────────────────────
async function fetchSupplyHouses(county: string | undefined, limit: number): Promise<Prospect[]> {
  const prompt = `Real plumbing/HVAC/electrical wholesale supply houses and distributors in ${county || "Metro Detroit"}, Michigan (e.g. Ferguson, Grainger, Behler-Young, R.E. Michel, Johnstone Supply locations). Return JSON array of {business_name, address, city, state, zip, phone, fax, website}. Max ${limit}.`;
  const sonar = await sonarSearch(prompt);
  return sonar.map((s: any): Prospect => ({
    business_name: s.business_name || s.name,
    audience_type: "supply_house",
    channel_hint: "both",
    address_line1: s.address,
    city: s.city,
    state: s.state || "MI",
    zip: (s.zip || "").toString().slice(0, 5),
    county,
    phone: normPhone(s.phone || ""),
    fax_number: normPhone(s.fax || ""),
    website: s.website,
    source: "sonar_b2b",
    verified_address: !!(s.address && s.city),
    verified_fax: !!normPhone(s.fax || ""),
  })).filter((p) => p.business_name).slice(0, limit);
}

// ── Source: Sonar — industrial manufacturing ─────────────────────────────────
async function fetchIndustrialMfg(county: string | undefined, limit: number): Promise<Prospect[]> {
  const prompt = `Real mid-size industrial manufacturers in ${county || "Metro Detroit"}, Michigan (CNC shops, precision machining, aerospace, automotive tier 1/2 suppliers, metal fabricators) with 50-500 employees. Return JSON array of {business_name, address, city, state, zip, phone, fax, website, employee_estimate}. Max ${limit}.`;
  const sonar = await sonarSearch(prompt);
  return sonar.map((s: any): Prospect => ({
    business_name: s.business_name || s.name,
    audience_type: "industrial_mfg",
    channel_hint: "both",
    address_line1: s.address,
    city: s.city,
    state: s.state || "MI",
    zip: (s.zip || "").toString().slice(0, 5),
    county,
    phone: normPhone(s.phone || ""),
    fax_number: normPhone(s.fax || ""),
    website: s.website,
    source: "sonar_b2b",
    verified_address: !!(s.address && s.city),
    verified_fax: !!normPhone(s.fax || ""),
    meta: { employee_estimate: s.employee_estimate },
  })).filter((p) => p.business_name).slice(0, limit);
}

// ── Source: CMS senior care (home health + assisted living proxy) ────────────
async function fetchSeniorCare(county: string | undefined, limit: number): Promise<Prospect[]> {
  const zipPrefixes = zipsForCounty(county);
  try {
    // Home Health Compare dataset
    const res = await fetch("https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: [{ property: "state", value: "MI", operator: "=" }],
        limit: 500,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data?.results || [];
    return rows
      .filter((r: any) => {
        const zip = (r.zip_code || r.zip || "").toString();
        return zipPrefixes.some(p => zip.startsWith(p));
      })
      .map((r: any): Prospect => ({
        business_name: r.provider_name || r.cms_certification_number || "Unknown",
        audience_type: "senior_care",
        channel_hint: "both",
        address_line1: r.address || r.provider_address,
        city: r.city || r.city_town,
        state: "MI",
        zip: (r.zip_code || r.zip || "").toString().slice(0, 5),
        county,
        phone: normPhone(r.telephone_number || ""),
        source: "cms_home_health",
        source_url: "https://data.cms.gov/provider-data/dataset/6jpm-sxkc",
        source_id: r.cms_certification_number,
        verified_address: !!(r.address && r.city),
      }))
      .slice(0, limit);
  } catch (e) {
    console.error("[senior]", e);
    return [];
  }
}

// ── Source: SAM.gov — federal contractors with awards in target counties ─────
async function fetchSamGovProspects(county: string | undefined, limit: number): Promise<Prospect[]> {
  if (!SAM_GOV_API_KEY) return [];
  try {
    // SAM Entity Management API — registered entities in MI
    const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${SAM_GOV_API_KEY}&physicalAddressStateCode=MI&registrationStatus=A&limit=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const entities = data?.entityData || [];
    return entities
      .filter((e: any) => {
        const zip = e.coreData?.physicalAddress?.zipCode || "";
        if (!county) return true;
        return zipsForCounty(county).some(p => zip.startsWith(p));
      })
      .map((e: any): Prospect => {
        const addr = e.coreData?.physicalAddress || {};
        return {
          business_name: e.entityRegistration?.legalBusinessName || "Unknown",
          audience_type: "industrial_mfg",
          channel_hint: "both",
          address_line1: addr.addressLine1,
          address_line2: addr.addressLine2,
          city: addr.city,
          state: addr.stateOrProvinceCode || "MI",
          zip: (addr.zipCode || "").slice(0, 5),
          county,
          source: "sam_gov",
          source_id: e.entityRegistration?.ueiSAM,
          source_url: `https://sam.gov/entity/${e.entityRegistration?.ueiSAM}`,
          verified_address: true,
          meta: { naics: e.assertions?.goodsAndServices?.primaryNaics },
        };
      })
      .slice(0, limit);
  } catch (e) {
    console.error("[sam]", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const audience: string = body.audience_type || "nursing_home";
    const county: string | undefined = body.county;
    const limit: number = Math.min(body.limit || 50, 200);
    const dryRun: boolean = body.dry_run === true;
    // mode='postcard' → also mirror prospects into postcard_prospects table
    const mode: string = body.mode || "default";

    let prospects: Prospect[] = [];
    switch (audience) {
      case "nursing_home":        prospects = await fetchNursingHomes(county, limit); break;
      case "healthcare_staffing": prospects = await fetchHealthcareStaffing(county, limit); break;
      case "trades_staffing":     prospects = await fetchTradesStaffing(county, limit); break;
      case "supply_house":        prospects = await fetchSupplyHouses(county, limit); break;
      case "industrial_mfg":      {
        const a = await fetchSamGovProspects(county, Math.floor(limit / 2));
        const b = await fetchIndustrialMfg(county, limit - a.length);
        prospects = [...a, ...b];
        break;
      }
      case "senior_care":         prospects = await fetchSeniorCare(county, limit); break;
      default:
        return new Response(JSON.stringify({
          error: "unsupported_audience",
          supported: ["nursing_home", "healthcare_staffing", "trades_staffing", "supply_house", "industrial_mfg", "senior_care"],
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, found: prospects.length, sample: prospects.slice(0, 5) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let inserted = 0, dup = 0, errors = 0, postcardInserted = 0, faxInserted = 0;

    // Map audience_type → fax segment label
    const FAX_SEGMENT_MAP: Record<string, string> = {
      "nursing_home": "nursing_home",
      "healthcare_staffing": "medical",
      "trades_staffing": "industrial",
      "supply_house": "industrial",
      "industrial_mfg": "industrial",
      "senior_care": "nursing_home",
    };
    const insertedIds: string[] = [];
    for (const p of prospects) {
      if (!p.business_name) continue;
      try {
        const { data: existing } = await sb
          .from("prospect_pool")
          .select("id")
          .ilike("business_name", p.business_name)
          .eq("audience_type", p.audience_type)
          .eq("zip", p.zip || "")
          .maybeSingle();
        if (existing) { dup++; }
        else {
          const { data, error } = await sb.from("prospect_pool").insert(p).select("id").maybeSingle();
          if (error) { errors++; console.error("[insert]", error.message); }
          else { inserted++; if (data?.id) insertedIds.push(data.id); }
        }

        // Also mirror into postcard_prospects when mode='postcard' and prospect has an address.
        if (mode === "postcard" && p.address_line1 && p.city && p.zip) {
          const { data: pcExisting } = await sb
            .from("postcard_prospects")
            .select("id")
            .ilike("business_name", p.business_name)
            .eq("zip", p.zip)
            .maybeSingle();
          if (!pcExisting) {
            // Map scraper audience_type → postcard audience_type (campaign filter)
            const POSTCARD_AUDIENCE_MAP: Record<string, string> = {
              healthcare_staffing: "healthcare-agency",
              trades_staffing: "trades-agency",
              nursing_home: "nursing-home",
              supply_house: "supply-house",
              contractor: "contractor",
              hvac: "contractor",
              plumbing: "contractor",
              electrical: "contractor",
              boiler: "contractor",
              roofing: "contractor",
            };
            const postcardAudience = POSTCARD_AUDIENCE_MAP[p.audience_type] || "contractor";
            const { error: pcErr } = await sb.from("postcard_prospects").insert({
              business_name: p.business_name,
              address_line1: p.address_line1,
              address_line2: p.address_line2 || null,
              city: p.city,
              state: p.state || "MI",
              zip: p.zip,
              county: p.county || county || null,
              owner_name: p.contact_name || null,
              phone: p.phone || null,
              email: p.email || null,
              source: `targeting_${p.audience_type}`,
              audience_type: postcardAudience,
            });
            if (!pcErr) postcardInserted++;
            else console.error("[postcard insert]", pcErr.message);
          }
        }
        // Also mirror into fax_prospects when mode='fax' and prospect has a fax number.
        if (mode === "fax" && p.fax_number) {
          const faxSeg = FAX_SEGMENT_MAP[p.audience_type] || "industrial";
          const { data: fxExisting } = await sb
            .from("fax_prospects")
            .select("id")
            .eq("fax_number", p.fax_number)
            .maybeSingle();
          if (!fxExisting) {
            const { error: fxErr } = await sb.from("fax_prospects").insert({
              business_name: p.business_name,
              fax_number: p.fax_number,
              contact_name: p.contact_name || null,
              address: p.address_line1 || null,
              city: p.city || null,
              state: p.state || "MI",
              zip: p.zip || null,
              county: p.county || county || null,
              segment: faxSeg,
              audience_type: p.audience_type,
              source: `targeting_${p.audience_type}`,
              source_url: p.source_url || null,
              verified_public: !!p.verified_fax,
            });
            if (!fxErr) faxInserted++;
            else console.error("[fax insert]", fxErr.message);
          }
        }
      } catch (e) { errors++; console.error("[loop]", e); }
    }

    // Trigger scoring async — don't block response
    if (insertedIds.length > 0) {
      fetch(`${SUPABASE_URL}/functions/v1/score-prospects`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_ids: insertedIds }),
      }).catch((e) => console.error("[trigger-score]", e));
    }

    return new Response(JSON.stringify({ ok: true, audience, county, mode, found: prospects.length, inserted, duplicates: dup, errors, postcard_prospects_added: postcardInserted, fax_prospects_added: faxInserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[targeting-prospect-scraper]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
