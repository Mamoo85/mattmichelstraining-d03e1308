import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Package, DollarSign, Calendar } from "lucide-react";

interface Stats {
  total: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  by_type: Record<string, number>;
  by_vertical: Record<string, number>;
  sellable_now: number;
  avg_confidence: number;
}

const PRICE_PER_SIGNAL = 50;
const PRICE_PER_SUBSCRIPTION = 199;

export default function DemandThroughputKPIs() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("industry_pulse_signals" as any)
        .select("signal_type, vertical, confidence, detected_at, status")
        .order("detected_at", { ascending: false })
        .limit(2000);

      const rows = (data as any[]) || [];
      const now = Date.now();
      const h24 = now - 24 * 3600_000;
      const d7 = now - 7 * 24 * 3600_000;
      const d30 = now - 30 * 24 * 3600_000;

      const by_type: Record<string, number> = {};
      const by_vertical: Record<string, number> = {};
      let last_24h = 0, last_7d = 0, last_30d = 0;
      let confSum = 0, confCount = 0;
      let sellable_now = 0;

      for (const r of rows) {
        const t = new Date(r.detected_at).getTime();
        if (t > h24) last_24h++;
        if (t > d7) last_7d++;
        if (t > d30) last_30d++;

        const st = r.signal_type || "unknown";
        by_type[st] = (by_type[st] || 0) + 1;

        const v = r.vertical || "unspecified";
        by_vertical[v] = (by_vertical[v] || 0) + 1;

        if (typeof r.confidence === "number") {
          confSum += r.confidence;
          confCount++;
        }

        if (
          (r.confidence ?? 0) >= 7 &&
          t > d30 &&
          (r.status === "new" || r.status === "ready" || !r.status)
        ) {
          sellable_now++;
        }
      }

      setStats({
        total: rows.length,
        last_24h,
        last_7d,
        last_30d,
        by_type,
        by_vertical,
        sellable_now,
        avg_confidence: confCount ? confSum / confCount : 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-white/50 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading throughput…</div>;
  if (!stats) return null;

  const avgPerDay = stats.last_7d / 7;
  const sellRate = stats.last_30d > 0 ? stats.last_30d / 30 : avgPerDay;
  const daysOfInventory = sellRate > 0 ? stats.sellable_now / sellRate : 0;
  const a la carteRev = stats.sellable_now * PRICE_PER_SIGNAL;
  const monthlyRunRate = avgPerDay * 30;
  const subscriptionRev = Math.floor(monthlyRunRate / 20) * PRICE_PER_SUBSCRIPTION; // ~20 signals/client capacity

  const sortedTypes = Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]);
  const sortedVerticals = Object.entries(stats.by_vertical).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          icon={TrendingUp}
          label="Signals / Day (7d avg)"
          value={avgPerDay.toFixed(1)}
          sub={`${stats.last_7d} this week · ${stats.last_24h} today`}
          accent="cyan"
        />
        <KPI
          icon={Package}
          label="Sellable Now"
          value={stats.sellable_now.toString()}
          sub={`Confidence ≥7 · <30d old`}
          accent="emerald"
        />
        <KPI
          icon={Calendar}
          label="Days of Inventory"
          value={daysOfInventory.toFixed(1)}
          sub={`At ${sellRate.toFixed(1)}/day burn rate`}
          accent="amber"
        />
        <KPI
          icon={DollarSign}
          label="Revenue Forecast"
          value={`$${aLaCarteRev.toLocaleString()}`}
          sub={`+ $${subscriptionRev.toLocaleString()}/mo recurring potential`}
          accent="rose"
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h4 className="text-xs uppercase tracking-wide text-white/40 mb-3">By Signal Type</h4>
          <div className="space-y-1.5">
            {sortedTypes.map(([t, n]) => {
              const pct = (n / stats.total) * 100;
              return (
                <div key={t}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-white/80 font-mono">{t}</span>
                    <span className="text-white font-bold">{n}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-[#00d4ff]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h4 className="text-xs uppercase tracking-wide text-white/40 mb-3">Top Verticals</h4>
          <div className="space-y-1.5">
            {sortedVerticals.map(([v, n]) => {
              const pct = (n / stats.total) * 100;
              return (
                <div key={v}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-white/80 font-mono truncate">{v}</span>
                    <span className="text-white font-bold">{n}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-white/40 italic">
        Forecast assumes $50 per a la carte signal sale · $199/mo subscription priced at ~20 signals/client capacity. Tune in code if economics shift.
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: string; sub: string; accent: "cyan" | "emerald" | "amber" | "rose";
}) {
  const accents = {
    cyan: "border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff]",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  } as const;
  return (
    <div className={`rounded-lg border p-4 ${accents[accent]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[11px] text-white/50 mt-1">{sub}</div>
    </div>
  );
}
