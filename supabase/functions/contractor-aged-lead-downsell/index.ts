// contractor-aged-lead-downsell — daily cron 2pm ET
// Dutch auction: unclaimed leads decay through 3 price tiers over 96h.
// Tier 1 (48-72h): $35 — first markdown
// Tier 2 (72-96h): $20 — second markdown
// Tier 3 (96h+):   $10 — final clearance
// aged_tier column tracks which tier has been sent (0=fresh, 1=$35, 2=$20, 3=$10)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1`;

interface Tier {
  label: string;
  priceCents: number;
  minAge: number; // hours
  maxAge: number; // hours (Infinity = no upper bound)
  nextTier: number;
}

const TIERS: Tier[] = [
  { label: "First Markdown",    priceCents: 3500, minAge: 48, maxAge: 72,        nextTier: 1 },
  { label: "Second Markdown",   priceCents: 2000, minAge: 72, maxAge: 96,        nextTier: 2 },
  { label: "Final Clearance",   priceCents: 1000, minAge: 96, maxAge: Infinity,  nextTier: 3 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = Date.now();
    let totalBlasted = 0;

    for (const tier of TIERS) {
      const minCutoff = new Date(now - tier.maxAge * 3600000).toISOString();
      const maxCutoff = new Date(now - tier.minAge * 3600000).toISOString();

      // aged_tier = previous tier index (0 for first, 1 for second, 2 for third)
      const prevTier = tier.nextTier - 1;

      const query = sb
        .from("contractor_leads")
        .select("id, project_type, contractor_lead_sites(trade, city)")
        .eq("status", "new")
        .eq("aged_tier", prevTier)
        .lte("created_at", maxCutoff);

      // Only apply upper age bound for tiers 1 and 2
      const { data: agedLeads } = tier.maxAge < Infinity
        ? await query.gte("created_at", minCutoff).limit(20)
        : await query.limit(20);

      if (!agedLeads?.length) continue;

      console.log(`[aged-downsell] Tier ${tier.nextTier} (${tier.label}): ${agedLeads.length} leads @ $${tier.priceCents / 100}`);

      const { data: contractors } = await sb
        .from("contractor_clients")
        .select("id, phone")
        .eq("active", true)
        .limit(50);

      if (!contractors?.length) continue;

      for (const lead of agedLeads) {
        try {
          await sb.from("contractor_leads")
            .update({ aged_tier: tier.nextTier, is_aged: tier.nextTier >= 3 })
            .eq("id", lead.id);

          const site = (lead as any).contractor_lead_sites;
          const trade = site?.trade || lead.project_type || "Service";
          const city = site?.city || "Metro Detroit";
          const priceLabel = `$${tier.priceCents / 100}`;
          const checkoutUrl = `${FUNCTIONS_URL}/create-aged-lead-checkout?lead_id=${lead.id}`;

          const msgMap: Record<number, string> = {
            1: `Price Drop: Homeowner in ${city} still needs ${trade} work. Marked down to ${priceLabel}. Claim it: ${checkoutUrl}&cid=`,
            2: `${trade} lead in ${city} — dropping to ${priceLabel}. Getting cleared out soon: ${checkoutUrl}&cid=`,
            3: `Final: ${trade} lead in ${city} down to ${priceLabel}. Last call before we archive it: ${checkoutUrl}&cid=`,
          };

          for (const contractor of contractors) {
            if (!contractor.phone) continue;
            await sendSMS(
              contractor.phone,
              TWILIO_PHONE_NUMBER,
              msgMap[tier.nextTier] + contractor.id,
              "contractor_leads"
            );
          }

          totalBlasted++;
        } catch (e) {
          console.error(`[aged-downsell] Error for lead ${lead.id}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, blasted: totalBlasted }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[aged-downsell] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
