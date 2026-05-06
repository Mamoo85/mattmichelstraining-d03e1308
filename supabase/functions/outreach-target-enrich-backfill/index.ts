// Backfill missing contact fields on outreach_targets.
// Runs every 6h via pg_cron. Pulls oldest-stale rows missing email or fax.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";
import { extractFaxNumber } from "../_shared/firecrawl.ts";
import { resolveDomain } from "../_shared/domain-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: rows, error } = await sb
    .from("outreach_targets")
    .select("id, business_name, email, fax, phone, website, city, state, vertical")
    .or("email.is.null,fax.is.null")
    .order("last_enriched_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let emailFound = 0, faxFound = 0, websiteResolved = 0, errors = 0;

  for (const r of rows ?? []) {
    try {
      const updates: Record<string, unknown> = { last_enriched_at: new Date().toISOString() };

      // Resolve website if missing or aggregator
      let website = r.website as string | null;
      if (!website) {
        website = await resolveDomain({
          businessName: r.business_name as string,
          city: r.city as string | undefined,
          state: r.state as string | undefined,
        });
        if (website) { updates.website = website; websiteResolved++; }
      }

      // Email waterfall if missing
      if (!r.email) {
        const wf = await runEmailWaterfall(sb as any, {
          business_name: r.business_name as string,
          domain: website ? website.replace(/^https?:\/\//, "") : undefined,
          city: r.city as string | undefined,
          state: r.state as string | undefined,
        } as any).catch(() => null);
        if (wf?.email) { updates.email = wf.email; emailFound++; }
      }

      // Fax via Firecrawl on website
      if (!r.fax && website) {
        const fax = await extractFaxNumber(website).catch(() => null);
        if (fax) { updates.fax = fax; faxFound++; }
      }

      await sb.from("outreach_targets").update(updates).eq("id", r.id);
    } catch (err) {
      errors++;
      console.error(`backfill error for ${r.id}:`, err);
    }
  }

  return new Response(JSON.stringify({
    ok: true, scanned: rows?.length ?? 0, emailFound, faxFound, websiteResolved, errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
