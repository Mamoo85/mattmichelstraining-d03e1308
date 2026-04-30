import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

// Public, anonymized heatmap of in-market borrower signals (FSBO, foreclosure,
// permits, divorce, probate). Sells the Mortgage Radar product by showing LOs
// the live density of opportunity in their target ZIPs — without exposing PII.

type Row = {
  zip: string;
  city: string | null;
  total: number;
  fsbo: number;
  foreclosure: number;
  permit: number;
  other: number;
  last7: number;
};

const SIGNAL_LABELS: Record<string, keyof Row> = {
  FSBO: "fsbo",
  Foreclosure: "foreclosure",
  Lis_Pendens: "foreclosure",
  Permit: "permit",
  BSEED: "permit",
};

export default function FsboHeatmap() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("MI");
  const [signalFilter, setSignalFilter] = useState<"all" | "fsbo" | "foreclosure" | "permit">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("mortgage_radar_leads")
        .select("zip, city, signal_source, created_at")
        .eq("state", stateFilter)
        .gte("created_at", since)
        .not("zip", "is", null)
        .limit(5000);
      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const map = new Map<string, Row>();
      for (const r of data as Array<{ zip: string; city: string | null; signal_source: string; created_at: string }>) {
        const key = r.zip;
        const existing = map.get(key) || {
          zip: key, city: r.city, total: 0, fsbo: 0, foreclosure: 0, permit: 0, other: 0, last7: 0,
        };
        existing.total++;
        if (new Date(r.created_at).getTime() > sevenDaysAgo) existing.last7++;
        const bucket = SIGNAL_LABELS[r.signal_source] || "other";
        (existing as any)[bucket]++;
        map.set(key, existing);
      }
      setRows(Array.from(map.values()).sort((a, b) => b.total - a.total));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [stateFilter]);

  const filtered = useMemo(() => {
    if (signalFilter === "all") return rows;
    return rows.filter((r) => (r as any)[signalFilter] > 0)
      .sort((a, b) => (b as any)[signalFilter] - (a as any)[signalFilter]);
  }, [rows, signalFilter]);

  const max = Math.max(1, ...filtered.map((r) => signalFilter === "all" ? r.total : (r as any)[signalFilter]));
  const heatColor = (n: number) => {
    const intensity = Math.min(1, n / max);
    // Electric teal scale (DWA brand) → hotter ZIPs are more saturated.
    return `rgba(0, 212, 255, ${0.1 + intensity * 0.85})`;
  };

  const totals = useMemo(
    () => rows.reduce((acc, r) => ({
      total: acc.total + r.total,
      fsbo: acc.fsbo + r.fsbo,
      foreclosure: acc.foreclosure + r.foreclosure,
      permit: acc.permit + r.permit,
    }), { total: 0, fsbo: 0, foreclosure: 0, permit: 0 }),
    [rows],
  );

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEOHead
        title="FSBO + Foreclosure Heatmap — Live Borrower Signals"
        description="Live density map of FSBO listings, foreclosure notices, and renovation permits by ZIP. FCRA-clean public records — see where the opportunity is before pulling credit."
        path="/fsbo-heatmap"
      />

      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-black text-lg">
          <span className="text-white">DETROIT</span>{" "}
          <span className="text-[#00d4ff]">WEB AGENCY</span>
        </Link>
        <Link to="/mortgage-radar" className="text-sm text-[#00d4ff] hover:underline">
          Get this for your ZIPs →
        </Link>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-6 text-center">
        <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-4 py-1.5 text-[#00d4ff] text-xs font-bold uppercase tracking-widest mb-6">
          Live · Last 30 days
        </div>
        <h1 className="text-4xl sm:text-5xl font-black mb-4">
          Where Borrowers Are <span className="text-[#00d4ff]">About to Move</span>
        </h1>
        <p className="text-white/60 text-lg max-w-2xl mx-auto">
          Every dot is a real public-record signal — FSBO listing, foreclosure notice, BSEED renovation permit — that means a homeowner is about to need a mortgage.
          No credit bureau data. FCRA-clean.
        </p>
      </section>

      {/* Stat strip */}
      <section className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total signals", val: totals.total, color: "text-[#00d4ff]" },
          { label: "FSBO", val: totals.fsbo, color: "text-blue-400" },
          { label: "Foreclosure / lis pendens", val: totals.foreclosure, color: "text-red-400" },
          { label: "Permits", val: totals.permit, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.val.toLocaleString()}</p>
            <p className="text-white/40 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <section className="max-w-5xl mx-auto px-6 mb-4 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {(["all", "fsbo", "foreclosure", "permit"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSignalFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                signalFilter === s
                  ? "bg-[#00d4ff] text-[#0a0f1a] border-[#00d4ff]"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
              }`}
            >
              {s === "all" ? "All signals" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-white/5 border border-white/10 text-white text-xs rounded-full px-3 py-1.5"
        >
          {["MI", "TX", "FL", "AZ", "GA"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </section>

      {/* Heatmap grid */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-12">Loading live signals…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-white/60 mb-2">No signals in {stateFilter} yet.</p>
            <p className="text-white/40 text-xs">Mortgage Radar is live in MI. Other states coming Q2.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {filtered.slice(0, 70).map((r) => {
              const v = signalFilter === "all" ? r.total : (r as any)[signalFilter];
              return (
                <div
                  key={r.zip}
                  className="aspect-square rounded-lg border border-white/10 flex flex-col items-center justify-center p-2 text-center"
                  style={{ backgroundColor: heatColor(v) }}
                  title={`${r.city || r.zip}: ${v} ${signalFilter === "all" ? "signals" : signalFilter} (${r.last7} in last 7d)`}
                >
                  <p className="text-xs font-bold text-white">{r.zip}</p>
                  <p className="text-lg font-black text-white">{v}</p>
                  {r.last7 > 0 && (
                    <p className="text-[10px] text-white/70">+{r.last7} new</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-black mb-3">Claim a ZIP before the other LO does</h2>
        <p className="text-white/50 text-sm mb-6">
          Mortgage Radar gives you 48-hour exclusive locks on every borrower in your ZIPs. $149/mo.
        </p>
        <Link
          to="/mortgage-radar"
          className="inline-block bg-[#00d4ff] text-[#0a0f1a] font-bold text-base px-6 py-3 rounded-xl hover:bg-[#00d4ff]/90 transition-colors"
        >
          See pricing & coverage →
        </Link>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-white/30 text-xs">
        Detroit Web Agency · Public records aggregation · Updated every 6 hours
      </footer>
    </div>
  );
}
