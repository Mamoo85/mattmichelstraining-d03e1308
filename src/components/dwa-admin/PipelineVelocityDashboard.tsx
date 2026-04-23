import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Loader2, Filter } from "lucide-react";

/**
 * Pipeline Velocity Dashboard
 * ----------------------------------------------------------------------------
 * Single view of the prospect→customer pipeline across all 4 Golden Path
 * products. Shows the formula:
 *
 *   Velocity = (Opportunities × Avg Deal Value × Win Rate) / Sales Cycle (days)
 *
 * Data sources:
 *   - service_subscriptions  → active customers + MRR by service_type
 *   - prospect_pipeline      → in-flight opportunities (Tom-logged + manual)
 *   - outreach_cooldowns     → recent activity counts per product
 *
 * Filter: All / Mortgage Radar / Talent Radar / FieldDesk / Dead Lead / Web Design
 */

const ACCENT = "#00d4ff";

interface FilterOption {
  key: ProductFilter;
  label: string;
  /** Strings to match against `service_type` / `product_interest` / `last_agent` */
  matchers: string[];
}

type ProductFilter = "all" | "mortgage_radar" | "talent_radar" | "fielddesk" | "dead_lead" | "web_design";

const FILTERS: FilterOption[] = [
  { key: "all",            label: "All Products",        matchers: [] },
  { key: "mortgage_radar", label: "🏠 Mortgage Radar",   matchers: ["mortgage_radar", "mortgage", "mortgageradar"] },
  { key: "talent_radar",   label: "🎯 Talent Radar",     matchers: ["talent_radar", "hire_alert", "techalert", "talent"] },
  { key: "fielddesk",      label: "🛠️ FieldDesk",        matchers: ["fielddesk", "field_desk", "field_service", "field_crm"] },
  { key: "dead_lead",      label: "♻️ Dead Lead",        matchers: ["dead_lead", "dead_lead_reactivation", "deadlead"] },
  { key: "web_design",     label: "🌐 Web Design",       matchers: ["web_design", "webdesign", "website"] },
];

type ServiceSubRow = {
  service_type: string | null;
  status: string | null;
  monthly_price: number | null;
  fulfillment_stage: string | null;
  started_at: string | null;
};

type PipelineRow = {
  product?: string | null;
  service_type?: string | null;
  stage?: string | null;
  estimated_value?: number | null;
  created_at?: string | null;
};

type CooldownRow = {
  last_agent: string | null;
  product?: string | null;
  last_contacted_at: string | null;
};

interface Stats {
  activeCustomers: number;
  monthlyMrr: number;
  newLast30: number;
  pipelineCount: number;
  pipelineValue: number;
  outreachLast7: number;
  avgDealValue: number;
  estWinRate: number;       // 0..1
  avgSalesCycleDays: number;
  velocityPerMonth: number;
}

const ZERO_STATS: Stats = {
  activeCustomers: 0, monthlyMrr: 0, newLast30: 0, pipelineCount: 0, pipelineValue: 0,
  outreachLast7: 0, avgDealValue: 0, estWinRate: 0, avgSalesCycleDays: 30, velocityPerMonth: 0,
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function matchesFilter(value: string | null | undefined, matchers: string[]): boolean {
  if (matchers.length === 0) return true;
  if (!value) return false;
  const v = value.toLowerCase();
  return matchers.some(m => v.includes(m));
}

export default function PipelineVelocityDashboard() {
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<ServiceSubRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const sinceIso30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sinceIso7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Use untyped supabase calls — these tables exist but may not be in generated types
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => { gte?: (col: string, v: string) => Promise<{ data: unknown; error: unknown }>; } & Promise<{ data: unknown; error: unknown }>;
        };
      };

      const [subsRes, pipelineRes, cooldownsRes] = await Promise.allSettled([
        (supabase as any).from("service_subscriptions").select("service_type, status, monthly_price, fulfillment_stage, started_at"),
        (supabase as any).from("prospect_pipeline").select("*").gte("created_at", sinceIso30),
        (supabase as any).from("outreach_cooldowns").select("last_agent, last_contacted_at").gte("last_contacted_at", sinceIso7),
      ]);

      if (cancelled) return;

      if (subsRes.status === "fulfilled" && !subsRes.value.error) {
        setSubs((subsRes.value.data as ServiceSubRow[]) || []);
      }
      if (pipelineRes.status === "fulfilled" && !pipelineRes.value.error) {
        setPipeline((pipelineRes.value.data as PipelineRow[]) || []);
      }
      if (cooldownsRes.status === "fulfilled" && !cooldownsRes.value.error) {
        setCooldowns((cooldownsRes.value.data as CooldownRow[]) || []);
      }

      // Show a soft error only if all three failed
      if (
        subsRes.status === "rejected" &&
        pipelineRes.status === "rejected" &&
        cooldownsRes.status === "rejected"
      ) {
        setError("Could not load pipeline data — check Supabase connection.");
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats: Stats = useMemo(() => {
    const matchers = FILTERS.find(f => f.key === filter)?.matchers ?? [];

    const filteredSubs = subs.filter(s => matchesFilter(s.service_type, matchers));
    const activeSubs = filteredSubs.filter(s => (s.status || "").toLowerCase() === "active");
    const newLast30 = filteredSubs.filter(s => {
      if (!s.started_at) return false;
      return Date.now() - new Date(s.started_at).getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const monthlyMrr = activeSubs.reduce((sum, s) => sum + (Number(s.monthly_price) || 0), 0);

    const filteredPipeline = pipeline.filter(p =>
      matchesFilter(p.product || p.service_type, matchers)
    );
    const pipelineCount = filteredPipeline.length;
    const pipelineValue = filteredPipeline.reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);

    const filteredCooldowns = cooldowns.filter(c => matchesFilter(c.last_agent || c.product, matchers));
    const outreachLast7 = filteredCooldowns.length;

    // Velocity inputs
    const avgDealValue = activeSubs.length > 0 ? monthlyMrr / activeSubs.length * 12 : 0;
    const estWinRate = pipelineCount > 0 ? Math.min(1, newLast30 / pipelineCount) : 0;
    const avgSalesCycleDays = 30;
    const velocityPerMonth = avgSalesCycleDays > 0
      ? (pipelineCount * avgDealValue * estWinRate) / avgSalesCycleDays * 30
      : 0;

    return {
      activeCustomers: activeSubs.length,
      monthlyMrr,
      newLast30,
      pipelineCount,
      pipelineValue,
      outreachLast7,
      avgDealValue,
      estWinRate,
      avgSalesCycleDays,
      velocityPerMonth,
    };
  }, [subs, pipeline, cooldowns, filter]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-6 h-6" style={{ color: ACCENT }} />
          <h2 className="text-2xl font-bold text-white">Pipeline Velocity</h2>
        </div>
        <p className="text-white/50 text-sm">
          Velocity = (Opps × Deal Value × Win Rate) / Sales Cycle. The single number that tells you if outbound is working.
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-white/40" />
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              filter === f.key
                ? "border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]"
                : "border-white/10 bg-[#0a1628] text-white/60 hover:border-[#00d4ff]/40 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading pipeline data…
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Active Customers" value={stats.activeCustomers.toString()} />
            <KpiCard label="Monthly MRR" value={fmtCurrency(stats.monthlyMrr)} accent />
            <KpiCard label="New (30d)" value={stats.newLast30.toString()} />
            <KpiCard label="Outreach (7d)" value={stats.outreachLast7.toString()} />
            <KpiCard label="Pipeline Opps" value={stats.pipelineCount.toString()} />
            <KpiCard label="Pipeline Value" value={fmtCurrency(stats.pipelineValue)} />
            <KpiCard label="Avg Deal (ARR)" value={fmtCurrency(stats.avgDealValue)} />
            <KpiCard label="Est. Win Rate" value={`${(stats.estWinRate * 100).toFixed(0)}%`} />
          </div>

          {/* Velocity formula card */}
          <div
            className="rounded-2xl p-6 border-2"
            style={{ borderColor: `${ACCENT}40`, background: `linear-gradient(135deg, ${ACCENT}10, ${ACCENT}05)` }}
          >
            <p className="text-[10px] tracking-[0.3em] uppercase font-bold mb-2" style={{ color: ACCENT }}>
              Pipeline Velocity Formula
            </p>
            <div className="font-mono text-xs sm:text-sm text-white/70 mb-4 break-words">
              Velocity = ({stats.pipelineCount} opps × {fmtCurrency(stats.avgDealValue)} × {(stats.estWinRate * 100).toFixed(0)}%) / {stats.avgSalesCycleDays}d
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white">
              {fmtCurrency(stats.velocityPerMonth)} <span className="text-base font-medium text-white/50">/ mo projected</span>
            </div>
            <p className="text-xs text-white/40 mt-3">
              Projection assumes 30-day sales cycle. If pipeline value or win rate drops to 0, velocity is 0 — that's where to focus.
            </p>
          </div>

          {/* Action prompt */}
          <div className="rounded-xl border border-white/10 bg-[#0a1628] p-5">
            <p className="text-xs uppercase tracking-wider text-white/50 font-bold mb-2">What this tells you</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <span className="text-white font-semibold">If Pipeline Opps = 0:</span> stop building, start cold-calling. No code can fix an empty pipeline.
              </li>
              <li>
                <span className="text-white font-semibold">If Win Rate &lt; 10%:</span> the offer or pricing is wrong. Talk to the prospects who said no.
              </li>
              <li>
                <span className="text-white font-semibold">If MRR is flat but Outreach is high:</span> you're getting attention but not closing. Check the demo, not the pitch.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        borderColor: accent ? `${ACCENT}50` : "rgba(255,255,255,0.08)",
        background: accent ? `${ACCENT}10` : "#0a1628",
      }}
    >
      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: accent ? ACCENT : "#64748b" }}>
        {label}
      </p>
      <p className="text-xl font-extrabold text-white truncate">{value}</p>
    </div>
  );
}
