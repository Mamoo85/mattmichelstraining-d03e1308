// talent-state-prospect-hunter
// State-agnostic version of techalert-prospect-hunter.
// Finds companies in any US state that hire nurses or CDL drivers
// and writes them to techalert_prospect_targets for cold email outreach.
// POST { state: "OH", trade_group: "nursing"|"cdl_trucking", limit?: number, dry_run?: boolean }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
  MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// NAICS codes by trade_group — target employers who hire these workers
const NAICS_BY_TRADE: Record<string, string[]> = {
  nursing: ["621610", "623110", "623210", "623311", "621111", "621399", "621420", "621999"],
  // Home health, nursing care facilities, residential intellectual disability, continuing care,
  // offices of physicians, other health practitioners, outpatient mental health, misc health
  cdl_trucking: ["484121", "484122", "484110", "484210", "493110", "492110", "445110"],
  // General freight long-distance TL/LTL, local freight, household goods, warehousing, couriers, grocery
};

const ROLE_LABEL: Record<string, string> = {
  nursing: "registered nurse",
  cdl_trucking: "CDL driver",
};

const ROLE_KEY: Record<string, string> = {
  nursing: "registered_nurse",
  cdl_trucking: "cdl_driver",
};

interface Prospect {
  company_name: string;
  city?: string;
  state: string;
  role: string;
  score: number;
  source_url?: string;
  source_label?: string;
  website?: string;
  phone?: string;
  email?: string;
}

async function sonarSearch(state: string, stateName: string, tradeGroup: string, limit: number): Promise<Prospect[]> {
  if (!OPENROUTER_API_KEY) return [];
  const roleLabel = ROLE_LABEL[tradeGroup] || tradeGroup;
  const prompt = `Find companies in ${stateName} (state abbreviation: ${state}) that are actively hiring ${roleLabel}s. Return a JSON array of up to ${limit} companies. Each item: {"company_name":"string","city":"string","website":"string or null","source_url":"string or null","source_label":"Indeed|LinkedIn|ZipRecruiter|Glassdoor"}. Only direct employers — no staffing agencies or temp services. Hospitals, nursing homes, home health agencies, long-term care facilities for nursing; trucking companies, logistics firms, distribution centers for CDL. Return ONLY the JSON array.`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const raw = JSON.parse(match[0]);
    return (Array.isArray(raw) ? raw : []).slice(0, limit).map((x: any) => ({
      company_name: String(x.company_name || "").trim(),
      city: x.city ? String(x.city).trim() : undefined,
      state,
      role: ROLE_KEY[tradeGroup] || tradeGroup,
      score: 5,
      source_url: x.source_url || undefined,
      source_label: x.source_label || "Sonar",
      website: x.website || undefined,
    })).filter((p: Prospect) => p.company_name.length > 2);
  } catch { return []; }
}

async function apolloSearch(state: string, tradeGroup: string, limit: number): Promise<Prospect[]> {
  if (!APOLLO_API_KEY) return [];
  const naicsCodes = NAICS_BY_TRADE[tradeGroup] || [];
  const results: Prospect[] = [];

  for (const naics of naicsCodes.slice(0, 3)) {
    try {
      const r = await fetch("https://api.apollo.io/api/v1/organizations/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
        body: JSON.stringify({
          api_key: APOLLO_API_KEY,
          organization_locations: [state],
          organization_naics_codes: [naics],
          page: 1, per_page: Math.ceil(limit / naicsCodes.slice(0, 3).length),
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      for (const org of j.organizations || []) {
        if (!org.name) continue;
        results.push({
          company_name: String(org.name).trim(),
          city: org.city || undefined,
          state: org.state || state,
          role: ROLE_KEY[tradeGroup] || tradeGroup,
          score: 6,
          website: org.website_url || undefined,
          source_label: `Apollo NAICS ${naics}`,
        });
      }
    } catch { continue; }
  }
  return results.slice(0, limit);
}

async function samGovSearch(state: string, tradeGroup: string, limit: number): Promise<Prospect[]> {
  if (!SAM_GOV_API_KEY || tradeGroup !== "nursing") return [];
  // SAM.gov healthcare entities registered in this state
  const naics = "621610"; // Home Health Care Services — most likely to hire RNs via federal contracts
  try {
    const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${SAM_GOV_API_KEY}&addressCountryCode=USA&stateOrProvinceCode=${state}&primaryNaics=${naics}&entityEFTIndicator=Y&registrationStatus=A&purposeOfRegistrationCode=Z2&limit=${limit}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.entityData || []).slice(0, limit).map((e: any) => {
      const legal = e?.entityRegistration?.legalBusinessName || "";
      const city = e?.coreData?.physicalAddress?.city || "";
      const zip = e?.coreData?.physicalAddress?.zipCode || "";
      if (!legal) return null;
      return {
        company_name: legal.trim(),
        city: city ? `${city}, ${state}${zip ? " " + zip : ""}` : undefined,
        state,
        role: ROLE_KEY[tradeGroup],
        score: 7,
        source_label: `SAM.gov Entity (NAICS ${naics})`,
      };
    }).filter(Boolean) as Prospect[];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const state: string = (body?.state || "MI").toUpperCase();
  const tradeGroup: string = body?.trade_group || "nursing";
  const limit: number = Math.min(Number(body?.limit) || 40, 100);
  const dryRun: boolean = !!body?.dry_run;
  const stateName = STATE_NAMES[state] || state;

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, state, trade_group: tradeGroup, stateName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Run all sources in parallel
  const [sonarResults, apolloResults, samResults] = await Promise.all([
    sonarSearch(state, stateName, tradeGroup, Math.ceil(limit * 0.5)),
    apolloSearch(state, tradeGroup, Math.ceil(limit * 0.35)),
    samGovSearch(state, tradeGroup, Math.ceil(limit * 0.15)),
  ]);

  const allProspects = [...sonarResults, ...apolloResults, ...samResults];

  // Deduplicate by normalized company name
  const seen = new Set<string>();
  const unique = allProspects.filter(p => {
    const key = p.company_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let inserted = 0, skipped = 0;

  for (const p of unique) {
    if (!p.company_name) continue;
    const { error } = await sb.from("techalert_prospect_targets").upsert({
      company_name: p.company_name,
      city: p.city || null,
      state: p.state,
      role: p.role,
      score: p.score,
      website: p.website || null,
      phone: p.phone || null,
      email: p.email || null,
      source_url: p.source_url || null,
      source_label: p.source_label || null,
      status: "new",
    }, { onConflict: "company_name,role", ignoreDuplicates: true });
    if (error) { skipped++; } else { inserted++; }
  }

  // Update last_hunt_at in talent_outreach_states
  await sb.from("talent_outreach_states")
    .update({ last_hunt_at: new Date().toISOString(), prospects_added: inserted })
    .eq("state", state).eq("trade_group", tradeGroup);

  return new Response(JSON.stringify({ ok: true, state, trade_group: tradeGroup, found: allProspects.length, inserted, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
