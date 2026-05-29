// api-budget.ts — shared daily spend gate. All values in USD cents.
// Call checkAndConsume() before any batch of paid external API calls.
// Returns { allowed: false } when the daily cap would be exceeded.
// Tracks spend in api_usage_daily table; fails OPEN if DB is unreachable
// (never block revenue-generating outreach due to a tracking failure).
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Hard ceiling across ALL services combined. No single day can exceed this
// regardless of individual per-service caps.
export const TOTAL_DAILY_CAP_CENTS = 500;  // $5.00/day

// Daily caps in USD cents ($1 = 100¢)
export const DAILY_CAPS_CENTS: Record<string, number> = {
  google_maps:  150,   // $1.50/day → ~88 Details calls or ~47 Text Searches
  apollo:        50,   // $0.50/day
  firecrawl:     50,   // $0.50/day
  hunter:        25,   // $0.25/day
  llm_haiku:     50,   // $0.50/day
  llm_opus:     100,   // $1.00/day
  twilio_sms:   100,   // $1.00/day
  resend:        50,   // $0.50/day (generous free tier)
  dalle:         25,   // $0.25/day ≈ 6 standard images
};

// Cost per API call in USD cents
export const COSTS_CENTS: Record<string, number> = {
  google_maps_text_search:  3.2,   // $32/1000
  google_maps_details:      1.7,   // $17/1000
  google_maps_validation:   0.5,   // $5/1000
  apollo_people_search:     1.0,
  apollo_org_enrich:        2.0,
  firecrawl_scrape:         5.0,
  hunter_find:              1.0,
  twilio_sms:               0.8,
  llm_haiku_1k:             0.025,
  llm_opus_1k:              1.5,
  dalle_image:              4.0,   // $0.04 per 1024x1024 standard image
};

export async function checkAndConsume(
  sb: SupabaseClient,
  service: string,
  units: number,
  costType: string,
): Promise<{ allowed: boolean; remaining_cents: number }> {
  const costCents = (COSTS_CENTS[costType] ?? 0) * units;
  const cap = DAILY_CAPS_CENTS[service] ?? 0;
  if (cap === 0) return { allowed: true, remaining_cents: Infinity };

  const today = new Date().toISOString().slice(0, 10);
  try {
    // Fetch per-service row and all-service total in parallel
    const [{ data: row }, { data: allRows }] = await Promise.all([
      sb
        .from("api_usage_daily")
        .select("cents_used")
        .eq("service", service)
        .eq("usage_date", today)
        .maybeSingle(),
      sb
        .from("api_usage_daily")
        .select("cents_used")
        .eq("usage_date", today),
    ]);

    const used = (row?.cents_used as number) ?? 0;
    const totalUsed = (allRows ?? []).reduce((sum: number, r: any) => sum + (Number(r.cents_used) || 0), 0);

    // Check per-service cap
    if (used + costCents > cap) {
      console.warn(`[api-budget] ${service} daily cap hit: ${used.toFixed(1)}/${cap}¢ used`);
      return { allowed: false, remaining_cents: Math.max(0, cap - used) };
    }

    // Check global $5/day ceiling
    if (totalUsed + costCents > TOTAL_DAILY_CAP_CENTS) {
      console.warn(`[api-budget] GLOBAL daily cap hit: ${totalUsed.toFixed(1)}/${TOTAL_DAILY_CAP_CENTS}¢ total used (${service} requested ${costCents}¢)`);
      return { allowed: false, remaining_cents: Math.max(0, TOTAL_DAILY_CAP_CENTS - totalUsed) };
    }

    await sb
      .from("api_usage_daily")
      .upsert(
        { service, usage_date: today, cents_used: used + costCents, updated_at: new Date().toISOString() },
        { onConflict: "service,usage_date" },
      )
      .catch(() => {});

    return { allowed: true, remaining_cents: Math.min(cap - used - costCents, TOTAL_DAILY_CAP_CENTS - totalUsed - costCents) };
  } catch (e) {
    // Fail open — tracking DB error must never block outreach
    console.warn("[api-budget] tracking error (failing open):", e instanceof Error ? e.message : e);
    return { allowed: true, remaining_cents: cap };
  }
}
