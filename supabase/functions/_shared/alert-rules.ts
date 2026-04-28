// Shared alert predicates — used by outreach-alert-evaluator, alert-rule-tester,
// and contractor-outreach-enrich-backfill. Single source of truth.

export type Severity = "info" | "warn" | "crit";

/** Quiet hours: 9pm–7am ET. Warn-level suppressed; critical always sends. */
export function isQuietHoursET(date: Date = new Date()): boolean {
  // Convert to America/New_York hour
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(fmt.format(date), 10);
  // 21:00–06:59 inclusive (i.e. 9pm through 6:59am) = quiet
  return hour >= 21 || hour < 7;
}

export function shouldSuppressForQuietHours(
  severity: Severity,
  date: Date = new Date(),
): { suppress: boolean; reason: string } {
  if (severity === "crit") {
    return { suppress: false, reason: "critical bypasses quiet hours" };
  }
  if (isQuietHoursET(date)) {
    return { suppress: true, reason: "warn alert suppressed during 9pm–7am ET quiet hours" };
  }
  return { suppress: false, reason: "outside quiet hours" };
}

/** Cost anomaly: today's spend vs 7-day rolling average. Fires when ratio >= 2x. */
export function evaluateSpendAnomaly(
  todaySpend: number,
  rollingAvg7d: number,
  threshold = 2.0,
): { fires: boolean; ratio: number; reason: string } {
  if (rollingAvg7d <= 0) {
    return { fires: false, ratio: 0, reason: "insufficient history (avg=0)" };
  }
  const ratio = todaySpend / rollingAvg7d;
  return {
    fires: ratio >= threshold,
    ratio,
    reason: `today=$${todaySpend.toFixed(2)} avg7d=$${rollingAvg7d.toFixed(2)} ratio=${ratio.toFixed(2)}x threshold=${threshold}x`,
  };
}

/** DLQ aging: prospects in dead-letter > N days move to suppression. */
export function evaluateDlqAging(
  enteredAt: Date,
  reason: string | null,
  ageThresholdDays = 7,
  now: Date = new Date(),
): { suppress: boolean; ageDays: number; suppressionReason: string } {
  const ageMs = now.getTime() - enteredAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= ageThresholdDays) {
    return {
      suppress: true,
      ageDays,
      suppressionReason: `unenrichable_dlq_aged_${ageThresholdDays}d:${reason || "unknown"}`,
    };
  }
  return {
    suppress: false,
    ageDays,
    suppressionReason: `still within ${ageThresholdDays}d window`,
  };
}

/** Walker daily budget cap: pause when spend >= cap. */
export function evaluateWalkerBudget(
  dailySpend: number,
  dailyBudgetUsd: number,
): { block: boolean; reason: string } {
  if (dailySpend >= dailyBudgetUsd) {
    return {
      block: true,
      reason: `walker paused: spend $${dailySpend.toFixed(2)} >= cap $${dailyBudgetUsd.toFixed(2)}`,
    };
  }
  return {
    block: false,
    reason: `walker active: spend $${dailySpend.toFixed(2)} < cap $${dailyBudgetUsd.toFixed(2)}`,
  };
}
