import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

interface EnrichResult {
  employer?: string | null;
  title?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  years_experience?: string | number | null;
}

async function sonarEnrich(fullName: string, trade: string): Promise<EnrichResult> {
  if (!OPENROUTER_API_KEY) return {};
  const query = `Find the current employer, job title, city, phone number, email address, and LinkedIn profile URL for "${fullName}" who is a licensed ${trade} in Michigan. Return ONLY a JSON object with keys: employer, title, city, phone, email, linkedin_url, facebook_url, years_experience. Use null for any field you cannot find.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: query }],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`Sonar ${res.status} for ${fullName}`);
      return {};
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`Sonar error for ${fullName}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

async function pdlEnrich(fullName: string, city?: string | null): Promise<EnrichResult> {
  if (!PDL_API_KEY) return {};
  try {
    const params = new URLSearchParams({
      name: fullName,
      ...(city ? { locality: city } : {}),
      pretty: "false",
    });
    const url = `https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}&country=united%20states&region=michigan`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      if (res.status !== 404) console.error(`PDL ${res.status} for ${fullName}`);
      return {};
    }
    const data = await res.json();
    if (data?.status !== 200 || !data?.data) return {};
    const d = data.data;
    return {
      employer: d.job_company_name || null,
      title: d.job_title || null,
      city: d.location_locality || null,
      phone: d.mobile_phone || (d.phone_numbers?.[0] ?? null),
      email: d.work_email || (d.personal_emails?.[0] ?? null),
      linkedin_url: d.linkedin_url || null,
      facebook_url: d.facebook_url || null,
      years_experience: d.experience?.length || null,
    };
  } catch (e) {
    console.error(`PDL error for ${fullName}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

function merge(a: EnrichResult, b: EnrichResult): EnrichResult {
  return {
    employer: a.employer || b.employer || null,
    title: a.title || b.title || null,
    city: a.city || b.city || null,
    phone: a.phone || b.phone || null,
    email: a.email || b.email || null,
    linkedin_url: a.linkedin_url || b.linkedin_url || null,
    facebook_url: a.facebook_url || b.facebook_url || null,
    years_experience: a.years_experience || b.years_experience || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let batchSize = 10;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.batch_size === "number") batchSize = Math.min(50, Math.max(1, body.batch_size));
      } catch (_) { /* no body */ }
    }

    // Target the contactless candidates regardless of trade — this is the 94% problem.
    const { data: candidates, error } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, name, license_type, trade, city, phone, email, linkedin_url, current_employer")
      .is("email", null)
      .is("phone", null)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(batchSize);

    if (error) throw error;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ message: "No contactless candidates found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Enriching ${candidates.length} contactless candidates (Sonar + PDL waterfall)...`);
    let enriched = 0;
    let pdlHits = 0;
    let sonarHits = 0;

    for (const c of candidates) {
      const name = c.full_name || c.name;
      if (!name) continue;
      const trade = c.license_type || c.trade || "tradesperson";

      // Sonar first (fast, cheap, broad)
      const sonarResult = await sonarEnrich(name, trade);
      const sonarHit = !!(sonarResult.email || sonarResult.phone || sonarResult.linkedin_url);
      if (sonarHit) sonarHits++;

      // PDL fallback if Sonar didn't return contact info
      let pdlResult: EnrichResult = {};
      if (!sonarResult.email && !sonarResult.phone) {
        pdlResult = await pdlEnrich(name, c.city);
        if (pdlResult.email || pdlResult.phone) pdlHits++;
      }

      const merged = merge(sonarResult, pdlResult);

      if (merged.employer || merged.email || merged.phone || merged.linkedin_url) {
        const updateData: Record<string, unknown> = {};
        if (merged.employer && !c.current_employer) updateData.current_employer = merged.employer;
        if (merged.title) updateData.current_title = merged.title;
        if (merged.city && !c.city) updateData.city = merged.city;
        if (merged.phone) updateData.phone = merged.phone;
        if (merged.email) updateData.email = merged.email;
        if (merged.linkedin_url && !c.linkedin_url) updateData.linkedin_url = merged.linkedin_url;
        if (merged.facebook_url) updateData.facebook_url = merged.facebook_url;
        if (merged.years_experience) {
          const yrs = parseInt(String(merged.years_experience));
          if (!isNaN(yrs)) updateData.years_experience = yrs;
        }
        updateData.enrichment_status = "complete";
        updateData.enriched_at = new Date().toISOString();

        const { error: updateErr } = await sb
          .from("hire_alert_candidates")
          .update(updateData)
          .eq("id", c.id);

        if (!updateErr) {
          enriched++;
          console.log(`✅ ${name}: ${merged.employer || "?"} | ${merged.phone || merged.email || "?"}`);
        }
      } else {
        console.log(`❌ ${name}: no data`);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "batch-enrich-candidates",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { total: candidates.length, enriched, sonar_hits: sonarHits, pdl_hits: pdlHits },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      success: true,
      total: candidates.length,
      enriched,
      sonar_hits: sonarHits,
      pdl_hits: pdlHits,
      remaining: candidates.length - enriched,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-enrich error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
