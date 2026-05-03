// Per-provider daily budget gate for enrichment calls.
// Reads enrichment_walker_config (apollo/hunter/firecrawl_daily_budget_usd) and
// today's spend from provider_spend_today view; returns false when adding
// `est_cents` would push the provider over its cap or when the breaker is frozen.

export type Provider = "apollo" | "hunter" | "firecrawl" | "places";

export async function getProviderCapsCents(sb: any): Promise<Record<Provider, number>> {
  const { data } = await sb
    .from("enrichment_walker_config")
    .select("key, value_numeric")
    .in("key", [
      "apollo_daily_budget_usd",
      "hunter_daily_budget_usd",
      "firecrawl_daily_budget_usd",
      "budget_frozen",
    ]);
  const map = new Map<string, number>((data || []).map((r: any) => [r.key, Number(r.value_numeric ?? 0)]));
  return {
    apollo: Math.round((map.get("apollo_daily_budget_usd") ?? 30) * 100),
    hunter: Math.round((map.get("hunter_daily_budget_usd") ?? 15) * 100),
    firecrawl: Math.round((map.get("firecrawl_daily_budget_usd") ?? 5) * 100),
    places: Number.MAX_SAFE_INTEGER, // free
  };
}

export async function getProviderSpendCents(sb: any): Promise<Record<Provider, number>> {
  const { data } = await sb.from("provider_spend_today").select("provider, spend_cents");
  const out: Record<Provider, number> = { apollo: 0, hunter: 0, firecrawl: 0, places: 0 };
  for (const row of data || []) {
    const p = (row.provider || "").toLowerCase() as Provider;
    if (p in out) out[p] = Number(row.spend_cents || 0);
  }
  return out;
}

export async function isBudgetFrozen(sb: any): Promise<boolean> {
  const { data } = await sb
    .from("enrichment_walker_config")
    .select("value_text")
    .eq("key", "budget_frozen")
    .maybeSingle();
  return (data?.value_text || "false").toLowerCase() === "true";
}

export async function canSpend(
  sb: any,
  provider: Provider,
  est_cents: number,
): Promise<{ ok: boolean; reason?: string; spent: number; cap: number }> {
  if (provider === "places") return { ok: true, spent: 0, cap: Number.MAX_SAFE_INTEGER };
  const [caps, spend, frozen] = await Promise.all([
    getProviderCapsCents(sb),
    getProviderSpendCents(sb),
    isBudgetFrozen(sb),
  ]);
  const cap = caps[provider];
  const spent = spend[provider];
  if (frozen) return { ok: false, reason: "budget_frozen", spent, cap };
  if (spent + est_cents > cap) return { ok: false, reason: "provider_cap", spent, cap };
  return { ok: true, spent, cap };
}

// Estimated per-call costs (cents)
export const PROVIDER_COST_ESTIMATES: Record<Provider, number> = {
  apollo: 5,    // ~$0.05/contact reveal
  hunter: 1,    // ~$0.01/lookup
  firecrawl: 1, // ~$0.01/scrape
  places: 0,
};
