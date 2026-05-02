// Backfill enrichment for outreach_targets missing email/fax/phone.
// Runs every 6h via pg_cron. Drains 50 records/run, calls email-waterfall + firecrawl fax.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { firecrawlScrape, extractFaxNumber, extractContactInfo } from "../_shared/firecrawl.ts";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const summary = { scanned: 0, enriched_email: 0, enriched_fax: 0, enriched_phone: 0, errors: 0 };

  try {
    // Find targets missing key contact data, with a website to scrape
    const { data: targets, error } = await sb
      .from("outreach_targets")
      .select("id, business_name, website, email, fax, phone, address_line1, city, state")
      .or("email.is.null,fax.is.null,phone.is.null")
      .not("website", "is", null)
      .lt("enrichment_attempts", 3)
      .order("updated_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    summary.scanned = targets?.length ?? 0;

    for (const t of targets ?? []) {
      try {
        const updates: Record<string, any> = {
          enrichment_attempts: 1, // incremented via RPC below if exists, else just mark
          last_enriched_at: new Date().toISOString(),
        };

        // Scrape contact page once
        const scraped = t.website ? await firecrawlScrape(t.website).catch(() => null) : null;
        const html = (scraped as any)?.html || (scraped as any)?.markdown || "";

        if (!t.email) {
          const result = await runEmailWaterfall({
            businessName: t.business_name,
            website: t.website,
            city: t.city,
            state: t.state,
          }).catch(() => null);
          if (result?.email) {
            updates.email = result.email;
            summary.enriched_email++;
          }
        }

        if (!t.fax && html) {
          const fax = extractFaxNumber(html);
          if (fax) { updates.fax = fax; summary.enriched_fax++; }
        }

        if (!t.phone && html) {
          const info = extractContactInfo(html);
          if (info?.phone) { updates.phone = info.phone; summary.enriched_phone++; }
        }

        // Use RPC-style increment if you have one, otherwise simple update
        await sb.from("outreach_targets")
          .update({ ...updates, enrichment_attempts: ((t as any).enrichment_attempts ?? 0) + 1 })
          .eq("id", t.id);
      } catch (e) {
        summary.errors++;
        console.error(`Backfill error for ${t.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Backfill fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e), summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
