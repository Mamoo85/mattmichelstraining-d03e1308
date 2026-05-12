/**
 * enrich-lo-prospect
 * Apollo people search → Sonar (Perplexity via OpenRouter) fallback.
 * Fills email, phone, fax on marketplace_prospects rows.
 *
 * POST { prospect_ids?: string[], limit?: number }
 *   - If prospect_ids: enrich exactly those rows
 *   - Else: enrich up to `limit` unenriched active rows (default 20)
 *
 * Secrets needed: APOLLO_API_KEY (optional), OPENROUTER_API_KEY (already set)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEnrichment } from "../_shared/enrichment-audit.ts";
import { apolloPeopleSearch, hasApolloKey } from "../_shared/apollo.ts";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";
import { resolveDomain } from "../_shared/domain-resolver.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EnrichResult = { email?: string; phone?: string; source: string };

async function enrichViaApollo(name: string, company: string | null): Promise<EnrichResult> {
  if (!hasApolloKey()) return { source: "none" };
  try {
    const people = await apolloPeopleSearch({
      name,
      organization_name: company || undefined,
      person_titles: ["loan officer", "mortgage loan officer", "MLO", "mortgage banker"],
      person_locations: ["Michigan"],
      page: 1,
      per_page: 1,
    });
    const person = people?.[0];
    if (!person) return { source: "none" };
    return {
      email: person.email || undefined,
      phone: (person.phone_numbers as any)?.[0]?.sanitized_number || (person.phone_numbers as any)?.[0]?.raw_number || undefined,
      source: "apollo",
    };
  } catch {
    return { source: "none" };
  }
}

async function enrichViaSonar(name: string, company: string | null): Promise<EnrichResult> {
  if (!OPENROUTER_API_KEY) return { source: "none" };
  const query = company
    ? `"${name}" "${company}" Michigan mortgage loan officer contact email phone`
    : `"${name}" Michigan mortgage loan officer contact email site:linkedin.com OR site:zillow.com`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [
          {
            role: "user",
            content: `Find contact info for this Michigan mortgage loan officer.\n\nReturn ONLY a valid JSON object with these exact keys: "email", "phone". Set value to null if not found. No other text.\n\nSearch: ${query}`,
          },
        ],
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { source: "none" };
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return { source: "none" };
    const parsed = JSON.parse(match[0]);
    if (!parsed.email && !parsed.phone) return { source: "none" };
    return {
      email: parsed.email || undefined,
      phone: parsed.phone || undefined,
      source: "sonar",
    };
  } catch {
    return { source: "none" };
  }
}

function computeWarmth(row: any, result: EnrichResult): number {
  const hasEmail = result.email || row.email;
  const hasPhone = result.phone || row.phone;
  const hasCity = Boolean(row.city);
  return (hasEmail ? 2 : 0) + (hasPhone ? 2 : 0) + (hasCity ? 1 : 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit: number = body.limit ?? 20;

    let q = (sb.from as any)("marketplace_prospects").select("*");
    if (body.prospect_ids?.length) {
      q = q.in("id", body.prospect_ids);
    } else {
      q = q.is("enriched_at", null).order("created_at", { ascending: true }).limit(limit);
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows?.length) {
      return new Response(
        JSON.stringify({ ok: true, enriched: 0, note: "No unenriched prospects found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let enriched = 0;

    for (const row of rows) {
      // Apollo first, Sonar fallback — both wrapped in audit envelopes
      const apolloAudit = await logEnrichment<EnrichResult>(
        {
          lead_id: row.id,
          vertical: "prospect",
          function_name: "enrich-lo-prospect",
          stage: "paid",
          provider: "apollo",
          triggered_by: body.prospect_ids?.length ? "manual" : "cron",
          cost_cents: hasApolloKey() ? 1 : 0,
        },
        async () => {
          const r = await enrichViaApollo(row.full_name, row.company);
          const fields: string[] = [];
          if (r.email) fields.push("email");
          if (r.phone) fields.push("phone");
          return { data: r, fields_added: fields };
        },
      );
      let result: EnrichResult = apolloAudit.data || { source: "none" };

      // Stage 2: Full email-waterfall (site_scrape → snov → apollo-by-domain →
      // pattern_verify → hunter → PDL → free tiers). Resolves a website via
      // Google Places when one isn't already on the row, then runs the same
      // multi-source scraper waterfall used by Trade Radar / SiteRadar.
      if (result.source === "none" || (!result.email && !result.phone)) {
        const [firstName, ...rest] = (row.full_name || "").trim().split(/\s+/);
        const lastName = rest.join(" ") || null;
        let website = row.website || null;
        if (!website && row.company) {
          try {
            website = await resolveDomain({
              businessName: row.company,
              city: row.city || undefined,
              state: row.state || "MI",
            });
          } catch { /* fail open */ }
        }

        const waterfallAudit = await logEnrichment<EnrichResult>(
          {
            lead_id: row.id,
            vertical: "prospect",
            function_name: "enrich-lo-prospect",
            stage: "free",
            provider: "email_waterfall",
            triggered_by: body.prospect_ids?.length ? "manual" : "cron",
          },
          async () => {
            const w = await runEmailWaterfall(sb, {
              website,
              business_name: row.company,
              city: row.city,
              state: row.state || "MI",
              contact_first_name: firstName || null,
              contact_last_name: lastName,
            });
            const r: EnrichResult = w.email
              ? { email: w.email, source: w.source || "waterfall" }
              : { source: "none" };
            const fields: string[] = [];
            if (r.email) fields.push("email");
            return { data: r, fields_added: fields };
          },
        );
        const wResult = waterfallAudit.data;
        if (wResult?.email) result = wResult;

        // Persist resolved website for future passes
        if (website && !row.website) {
          try { await (sb.from as any)("marketplace_prospects").update({ website }).eq("id", row.id); } catch { /* best-effort */ }
        }
      }

      // Stage 3: Sonar last-resort (LLM web search)
      if (result.source === "none" || (!result.email && !result.phone)) {
        const sonarAudit = await logEnrichment<EnrichResult>(
          {
            lead_id: row.id,
            vertical: "prospect",
            function_name: "enrich-lo-prospect",
            stage: "free",
            provider: "sonar",
            triggered_by: body.prospect_ids?.length ? "manual" : "cron",
          },
          async () => {
            const r = await enrichViaSonar(row.full_name, row.company);
            const fields: string[] = [];
            if (r.email) fields.push("email");
            if (r.phone) fields.push("phone");
            return { data: r, fields_added: fields };
          },
        );
        result = sonarAudit.data || result;
      }

      const updates: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
        notes: `enriched_via:${result.source}; warmth:${computeWarmth(row, result)}`,
        updated_at: new Date().toISOString(),
      };
      if (result.email && !row.email) updates.email = result.email;
      if (result.phone && !row.phone) updates.phone = result.phone;

      await (sb.from as any)("marketplace_prospects").update(updates).eq("id", row.id);
      enriched++;
    }

    return new Response(
      JSON.stringify({ ok: true, enriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
