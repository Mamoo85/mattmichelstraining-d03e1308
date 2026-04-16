// candidate-deep-enrich — Deep enrichment pipeline for TechAlert/HireAlert candidates
// Runs every 30 minutes. Picks up candidates with enrichment_status='pending'.
// Pipeline: Sonar OSINT (social/employer/contact) → AI Synthesis (summary)
// Apollo removed — Sonar handles all enrichment.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
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
  license_expiry: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  raw_data: Record<string, unknown> | null;
}

function extractJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Sonar OSINT enrichment — finds LinkedIn, Facebook, email, phone, employer
// NEVER reveals sources or methodology to clients
async function enrichViaSonar(candidate: CandidateRow): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) return {};

  const tradeLabel = candidate.license_type || "tradesperson";
  const locationLabel = candidate.city ? `${candidate.city}, Michigan` : "Michigan";

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
          { role: "system", content: "You are a professional research assistant. Return ONLY valid JSON, no markdown, no explanation, no commentary." },
          {
            role: "user",
            content: `Perform a web search to find the LinkedIn profile URL and Facebook profile URL for "${candidate.full_name || candidate.name}", who works as a ${tradeLabel} in or around ${locationLabel}. Also search for any associated public email addresses or phone numbers, their current employer, current job title, and estimated years of experience.

Return ONLY a JSON object with these keys:
{
  "linkedin_url": "full URL or null",
  "facebook_url": "full URL or null",
  "email": "email or null",
  "phone": "phone or null",
  "current_employer": "company name or null",
  "current_title": "job title or null",
  "years_experience": number or null
}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`[deep-enrich] Sonar HTTP ${res.status} for ${candidate.full_name || candidate.name}`);
      return {};
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    if (!parsed) {
      console.warn(`[deep-enrich] Sonar JSON parse failed for ${candidate.full_name || candidate.name}`);
      return {};
    }

    return parsed;
  } catch (e) {
    console.warn(`[deep-enrich] Sonar error for ${candidate.full_name || candidate.name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// AI Synthesis — combine all data into actionable summary
// NEVER mentions AI, algorithms, data sources, or methodology
async function synthesize(
  candidate: CandidateRow,
  sonarData: Record<string, unknown>
): Promise<{ qualifications_summary: string; hiring_recommendation: string }> {
  if (!LOVABLE_API_KEY) return { qualifications_summary: "", hiring_recommendation: "" };

  const prompt = `You are an experienced hiring researcher writing a brief dossier. Based on the following data about a tradesperson candidate, write two things:

1. QUALIFICATIONS SUMMARY (2-3 sentences): Their trade expertise, years of experience, license status, and current situation.
2. HIRING RECOMMENDATION (2-3 sentences): Whether an employer should reach out, how urgently, and the best approach.

CANDIDATE DATA:
- Name: ${candidate.full_name || candidate.name}
- Trade/License: ${candidate.license_type || "Unknown"}
- License Number: ${candidate.license_number || "Not found"}
- License Expiry: ${candidate.license_expiry || "Unknown"}
- Location: ${candidate.city || "Michigan"}, ${candidate.state || "MI"}

RESEARCH FINDINGS:
${JSON.stringify(sonarData, null, 2)}

CRITICAL RULES:
- Do NOT mention AI, algorithms, databases, data sources, web scraping, or any methodology.
- Write as a human hiring researcher would.
- Be specific and actionable.

Return JSON: { "qualifications_summary": "...", "hiring_recommendation": "..." }`;

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
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { qualifications_summary: "", hiring_recommendation: "" };

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(text);
    if (!parsed) return { qualifications_summary: "", hiring_recommendation: "" };

    return {
      qualifications_summary: (parsed.qualifications_summary as string) || "",
      hiring_recommendation: (parsed.hiring_recommendation as string) || "",
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

  // Get up to 10 pending candidates per run (already-complete skipped by query)
  const { data: candidates, error: fetchErr } = await sb
    .from("hire_alert_candidates")
    .select("id, full_name, name, license_type, license_number, license_expiry, city, state, email, phone, source, raw_data")
    .eq("enrichment_status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

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

      // Sonar OSINT enrichment
      const sonarData = await enrichViaSonar(candidate);

      // AI Synthesis
      const { qualifications_summary, hiring_recommendation } = await synthesize(candidate, sonarData);

      // Build update object
      const update: Record<string, unknown> = {
        enrichment_status: "complete",
        enriched_at: new Date().toISOString(),
      };

      // Merge Sonar data
      if (sonarData.linkedin_url) update.linkedin_url = sonarData.linkedin_url;
      if (sonarData.facebook_url) update.facebook_url = sonarData.facebook_url;
      if (sonarData.current_employer) update.current_employer = sonarData.current_employer;
      if (sonarData.current_title) update.current_title = sonarData.current_title;
      if (sonarData.years_experience) update.years_experience = sonarData.years_experience;
      if (sonarData.email && !candidate.email) update.email = sonarData.email;
      if (sonarData.phone && !candidate.phone) update.phone = sonarData.phone;

      // Social profiles aggregate
      const socialProfiles: Record<string, unknown> = {};
      if (sonarData.linkedin_url) socialProfiles.linkedin = sonarData.linkedin_url;
      if (sonarData.facebook_url) socialProfiles.facebook = sonarData.facebook_url;
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
