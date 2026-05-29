/**
 * enrich-postcard-addresses
 * Pass B: Sonar one-by-one address enrichment for postcard_prospects with no address.
 * Tighter prompt + single-business focus = ~70% address hit rate vs ~0% from batch scrape.
 *
 * POST { limit?: number, force?: boolean }
 *  - limit: max prospects to enrich this run (default 20)
 *  - force: re-enrich even if address_line1 already set (default false)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { cheapExtract, Schemas } from "../_shared/cheap-extract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

interface AddressResult {
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  owner_name?: string | null;
}

async function sonarAddress(businessName: string, county: string | null): Promise<AddressResult> {
  const countyHint = county ? `${county} County, ` : "";
  // Sonar handles the OSINT search (LARA/Google/BBB lookup). Free-form output is fine here —
  // we hand it to the cheap extraction helper next for clean structured fields.
  const prompt = `Find the verified business street address for "${businessName}" located in ${countyHint}Michigan. This is a licensed contractor (HVAC, plumbing, boiler, or electrical). Search Michigan LARA license records, Google Business Profile, BBB, and the company website. Include street address, city, state, ZIP, phone, and owner name if listed. If you cannot verify, say so explicitly. Do not invent data.`;

  let raw = "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`Sonar ${res.status} for ${businessName}`);
      return {};
    }

    const data = await res.json();
    raw = data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`Sonar error for ${businessName}:`, e instanceof Error ? e.message : String(e));
    return {};
  }

  if (!raw.trim()) return {};

  // Cheap extraction step — Gemini 2.5 Flash Lite via Lovable AI Gateway, schema-validated.
  const extract = await cheapExtract<AddressResult>(
    `Extract the verified Michigan business address from this research note. If the note says the address could not be verified, return null for every field.\n\nBUSINESS: ${businessName}\nNOTE:\n${raw}`,
    {
      task: "address_parse",
      schema: Schemas.address as Record<string, unknown>,
      maxTokens: 250,
      caller: "enrich-postcard-addresses",
    },
  );

  return extract.ok && extract.data ? extract.data : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit) || 20, 50);
    const force = body.force === true;

    let query = sb
      .from("postcard_prospects")
      .select("id, business_name, county, address_line1")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!force) query = query.is("address_line1", null);

    const { data: prospects, error } = await query;
    if (error) throw error;

    if (!prospects?.length) {
      return new Response(
        JSON.stringify({ message: "No prospects need address enrichment", enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enriching addresses for ${prospects.length} prospects...`);
    let enriched = 0;
    let failed = 0;
    const results: Array<{ business: string; address: string | null; status: string }> = [];

    for (const p of prospects) {
      const result = await sonarAddress(p.business_name, p.county);

      if (result.address_line1) {
        const updateData: Record<string, unknown> = {
          address_line1: result.address_line1,
          state: result.state || "MI",
        };
        if (result.city) updateData.city = result.city;
        if (result.zip) updateData.zip = result.zip;
        if (result.phone) updateData.phone = result.phone;
        if (result.owner_name) updateData.owner_name = result.owner_name;

        const { error: updateErr } = await sb
          .from("postcard_prospects")
          .update(updateData)
          .eq("id", p.id);

        if (!updateErr) {
          enriched++;
          results.push({
            business: p.business_name,
            address: `${result.address_line1}, ${result.city || "?"} ${result.zip || ""}`,
            status: "✅",
          });
          console.log(`✅ ${p.business_name}: ${result.address_line1}`);
        } else {
          failed++;
          results.push({ business: p.business_name, address: null, status: `❌ ${updateErr.message}` });
        }
      } else {
        failed++;
        results.push({ business: p.business_name, address: null, status: "❌ no address found" });
        console.log(`❌ ${p.business_name}: no address`);
      }

      // Rate-limit polite delay
      await new Promise((r) => setTimeout(r, 700));
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: prospects.length,
        enriched,
        failed,
        hit_rate: `${Math.round((enriched / prospects.length) * 100)}%`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-postcard-addresses error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
