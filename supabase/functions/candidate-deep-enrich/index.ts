// candidate-deep-enrich — Deep enrichment pipeline for TechAlert/HireAlert candidates
// Runs every 30 minutes. Picks up candidates with enrichment_status='pending'.
// Pipeline: Perplexity (social/employer) → Apollo (phone/email) → AI Synthesis (summary)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CandidateRow {
  id: string;
  full_name: string;
  name: string;
  license_type: string | null;
  license_number: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  raw_data: Record<string, unknown> | null;
}

// Phase 1: Perplexity web search for social profiles, employer, experience
async function enrichViaPerplexity(candidate: CandidateRow): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) return {};

  const query = `Find publicly available information about "${candidate.full_name}" who is a ${candidate.license_type || "tradesperson"} in ${candidate.city || "Michigan"}. 
Look for:
1. LinkedIn profile URL
2. Facebook profile URL  
3. Current employer/company name
4. Current job title
5. Estimated years of experience in the trade
6. Any other professional social media profiles
7. License status if available from Michigan LARA

Return ONLY valid JSON: { "linkedin_url": "url or null", "facebook_url": "url or null", "current_employer": "name or null", "current_title": "title or null", "years_experience": number or null, "other_profiles": [] }`;

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
          { role: "system", content: "You are a professional research assistant. Return ONLY valid JSON, no markdown, no explanation." },
          { role: "user", content: query },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      console.warn(`[deep-enrich] Perplexity HTTP ${res.status} for ${candidate.full_name}`);
      return {};
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn(`[deep-enrich] Perplexity error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// Phase 2: Apollo people/match for verified contact info
async function enrichViaApollo(candidate: CandidateRow): Promise<Record<string, unknown>> {
  if (!APOLLO_API_KEY) return {};

  const nameParts = (candidate.full_name || candidate.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  if (!firstName) return {};

  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        location: candidate.city || "Michigan",
        title: candidate.license_type || "",
        reveal_personal_emails: true,
        reveal_phone_number: true,
      }),
    });

    if (!res.ok) {
      console.warn(`[deep-enrich] Apollo HTTP ${res.status} for ${candidate.full_name}`);
      return {};
    }

    const data = await res.json();
    const person = data?.person;
    if (!person) return {};

    const phoneNumbers = person.phone_numbers as Array<{ sanitized_number?: string; type?: string }> | undefined;
    const allPhones = (phoneNumbers || []).map((p) => ({ number: p.sanitized_number, type: p.type })).filter((p) => p.number);

    return {
      apollo_email: person.email || null,
      apollo_phone: phoneNumbers?.[0]?.sanitized_number || null,
      apollo_all_phones: allPhones,
      apollo_linkedin: person.linkedin_url || null,
      apollo_title: person.title || null,
      apollo_company: person.organization?.name || null,
      apollo_headline: person.headline || null,
      apollo_city: person.city || null,
      apollo_state: person.state || null,
      apollo_seniority: person.seniority || null,
    };
  } catch (e) {
    console.warn(`[deep-enrich] Apollo error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// Phase 3: AI Synthesis — combine all data into actionable summary
async function synthesize(
  candidate: CandidateRow,
  perplexityData: Record<string, unknown>,
  apolloData: Record<string, unknown>
): Promise<{ qualifications_summary: string; hiring_recommendation: string }> {
  if (!LOVABLE_API_KEY) return { qualifications_summary: "", hiring_recommendation: "" };

  const prompt = `You are a hiring intelligence analyst. Based on the following data about a tradesperson candidate, write two things:

1. QUALIFICATIONS SUMMARY (2-3 sentences): Their trade expertise, years of experience, license status, and current situation.
2. HIRING RECOMMENDATION (2-3 sentences): Whether an employer should reach out, how urgently, and the best approach.

CANDIDATE DATA:
- Name: ${candidate.full_name || candidate.name}
- Trade/License: ${candidate.license_type || "Unknown"}
- License Number: ${candidate.license_number || "Not found"}
- Location: ${candidate.city || "Michigan"}, ${candidate.state || "MI"}
- Source: ${candidate.source}

PERPLEXITY RESEARCH:
${JSON.stringify(perplexityData, null, 2)}

APOLLO PROFESSIONAL DATA:
${JSON.stringify(apolloData, null, 2)}

Return JSON: { "qualifications_summary": "...", "hiring_recommendation": "..." }
Do NOT mention AI, algorithms, or data sources. Write as a human hiring researcher would.`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return { qualifications_summary: "", hiring_recommendation: "" };

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { qualifications_summary: "", hiring_recommendation: "" };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      qualifications_summary: parsed.qualifications_summary || "",
      hiring_recommendation: parsed.hiring_recommendation || "",
    };
  } catch {
    return { qualifications_summary: "", hiring_recommendation: "" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get up to 15 pending candidates per run
  const { data: candidates, error: fetchErr } = await sb
    .from("hire_alert_candidates")
    .select("id, full_name, name, license_type, license_number, city, state, email, phone, source, raw_data")
    .eq("enrichment_status", "pending")
    .order("created_at", { ascending: true })
    .limit(15);

  if (fetchErr) {
    console.error("[deep-enrich] Fetch error:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  if (!candidates?.length) {
    console.log("[deep-enrich] No pending candidates");
    return new Response(JSON.stringify({ enriched: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log(`[deep-enrich] Processing ${candidates.length} candidates`);

  let enriched = 0;
  let errors = 0;

  for (const candidate of candidates as CandidateRow[]) {
    try {
      // Mark as in-progress
      await sb.from("hire_alert_candidates").update({ enrichment_status: "enriching" }).eq("id", candidate.id);

      // Run Perplexity + Apollo in parallel
      const [perplexityData, apolloData] = await Promise.all([
        enrichViaPerplexity(candidate),
        enrichViaApollo(candidate),
      ]);

      // AI Synthesis
      const { qualifications_summary, hiring_recommendation } = await synthesize(candidate, perplexityData, apolloData);

      // Build update object
      const update: Record<string, unknown> = {
        enrichment_status: "complete",
        enriched_at: new Date().toISOString(),
      };

      // Merge Perplexity data
      if (perplexityData.linkedin_url) update.linkedin_url = perplexityData.linkedin_url;
      if (perplexityData.facebook_url) update.facebook_url = perplexityData.facebook_url;
      if (perplexityData.current_employer) update.current_employer = perplexityData.current_employer;
      if (perplexityData.current_title) update.current_title = perplexityData.current_title;
      if (perplexityData.years_experience) update.years_experience = perplexityData.years_experience;

      // Merge Apollo data (prefer Apollo for contact info — more reliable)
      if (apolloData.apollo_email && !candidate.email) update.email = apolloData.apollo_email;
      if (apolloData.apollo_phone && !candidate.phone) update.phone = apolloData.apollo_phone;
      if (apolloData.apollo_linkedin) update.linkedin_url = apolloData.apollo_linkedin; // Apollo LinkedIn is usually more accurate
      if (apolloData.apollo_company) update.current_employer = apolloData.apollo_company;
      if (apolloData.apollo_title) update.current_title = apolloData.apollo_title;

      // Social profiles aggregate
      const socialProfiles: Record<string, unknown> = {};
      if (update.linkedin_url || perplexityData.linkedin_url) socialProfiles.linkedin = update.linkedin_url || perplexityData.linkedin_url;
      if (update.facebook_url || perplexityData.facebook_url) socialProfiles.facebook = update.facebook_url || perplexityData.facebook_url;
      if (perplexityData.other_profiles) socialProfiles.other = perplexityData.other_profiles;
      if (apolloData.apollo_all_phones) socialProfiles.all_phones = apolloData.apollo_all_phones;
      if (apolloData.apollo_headline) socialProfiles.headline = apolloData.apollo_headline;
      if (Object.keys(socialProfiles).length) update.social_profiles = socialProfiles;

      // AI summaries
      if (qualifications_summary) update.qualifications_summary = qualifications_summary;
      if (hiring_recommendation) update.hiring_recommendation = hiring_recommendation;

      const { error: updateErr } = await sb.from("hire_alert_candidates").update(update).eq("id", candidate.id);
      if (updateErr) {
        console.error(`[deep-enrich] Update error for ${candidate.full_name || candidate.name}:`, updateErr.message);
        await sb.from("hire_alert_candidates").update({ enrichment_status: "error" }).eq("id", candidate.id);
        errors++;
      } else {
        enriched++;
        console.log(`[deep-enrich] ✅ Enriched: ${candidate.full_name || candidate.name} — linkedin=${!!update.linkedin_url} employer=${!!update.current_employer} phone=${!!update.phone}`);
      }
    } catch (e) {
      console.error(`[deep-enrich] Error for ${candidate.full_name || candidate.name}:`, e instanceof Error ? e.message : String(e));
      await sb.from("hire_alert_candidates").update({ enrichment_status: "error" }).eq("id", candidate.id);
      errors++;
    }
  }

  // Heartbeat
  await sb.from("agent_heartbeats").upsert({
    agent_name: "candidate-deep-enrich",
    last_beat: new Date().toISOString(),
    metadata: { enriched, errors, batch_size: candidates.length },
  }, { onConflict: "agent_name" });

  console.log(`[deep-enrich] Done: enriched=${enriched} errors=${errors}`);
  return new Response(
    JSON.stringify({ enriched, errors, total: candidates.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
