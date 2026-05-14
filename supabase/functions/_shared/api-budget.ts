import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const DAILY_CAPS_CENTS: Record<string, number> = {
  google_maps: 150, apollo: 50, firecrawl: 50, hunter: 25, llm_haiku: 50, llm_opus: 100, twilio_sms: 100,
};
export const COSTS_CENTS: Record<string, number> = {
  google_maps_text_search: 3.2, google_maps_details: 1.7, google_maps_validation: 0.5,
  apollo_people_search: 1.0, firecrawl_scrape: 5.0, hunter_find: 1.0, twilio_sms: 0.8,
};
export async function checkAndConsume(sb: SupabaseClient, service: string, units: number, costType: string): Promise<{ allowed: boolean; remaining_cents: number }> {
  const costCents = (COSTS_CENTS[costType] ?? 0) * units;
  const cap = DAILY_CAPS_CENTS[service] ?? 0;
  if (cap === 0) return { allowed: true, remaining_cents: Infinity };
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data: row } = await sb.from("api_usage_daily").select("cents_used").eq("service", service).eq("usage_date", today).maybeSingle();
    const used = (row?.cents_used as number) ?? 0;
    if (used + costCents > cap) { console.warn(`[api-budget] ${service} cap hit: ${used}/${cap}¢`); return { allowed: false, remaining_cents: Math.max(0, cap - used) }; }
    await sb.from("api_usage_daily").upsert({ service, usage_date: today, cents_used: used + costCents, updated_at: new Date().toISOString() }, { onConflict: "service,usage_date" }).catch(() => {});
    return { allowed: true, remaining_cents: cap - used - costCents };
  } catch { return { allowed: true, remaining_cents: cap }; }
}
