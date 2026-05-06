// Autonomous enrichment waterfall — runs every 2h via cron.
// Processes pending rows across three search tables:
//   hire_alert_candidates   → NPI (healthcare) → Sonar OSINT → PDL phone/email → re-score
//   techalert_business_prospects → Sonar: website + decision-maker contact
//   b2b_contacts            → Sonar: direct phone + email
// Batch sizes are conservative so we never breach the 150s edge function timeout.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEnrichment } from "../_shared/enrichment-audit.ts";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY           = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY    = Deno.env.get("OPENROUTER_API_KEY");
const PDL_API_KEY           = Deno.env.get("PDL_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stop processing if we're within 40s of the edge function limit
const WALL_BUDGET_MS = 110_000;

// ─────────────────────────────────────────────────────────────
// SONAR: tradesperson OSINT
// ─────────────────────────────────────────────────────────────
async function sonarEnrichCandidate(name: string, trade: string, city: string | null): Promise<{
  linkedin_url: string | null;
  current_employer: string | null;
  phone: string | null;
  email: string | null;
  availability_signal: string | null;
} | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const loc = city ? `${city}, Michigan` : "Michigan";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: 'Find public info about this tradesperson for employment outreach. Return ONLY a JSON object — no markdown, no explanation: {"linkedin_url":"url or null","current_employer":"company or null","phone":"phone or null","email":"email or null","availability_signal":"brief note if open-to-work signal found, else null"}',
          },
          { role: "user", content: `Name: ${name}\nTrade: ${trade}\nLocation: ${loc}` },
        ],
        max_tokens: 250, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// SONAR: trade business contact lookup
// ─────────────────────────────────────────────────────────────
async function sonarEnrichBusiness(name: string, trade: string | null, city: string | null): Promise<{
  website: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
} | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const loc = city ? `${city}, Michigan` : "Michigan";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: 'Find contact info for this trade business. Return ONLY JSON: {"website":"url or null","phone":"phone or null","contact_name":"owner or manager name or null","contact_email":"email or null"}',
          },
          { role: "user", content: `Business: ${name}\nTrade: ${trade || "contractor"}\nLocation: ${loc}` },
        ],
        max_tokens: 200, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// SONAR: B2B contact direct info
// ─────────────────────────────────────────────────────────────
async function sonarEnrichB2B(businessName: string, ownerName: string | null, city: string | null): Promise<{
  phone: string | null;
  email: string | null;
  owner_name: string | null;
} | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const loc = city ? `${city}, Michigan` : "Michigan";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: 'Find direct contact details for this business. Return ONLY JSON: {"phone":"direct phone or null","email":"direct email or null","owner_name":"owner or decision-maker name or null"}',
          },
          { role: "user", content: `Business: ${businessName}${ownerName ? `\nContact: ${ownerName}` : ""}\nLocation: ${loc}` },
        ],
        max_tokens: 150, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// NPI Registry — free, healthcare candidates only
// ─────────────────────────────────────────────────────────────
async function npiLookup(name: string, city: string | null, state: string | null = "MI"): Promise<{
  npi_number: string | null;
  phone: string | null;
  taxonomy: string | null;
  practice_address: string | null;
} | null> {
  try {
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    const last  = parts[parts.length - 1];
    const cityQ = city ? `&city=${encodeURIComponent(city)}` : "";
    const st = (state || "MI").toUpperCase();
    const url = `https://npiregistry.cms.hhs.gov/api/?first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&state=${st}${cityQ}&enumeration_type=NPI-1&limit=1&version=2.1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    return {
      npi_number:       r.number || null,
      phone:            r.basic?.authorized_official_telephone_number || null,
      taxonomy:         r.taxonomies?.[0]?.desc || null,
      practice_address: r.addresses?.[0]
        ? `${r.addresses[0].address_1}, ${r.addresses[0].city}, ${st}`
        : null,
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// PDL — paid ~$0.10/lookup, score≥7 candidates only
// ─────────────────────────────────────────────────────────────
async function pdlLookup(name: string, city: string | null, email: string | null): Promise<{
  mobile_phone: string | null;
  personal_email: string | null;
} | null> {
  if (!PDL_API_KEY) return null;
  try {
    const params = new URLSearchParams({ pretty: "true" });
    params.set("name", name);
    if (city)  params.set("location", `${city} MI`);
    if (email) params.set("email", email);
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-Api-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 200) return null;
    return {
      mobile_phone:   data.data?.mobile_phone || data.data?.phone_numbers?.[0] || null,
      personal_email: data.data?.personal_emails?.[0] || null,
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// ENRICH: single hire_alert_candidate
// ─────────────────────────────────────────────────────────────
async function enrichCandidate(sb: any, c: any): Promise<number> {
  const upd: Record<string, unknown> = {
    enrichment_status:       "complete",
    enrichment_attempted_at: new Date().toISOString(),
  };

  // Step 1: NPI — healthcare trades only, free
  const isHealthcare = /\b(rn|lpn|cna|np\b|nurse|nursing|caregiver|home.?health|healthcare|medical)\b/i.test(c.license_type || "");
  if (isHealthcare && !c.npi_number) {
    const npi = await npiLookup(c.full_name, c.city);
    if (npi) {
      upd.npi_number         = npi.npi_number;
      upd.npi_business_phone = npi.phone;
      upd.npi_taxonomy       = npi.taxonomy;
      upd.npi_practice_address = npi.practice_address;
      if (npi.phone && !c.phone) upd.phone = npi.phone;
    }
  }

  // Step 2: Sonar OSINT — always run once per candidate
  if (!c.sonar_enriched_at) {
    const s = await sonarEnrichCandidate(c.full_name, c.license_type || "Tradesperson", c.city);
    if (s) {
      upd.sonar_linkedin_url        = s.linkedin_url;
      upd.sonar_current_employer    = s.current_employer;
      upd.sonar_availability_signal = s.availability_signal;
      upd.sonar_enriched_at         = new Date().toISOString();
      if (s.phone && !c.phone && !upd.phone)  upd.phone = s.phone;
      if (s.email && !c.email)                 upd.email = s.email;
    }
  }

  // Step 3: PDL — paid, high-score only, skip if already have both phone+email
  const hasPhone = !!(upd.phone || c.phone || c.pdl_mobile_phone);
  const hasEmail = !!(upd.email || c.email || c.pdl_personal_email);
  if ((c.score || 0) >= 7 && (!hasPhone || !hasEmail) && !c.pdl_mobile_phone) {
    const pdl = await pdlLookup(c.full_name, c.city, (upd.email as string) || c.email);
    if (pdl) {
      if (pdl.mobile_phone)  { upd.pdl_mobile_phone  = pdl.mobile_phone;  if (!upd.phone && !c.phone) upd.phone = pdl.mobile_phone; }
      if (pdl.personal_email){ upd.pdl_personal_email = pdl.personal_email; if (!upd.email && !c.email) upd.email = pdl.personal_email; }
    }
  }

  // Step 4: Re-score — each data point found adds 1-2 points
  let score = c.score || 0;
  if (upd.phone  && !c.phone  && !c.pdl_mobile_phone)  score = Math.min(10, score + 1);
  if (upd.email  && !c.email  && !c.pdl_personal_email) score = Math.min(10, score + 1);
  if (upd.sonar_linkedin_url)                           score = Math.min(10, score + 1);
  if (upd.sonar_availability_signal)                    score = Math.min(10, score + 2); // seeking work = strongest signal
  if (score !== c.score) upd.score = score;

  await sb.from("hire_alert_candidates").update(upd).eq("id", c.id);
  return score - (c.score || 0);
}

// ─────────────────────────────────────────────────────────────
// ENRICH: single techalert_business_prospect
// ─────────────────────────────────────────────────────────────
async function enrichProspect(sb: any, p: any): Promise<void> {
  const upd: Record<string, unknown> = {
    enrichment_status:       "complete",
    enrichment_attempted_at: new Date().toISOString(),
  };
  const s = await sonarEnrichBusiness(p.business_name, p.trade, p.city);
  if (s) {
    if (s.website      && !p.website) upd.website      = s.website;
    if (s.phone        && !p.phone)   upd.phone        = s.phone;
    if (s.contact_name)               upd.contact_name = s.contact_name;
    if (s.contact_email && !p.email)  upd.email        = s.contact_email;
    upd.sonar_enriched_at = new Date().toISOString();
  }
  await sb.from("techalert_business_prospects").update(upd).eq("id", p.id);
}

// ─────────────────────────────────────────────────────────────
// ENRICH: single b2b_contact
// ─────────────────────────────────────────────────────────────
async function enrichB2B(sb: any, c: any): Promise<void> {
  const upd: Record<string, unknown> = {
    enrichment_status:       "complete",
    enrichment_attempted_at: new Date().toISOString(),
  };
  const s = await sonarEnrichB2B(c.business_name, c.owner_name, c.city);
  if (s) {
    if (s.phone      && !c.phone)      upd.phone      = s.phone;
    if (s.email      && !c.email)      upd.email      = s.email;
    if (s.owner_name && !c.owner_name) upd.owner_name = s.owner_name;
    upd.sonar_enriched_at = new Date().toISOString();
  }
  await sb.from("b2b_contacts").update(upd).eq("id", c.id);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb      = createClient(SUPABASE_URL, SERVICE_KEY);
  const started = Date.now();
  const stats   = { candidates: 0, score_bumps: 0, prospects: 0, b2b: 0, errors: 0 };

  // ── 1. hire_alert_candidates: full waterfall, 5 per run ──────────
  const { data: candidates } = await sb
    .from("hire_alert_candidates")
    .select("id,full_name,license_type,city,phone,email,score,npi_number,pdl_mobile_phone,pdl_personal_email,sonar_enriched_at,sonar_linkedin_url")
    .eq("enrichment_status", "pending")
    .gte("score", 5)
    .not("is_company_name", "is", true)
    .order("score", { ascending: false })
    .limit(5);

  for (const c of (candidates || [])) {
    if (Date.now() - started > WALL_BUDGET_MS - 45_000) break;
    const wrapped = await logEnrichment(
      { lead_id: c.id, vertical: "talent", function_name: "enrich-candidates", stage: "deep", provider: "waterfall(npi+sonar+pdl)", triggered_by: "cron" },
      async () => {
        const delta = await enrichCandidate(sb, c);
        const fields_added: string[] = [];
        if (delta > 0) fields_added.push(`score+${delta}`);
        return { fields_added };
      },
    );
    if (wrapped.ok) {
      stats.candidates++;
      // delta tracked inside wrapper
    } else {
      console.error(`[enrich] candidate ${c.id} failed:`, wrapped.error);
      await sb.from("hire_alert_candidates")
        .update({ enrichment_status: "failed", enrichment_attempted_at: new Date().toISOString() })
        .eq("id", c.id);
      stats.errors++;
    }
  }

  // ── 2. techalert_business_prospects: Sonar, 5 per run ────────────
  if (Date.now() - started < WALL_BUDGET_MS - 30_000) {
    const { data: prospects } = await sb
      .from("techalert_business_prospects")
      .select("id,business_name,trade,city,phone,email,website")
      .eq("enrichment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    for (const p of (prospects || [])) {
      if (Date.now() - started > WALL_BUDGET_MS - 20_000) break;
      const wrapped = await logEnrichment(
        { lead_id: p.id, vertical: "prospect", function_name: "enrich-candidates", stage: "other", provider: "sonar", triggered_by: "cron" },
        async () => {
          const before = { website: !!p.website, phone: !!p.phone, email: !!p.email };
          await enrichProspect(sb, p);
          const { data: after } = await sb.from("techalert_business_prospects").select("website,phone,email").eq("id", p.id).maybeSingle();
          const fields_added: string[] = [];
          if (!before.website && after?.website) fields_added.push("website");
          if (!before.phone && after?.phone) fields_added.push("phone");
          if (!before.email && after?.email) fields_added.push("email");
          return { fields_added };
        },
      );
      if (wrapped.ok) {
        stats.prospects++;
      } else {
        console.error(`[enrich] prospect ${p.id} failed:`, wrapped.error);
        await sb.from("techalert_business_prospects")
          .update({ enrichment_status: "failed", enrichment_attempted_at: new Date().toISOString() })
          .eq("id", p.id);
        stats.errors++;
      }
    }
  }

  // ── 3. b2b_contacts: Sonar, 5 per run ────────────────────────────
  if (Date.now() - started < WALL_BUDGET_MS - 15_000) {
    const { data: contacts } = await sb
      .from("b2b_contacts")
      .select("id,business_name,owner_name,city,phone,email")
      .eq("enrichment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    for (const c of (contacts || [])) {
      if (Date.now() - started > WALL_BUDGET_MS - 8_000) break;
      const wrapped = await logEnrichment(
        { lead_id: c.id, vertical: "growth", function_name: "enrich-candidates", stage: "other", provider: "sonar", triggered_by: "cron" },
        async () => {
          const before = { phone: !!c.phone, email: !!c.email };
          await enrichB2B(sb, c);
          const { data: after } = await sb.from("b2b_contacts").select("phone,email").eq("id", c.id).maybeSingle();
          const fields_added: string[] = [];
          if (!before.phone && after?.phone) fields_added.push("phone");
          if (!before.email && after?.email) fields_added.push("email");
          return { fields_added };
        },
      );
      if (wrapped.ok) {
        stats.b2b++;
      } else {
        console.error(`[enrich] b2b ${c.id} failed:`, wrapped.error);
        await sb.from("b2b_contacts")
          .update({ enrichment_status: "failed", enrichment_attempted_at: new Date().toISOString() })
          .eq("id", c.id);
        stats.errors++;
      }
    }
  }

  const elapsed = Date.now() - started;
  console.log(`[enrich] ✅ ${elapsed}ms | candidates=${stats.candidates} score_bumps=${stats.score_bumps} prospects=${stats.prospects} b2b=${stats.b2b} errors=${stats.errors}`);

  return new Response(
    JSON.stringify({ ok: true, elapsed_ms: elapsed, ...stats }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
