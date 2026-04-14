import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

async function sonarEnrich(fullName: string, trade: string): Promise<Record<string, string | null>> {
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
    });

    if (!res.ok) {
      console.error(`Sonar ${res.status} for ${fullName}`);
      return {};
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from markdown-wrapped response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`Sonar error for ${fullName}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get unenriched boiler candidates
    const { data: candidates, error } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, license_type, trade, current_employer")
      .or("trade.ilike.%boiler%,license_type.ilike.%boiler%,license_type.ilike.%stationary%")
      .is("current_employer", null)
      .limit(5); // small batch

    if (error) throw error;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ message: "No unenriched candidates found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Enriching ${candidates.length} candidates...`);
    let enriched = 0;

    // Process sequentially to avoid rate limits
    for (const c of candidates) {
      const result = await sonarEnrich(c.full_name, c.license_type || c.trade || "Boiler Operator");
      
      if (result.employer || result.email || result.phone || result.linkedin_url) {
        const updateData: Record<string, unknown> = {};
        if (result.employer) updateData.current_employer = result.employer;
        if (result.title) updateData.current_title = result.title;
        if (result.city) updateData.city = result.city;
        if (result.phone) updateData.phone = result.phone;
        if (result.email) updateData.email = result.email;
        if (result.linkedin_url) updateData.linkedin_url = result.linkedin_url;
        if (result.facebook_url) updateData.facebook_url = result.facebook_url;
        if (result.years_experience) updateData.years_experience = parseInt(String(result.years_experience)) || null;

        const { error: updateErr } = await sb
          .from("hire_alert_candidates")
          .update(updateData)
          .eq("id", c.id);

        if (!updateErr) {
          enriched++;
          console.log(`✅ ${c.full_name}: ${result.employer || "no employer"} | ${result.phone || "no phone"}`);
        }
      } else {
        console.log(`❌ ${c.full_name}: no data found`);
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total: candidates.length, 
      enriched,
      remaining: candidates.length - enriched 
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
