import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";
import JustPurchasedScreen, { isJustPurchased } from "@/components/shared/JustPurchasedScreen";
import { Factory, Loader2, ExternalLink, Clock, Zap, TrendingUp, Radar, Download } from "lucide-react";

type Signal = {
  id: string;
  company_name: string;
  industry?: string;
  location?: string;
  confidence?: number;
  predicted_needs?: string[];
  source_summary?: string;
  detected_at: string;
};

type Rfq = {
  id: string;
  title: string;
  agency?: string;
  naics?: string;
  state?: string;
  city?: string;
  url?: string;
  due_at?: string;
  posted_at?: string;
};

export default function MyBuyerRadar() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [client, setClient] = useState<any>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data: c } = await supabase
        .from("industry_pulse_clients" as any)
        .select("*")
        .eq("dashboard_token", token)
        .maybeSingle();
      setClient(c);

      const weekAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sigs } = await supabase
        .from("industry_pulse_signals" as any)
        .select("*")
        .gte("detected_at", weekAgo)
        .order("confidence", { ascending: false })
        .order("id",         { ascending: true })
        .limit(50);
      setSignals((sigs as any[]) || []);

      const { data: rs } = await supabase
        .from("buyer_radar_rfqs" as any)
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      setRfqs((rs as any[]) || []);
      setLoading(false);
    })();
  }, [token]);

  function exportSignalsCsv() {
    const headers = ["company_name", "industry", "location", "confidence", "predicted_needs", "source_summary", "detected_at"];
    const csvRows = [
      headers.join(","),
      ...signals.map((s) =>
        [
          s.company_name,
          s.industry || "",
          s.location || "",
          s.confidence ?? "",
          (s.predicted_needs || []).join("; "),
          (s.source_summary || "").replace(/\n/g, " "),
          s.detected_at,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buyer-radar-signals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Radar className="w-10 h-10 text-[#00d4ff] mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Missing access token</p>
          <p className="text-sm text-[#94a3b8]">Use the dashboard link from your welcome email.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6 text-[#00d4ff]" />
      </div>
    );
  }

  const hotSignals = signals.filter((s) => (s.confidence ?? 0) >= 8).length;
  const warmSignals = signals.filter((s) => (s.confidence ?? 0) >= 5 && (s.confidence ?? 0) < 8).length;

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead title="Your Buyer Radar Dashboard" description="Live buyer-intent signals" />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Factory className="w-5 h-5 text-[#00d4ff]" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse" />
            </div>
            <span className="font-bold tracking-tight">Buyer Radar</span>
          </div>
          <span className="text-sm text-[#94a3b8] truncate max-w-[50%]">{client?.company_name || "Welcome"}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">
        <OnboardingChecklist
          product="Buyer Radar"
          steps={[
            { id: "auth", label: "Dashboard access confirmed", done: !!client, hint: "Open from your Buyer Radar welcome email." },
            { id: "signals", label: "First buyer signals received", done: signals.length > 0, hint: "Scanner runs daily — check back tomorrow." },
            { id: "hot", label: "Hot signal (8+) detected", done: signals.some((s) => (s.confidence ?? 0) >= 8), hint: "High-confidence signals trigger a same-day call." },
            { id: "export", label: "Signal list exported", done: false, hint: "Download your signals as CSV to work them in your CRM." },
          ]}
        />

        {/* Hero glow band with KPI cards — tap to jump to section on mobile */}
        <section className="relative">
          <div
            className="absolute inset-0 rounded-2xl opacity-40 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(0,212,255,0.18), transparent 70%)" }}
          />
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="#signals"
              title="Highest-confidence buyer-intent signals — work these first"
              className="bg-gradient-to-br from-[#0a1628] to-[#0a1628]/60 border border-[#00d4ff]/40 rounded-xl p-5 shadow-[0_0_32px_-10px_rgba(0,212,255,0.5)] no-underline relative overflow-hidden hover:border-[#00d4ff]/70 transition-colors"
            >
              <span className="absolute top-2 right-2 text-[9px] font-black text-[#00d4ff]/70 uppercase tracking-widest">#1</span>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-[#00d4ff]" />
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold">Hot signals</p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-white tabular-nums leading-none">{hotSignals}</p>
              <p className="text-[11px] text-[#94a3b8] mt-2">Confidence 8–10 — call today</p>
            </a>
            <a
              href="#signals"
              title="Moderate-intent — same-week follow-up"
              className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 no-underline hover:border-[#00d4ff]/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#94a3b8]" />
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold">Warm signals</p>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{warmSignals}</p>
              <p className="text-[11px] text-[#64748b] mt-2">Confidence 5–7</p>
            </a>
            <a
              href="#rfqs"
              title="Active fab-metal bid opportunities (NAICS 332/333/336)"
              className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 no-underline hover:border-[#00d4ff]/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Radar className="w-3.5 h-3.5 text-[#94a3b8]" />
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold">Active RFQs</p>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{rfqs.length}</p>
              <p className="text-[11px] text-[#64748b] mt-2">In your filter window</p>
            </a>
          </div>
        </section>

        <section id="signals" className="scroll-mt-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Buyer Signals</h2>
              <p className="text-[11px] text-[#64748b] mt-0.5">Last 14 days · sorted by confidence</p>
            </div>
            <div className="flex items-center gap-3">
              {signals.length > 0 && (
                <button
                  onClick={exportSignalsCsv}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#00d4ff] border border-[#00d4ff]/40 hover:border-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors rounded-md px-2.5 py-1"
                  title="Download all signals as CSV"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              )}
              <span className="text-xs text-[#64748b] tabular-nums">{signals.length} signals</span>
            </div>
          </div>
          {signals.length === 0 ? (
            <div className="bg-[#0a1628] border border-dashed border-[#1e3a5f] rounded-xl p-8 text-center">
              <Radar className="w-7 h-7 text-[#1e3a5f] mx-auto mb-2" />
              <p className="text-[#cbd5e1] text-sm font-semibold mb-1">Scanner is warming up</p>
              <p className="text-[#94a3b8] text-xs">No signals yet. New data flows in daily — check back tomorrow.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {signals.map((s) => {
                const conf = s.confidence ?? 0;
                const isHot = conf >= 8;
                const isWarm = conf >= 5 && conf < 8;
                const color = isHot ? "#22c55e" : isWarm ? "#00d4ff" : "#94a3b8";
                return (
                  <div
                    key={s.id}
                    className={`group relative bg-[#0a1628] border rounded-xl p-4 transition-all hover:border-[#00d4ff]/40 hover:-translate-y-0.5 ${
                      isHot ? "border-[#22c55e]/40" : "border-[#1e3a5f]"
                    }`}
                    style={isHot ? { boxShadow: "0 0 0 1px rgba(34,197,94,0.08), 0 0 24px -8px rgba(34,197,94,0.25)" } : undefined}
                  >
                    {/* Left accent bar */}
                    <span
                      className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r"
                      style={{ background: color }}
                    />
                    <div className="flex items-start justify-between gap-4 pl-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white truncate text-[15px]">{s.company_name}</h3>
                        <p className="text-[11px] text-[#94a3b8] mt-0.5">{[s.industry, s.location].filter(Boolean).join(" · ")}</p>
                        {s.source_summary && <p className="text-sm text-[#cbd5e1] mt-2 leading-relaxed">{s.source_summary}</p>}
                        {s.predicted_needs && s.predicted_needs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {s.predicted_needs.slice(0, 5).map((n) => (
                              <span
                                key={n}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          style={{ background: `${color}1a`, color, borderColor: `${color}40` }}
                          className="text-[11px] font-extrabold px-2.5 py-1 rounded-md whitespace-nowrap border tabular-nums"
                        >
                          {conf}/10
                        </span>
                        {isHot && (
                          <span className="text-[9px] uppercase tracking-widest font-bold text-[#22c55e]">● HOT</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="rfqs" className="scroll-mt-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">RFQ Intercept</h2>
              <p className="text-[11px] text-[#64748b] mt-0.5">Recent fab-metal bids · NAICS 332/333/336</p>
            </div>
            <span className="text-xs text-[#64748b] tabular-nums">{rfqs.length} bids</span>
          </div>
          {rfqs.length === 0 ? (
            <div className="bg-[#0a1628] border border-dashed border-[#1e3a5f] rounded-xl p-8 text-center">
              <Clock className="w-7 h-7 text-[#1e3a5f] mx-auto mb-2" />
              <p className="text-[#cbd5e1] text-sm font-semibold mb-1">No active RFQs</p>
              <p className="text-[#94a3b8] text-xs">Scanner runs daily across federal + state portals.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rfqs.map((r) => {
                const dueSoon = r.due_at && (new Date(r.due_at).getTime() - Date.now()) < 7 * 86_400_000;
                return (
                  <div
                    key={r.id}
                    className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 transition-all hover:border-[#00d4ff]/40 hover:-translate-y-0.5"
                  >
                    <h3 className="font-bold text-white text-[15px] leading-tight">{r.title}</h3>
                    <p className="text-[11px] text-[#94a3b8] mt-1.5">
                      {[r.agency, r.naics ? `NAICS ${r.naics}` : null, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs">
                      {r.due_at && (
                        <span className={`flex items-center gap-1 font-semibold ${dueSoon ? "text-amber-400" : "text-[#94a3b8]"}`}>
                          <Clock className="w-3 h-3" /> Due {new Date(r.due_at).toLocaleDateString()}
                          {dueSoon && <span className="ml-1 text-[9px] uppercase tracking-widest text-amber-400">soon</span>}
                        </span>
                      )}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[#00d4ff] font-semibold hover:underline ml-auto"
                        >
                          Open bid <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[10px] text-[#64748b] text-center max-w-2xl mx-auto pt-4">
          Buyer Radar uses public records, government bid portals, and behavioral signals only.
        </p>
      </main>
    </div>
  );
}
