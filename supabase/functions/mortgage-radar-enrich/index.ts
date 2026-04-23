// Mortgage Radar enrichment — for each lead missing owner name/phone/email,
// run Sonar (Lovable AI Gateway) → PDL Person Search by address waterfall.
// FCRA-clean: only public-record / OSINT signals, no credit-bureau data.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

type EnrichResult = {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  source: string;
};

async function sonarEnrich(address: string, city: string, zip: string): Promise<EnrichResult | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const prompt = `Find the current homeowner of record for this Michigan property using ONLY public county assessor / property records and OSINT. Return strict JSON.

Property: ${address}, ${city || ""} ${zip || ""}

Return JSON shape: {"full_name": string|null, "phone": string|null, "email": string|null, "confidence": "high"|"medium"|"low", "source_note": string}

Rules:
- Only use public county assessor records, voter rolls, or openly published OSINT.
- Do NOT fabricate. If unknown, return null.
- No credit bureau data, no Spokeo/BeenVerified scrapes.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an FCRA-compliant public records researcher. Output strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (parsed.confidence === "low") return null;
    return {
      full_name: parsed.full_name || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      source: `sonar:${parsed.confidence || "unknown"}`,
    };
  } catch (e) {
    console.warn("[sonar]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function pdlEnrich(address: string, city: string, zip: string): Promise<EnrichResult | null> {
  if (!PDL_API_KEY) return null;
  try {
    // PDL Person Search by location
    const query = {
      query: {
        bool: {
          must: [
            { match: { "location_street_address": address.toLowerCase() } },
            ...(zip ? [{ match: { "location_postal_code": zip } }] : []),
            ...(city ? [{ match: { "location_locality": city.toLowerCase() } }] : []),
          ],
        },
      },
      size: 1,
    };
    const res = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: { "X-Api-Key": PDL_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.data?.[0];
    if (!p) return null;
    return {
      full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      phone: p.mobile_phone || (p.phone_numbers?.[0]) || null,
      email: p.work_email || p.personal_emails?.[0] || (p.emails?.[0]?.address) || null,
      source: "pdl:person_search",
    };
  } catch (e) {
    console.warn("[pdl]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: { lead_id?: string; limit?: number } = {};
  try { body = await req.json(); } catch { /* GET / no body */ }

  // Single-lead enrich (for per-row button) OR batch (for "Enrich all")
  const query = (sb.from as any)("mortgage_radar_leads")
    .select("id, address, city, zip, full_name, phone, email")
    .or("full_name.is.null,phone.is.null,email.is.null")
    .order("score", { ascending: false });

  if (body.lead_id) query.eq("id", body.lead_id);
  else query.limit(Math.min(Math.max(body.limit ?? 10, 1), 25));

  const { data: leads, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const trace: Array<Record<string, unknown>> = [];
  let enriched = 0;

  for (const lead of (leads || [])) {
    if (!lead.address) {
      trace.push({ id: lead.id, skipped: "no address" });
      continue;
    }
    const step: Record<string, unknown> = { id: lead.id, address: lead.address };

    let result: EnrichResult | null = null;

    // Step 1 — Sonar (cheap, public records)
    result = await sonarEnrich(lead.address, lead.city || "", lead.zip || "");
    step.sonar = result ? `hit:${result.source}` : "miss";

    // Step 2 — PDL fallback if Sonar missed phone OR email
    if (!result || !result.phone || !result.email) {
      const pdl = await pdlEnrich(lead.address, lead.city || "", lead.zip || "");
      step.pdl = pdl ? "hit" : "miss";
      if (pdl) {
        result = {
          full_name: result?.full_name || pdl.full_name,
          phone: result?.phone || pdl.phone,
          email: result?.email || pdl.email,
          source: result ? `${result.source}+pdl` : pdl.source,
        };
      }
    }

    if (result && (result.full_name || result.phone || result.email)) {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (result.full_name && !lead.full_name) update.full_name = result.full_name;
      if (result.phone && !lead.phone) update.phone = result.phone;
      if (result.email && !lead.email) update.email = result.email;
      await (sb.from as any)("mortgage_radar_leads").update(update).eq("id", lead.id);
      step.applied = update;
      enriched += 1;
    } else {
      step.applied = "none";
    }
    trace.push(step);
  }

  return new Response(JSON.stringify({ ok: true, processed: leads?.length || 0, enriched, trace }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
