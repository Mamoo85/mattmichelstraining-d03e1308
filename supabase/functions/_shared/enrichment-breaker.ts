// Enrichment safety circuit breaker.
// Evaluates failure rate (last N audit rows), bounce rate (last 24h sends to leads enriched today),
// and cost-per-validated-email. Trips the breaker (sets enrichment_walker_config.budget_frozen=true)
// and writes an enrichment_circuit_breaker_state row when any threshold breached.

export interface BreakerStatus {
  tripped: boolean;
  active_row?: any;
  reason?: string;
  metric_value?: number;
  threshold?: number;
}

export async function getActiveBreaker(sb: any): Promise<BreakerStatus> {
  const { data } = await sb
    .from("enrichment_circuit_breaker_state")
    .select("*")
    .is("cleared_at", null)
    .order("tripped_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return { tripped: false };
  // Auto-reset if past auto_reset_at
  if (row.auto_reset_at && new Date(row.auto_reset_at).getTime() < Date.now()) {
    await sb.from("enrichment_circuit_breaker_state")
      .update({ cleared_at: new Date().toISOString(), notes: "auto_reset_window_elapsed" })
      .eq("id", row.id);
    await sb.from("enrichment_walker_config")
      .upsert({ key: "budget_frozen", value_numeric: 0, value_text: "false" }, { onConflict: "key" });
    return { tripped: false };
  }
  return { tripped: true, active_row: row, reason: row.reason, metric_value: row.metric_value, threshold: row.threshold };
}

async function getThresholds(sb: any) {
  const { data } = await sb
    .from("enrichment_walker_config")
    .select("key, value_numeric")
    .in("key", ["failure_rate_threshold", "bounce_rate_threshold", "cost_per_validated_threshold_cents"]);
  const m = new Map<string, number>((data || []).map((r: any) => [r.key, Number(r.value_numeric)]));
  return {
    failureRate: m.get("failure_rate_threshold") ?? 0.40,
    bounceRate: m.get("bounce_rate_threshold") ?? 0.08,
    cpvCents: m.get("cost_per_validated_threshold_cents") ?? 75,
  };
}

export async function evaluateBreaker(sb: any): Promise<{
  tripped: boolean;
  reason?: string;
  metric_value?: number;
  threshold?: number;
  provider?: string;
  details: any;
}> {
  const t = await getThresholds(sb);

  // 1. Failure rate over last 200 audit rows (only paid providers — places fails are noise)
  const { data: audit } = await sb
    .from("lead_enrichment_audit")
    .select("success, provider, cost_cents, created_at")
    .in("provider", ["apollo", "hunter", "firecrawl"])
    .order("created_at", { ascending: false })
    .limit(200);
  const total = audit?.length || 0;
  const fails = (audit || []).filter((r: any) => !r.success).length;
  const failureRate = total > 0 ? fails / total : 0;

  // 2. Bounce rate over last 24h cold-email sends
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: sends } = await sb
    .from("email_send_log")
    .select("status")
    .gte("created_at", since)
    .in("status", ["sent", "bounced", "complained"]);
  const sendTotal = sends?.length || 0;
  const bounces = (sends || []).filter((r: any) => r.status === "bounced" || r.status === "complained").length;
  const bounceRate = sendTotal > 0 ? bounces / sendTotal : 0;

  // 3. Cost per validated email (today)
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const todayCost = (audit || [])
    .filter((r: any) => new Date(r.created_at) >= todayStart)
    .reduce((s: number, r: any) => s + (r.cost_cents || 0), 0);
  const todaySuccess = (audit || [])
    .filter((r: any) => new Date(r.created_at) >= todayStart && r.success).length;
  const cpvCents = todaySuccess > 0 ? todayCost / todaySuccess : 0;

  const details = { failureRate, bounceRate, cpvCents, total, sendTotal, todayCost, todaySuccess };

  // Need a meaningful sample size before tripping
  let trip: { reason: string; metric_value: number; threshold: number; provider?: string } | null = null;
  if (total >= 50 && failureRate > t.failureRate) {
    trip = { reason: "failure_rate", metric_value: failureRate, threshold: t.failureRate };
  } else if (sendTotal >= 100 && bounceRate > t.bounceRate) {
    trip = { reason: "bounce_rate", metric_value: bounceRate, threshold: t.bounceRate };
  } else if (todaySuccess >= 20 && cpvCents > t.cpvCents) {
    trip = { reason: "cost_runaway", metric_value: cpvCents, threshold: t.cpvCents };
  }

  if (!trip) return { tripped: false, details };

  // Insert breaker row + freeze budget
  await sb.from("enrichment_circuit_breaker_state").insert({
    reason: trip.reason,
    metric_value: trip.metric_value,
    threshold: trip.threshold,
    provider: trip.provider,
    notes: JSON.stringify(details),
  });
  await sb.from("enrichment_walker_config")
    .upsert({ key: "budget_frozen", value_numeric: 1, value_text: "true" }, { onConflict: "key" });

  return { tripped: true, ...trip, details };
}

export async function clearBreaker(sb: any, note = "manual_reset"): Promise<void> {
  await sb.from("enrichment_circuit_breaker_state")
    .update({ cleared_at: new Date().toISOString(), notes: note })
    .is("cleared_at", null);
  await sb.from("enrichment_walker_config")
    .upsert({ key: "budget_frozen", value_numeric: 0, value_text: "false" }, { onConflict: "key" });
}
