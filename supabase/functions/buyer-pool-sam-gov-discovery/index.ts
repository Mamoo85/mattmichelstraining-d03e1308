// buyer-pool-sam-gov-discovery — uses SAM_GOV_API_KEY. Federal-contractor universe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES } from "../_shared/pool-recipes.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SAM = Deno.env.get("SAM_GOV_API_KEY") || "";

function domainOf(w?: string | null): string | null {
  if (!w) return null;
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!SAM) return new Response(JSON.stringify({ ok: false, error: "SAM_GOV_API_KEY missing" }), { status: 500, headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    if (!recipe.naics?.length) { out.push({ pool, skipped: "no_naics" }); continue; }
    let inserted = 0;
    const cap = recipe.per_run ?? 30;
    outer: for (const state of recipe.states) {
      for (const naics of recipe.naics) {
        if (inserted >= cap) break outer;
        const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${SAM}&naicsCode=${naics}&physicalAddressProvinceOrStateCode=${state}&samRegistered=Yes&registrationStatus=A&samWaiverIndicator=&entityEFTIndicator=&pageSize=20&page=0`;
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const j = await r.json();
          const ents = j?.entityData ?? [];
          for (const e of ents) {
            if (inserted >= cap) break;
            const reg = e?.entityRegistration ?? {};
            const core = e?.coreData ?? {};
            const poc = (e?.pointsOfContact?.governmentBusinessPOC) || (e?.pointsOfContact?.electronicBusinessPOC) || {};
            const addr = core?.physicalAddress ?? {};
            const company = reg?.legalBusinessName;
            if (!company) continue;
            const { error } = await sb.from("raw_buyer_candidates").insert({
              pool,
              source: "sam_gov",
              company_name: company,
              domain: domainOf(core?.entityInformation?.entityURL),
              contact_name: poc?.firstName ? `${poc.firstName} ${poc.lastName ?? ""}`.trim() : null,
              contact_title: poc?.title || null,
              contact_email: poc?.email || null,
              contact_phone: poc?.phoneNumber || null,
              city: addr?.city || null,
              state: addr?.stateOrProvinceCode || state,
              zip: addr?.zipCode || null,
              raw_payload: { naics, ueiSAM: reg?.ueiSAM, cageCode: reg?.cageCode },
            });
            if (!error) inserted++;
          }
        } catch { /* continue */ }
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "sam_gov", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});
