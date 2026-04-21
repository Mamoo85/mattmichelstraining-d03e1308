// Tiny zero-dep cron expression parser for 5-field expressions.
// Computes interval (minutes between runs), staleAfterMinutes (interval*2 + 30), and nextRunAt.
// Falls back to 24h interval if expression doesn't parse.

export interface CronWindow {
  intervalMinutes: number;
  staleAfterMinutes: number;
  nextRunAt: Date;
  label: string; // human-readable, e.g. "Every 4h"
}

const FALLBACK: Omit<CronWindow, "nextRunAt"> = {
  intervalMinutes: 1440,
  staleAfterMinutes: 1440 * 2 + 30,
  label: "Every 24h (fallback)",
};

function formatLabel(mins: number): string {
  if (mins < 60) return `Every ${mins}m`;
  if (mins < 1440) return `Every ${Math.round(mins / 60)}h`;
  if (mins < 1440 * 7) return `Every ${Math.round(mins / 1440)}d`;
  if (mins < 1440 * 30) return `Every ${Math.round(mins / (1440 * 7))}w`;
  return `Every ${Math.round(mins / 1440)}d`;
}

function detectInterval(expr: string): number | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, _mon, dow] = parts;

  // */N * * * *  → N minutes
  const mEvery = m.match(/^\*\/(\d+)$/);
  if (mEvery && h === "*" && dom === "*" && dow === "*") return parseInt(mEvery[1]);

  // 0 */N * * *  → N hours
  const hEvery = h.match(/^\*\/(\d+)$/);
  if (m === "0" && hEvery && dom === "*" && dow === "*") return parseInt(hEvery[1]) * 60;

  // 0 H * * *   → 24h (single hour)
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && dow === "*") return 1440;

  // 0 H * * D   → 7d (specific day-of-week)
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && /^\d+$/.test(dow)) return 1440 * 7;

  // 0 H D * *   → ~30d (specific day-of-month)
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom) && dow === "*") return 1440 * 30;

  // multi-hour list "0 1,13 * * *" → 12h gap (rough)
  if (/^\d+$/.test(m) && /^[\d,]+$/.test(h) && dom === "*" && dow === "*") {
    const hours = h.split(",").map(Number).sort((a, b) => a - b);
    if (hours.length >= 2) {
      const gaps = hours.slice(1).map((v, i) => v - hours[i]);
      const minGap = Math.min(...gaps);
      return minGap * 60;
    }
  }

  return null;
}

function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  // */N
  const every = field.match(/^\*\/(\d+)$/);
  if (every) return value % parseInt(every[1]) === 0;
  // list a,b,c
  if (field.includes(",")) return field.split(",").map(Number).includes(value);
  // range a-b
  const range = field.match(/^(\d+)-(\d+)$/);
  if (range) return value >= parseInt(range[1]) && value <= parseInt(range[2]);
  // exact
  if (/^\d+$/.test(field)) return parseInt(field) === value;
  return false;
}

function computeNextRun(expr: string, from: Date): Date {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const [mF, hF, domF, monF, dowF] = parts;

  // Walk minute-by-minute up to 60 days
  const max = 60 * 24 * 60; // minutes
  const t = new Date(from.getTime() + 60_000); // start at next minute
  t.setSeconds(0, 0);
  for (let i = 0; i < max; i++) {
    const min = t.getUTCMinutes();
    const hr = t.getUTCHours();
    const dom = t.getUTCDate();
    const mon = t.getUTCMonth() + 1;
    const dow = t.getUTCDay();
    if (
      fieldMatches(mF, min) &&
      fieldMatches(hF, hr) &&
      fieldMatches(domF, dom) &&
      fieldMatches(monF, mon) &&
      fieldMatches(dowF, dow)
    ) {
      return t;
    }
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

export function parseCronWindow(expr: string | null | undefined, from: Date = new Date()): CronWindow {
  if (!expr) {
    return { ...FALLBACK, nextRunAt: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
  }
  const interval = detectInterval(expr);
  const nextRunAt = computeNextRun(expr, from);
  if (interval == null) {
    return { ...FALLBACK, nextRunAt };
  }
  return {
    intervalMinutes: interval,
    staleAfterMinutes: interval * 2 + 30,
    nextRunAt,
    label: formatLabel(interval),
  };
}
