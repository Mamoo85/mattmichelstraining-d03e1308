import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MissedCallPanel from "@/components/demo/MissedCallPanel";
import BuyerRadarPanel from "@/components/demo/BuyerRadarPanel";
import SizzleHero from "@/components/demo/SizzleHero";
import { useKioskMode, StartDemoButton, ExitKioskButton, FullscreenPrompt, KIOSK_GLOBAL_STYLES } from "@/components/demo/KioskMode";
import { AutoAdvance } from "@/components/demo/AutoAdvance";
import { DemoAnalyticsPanel, demoAnalytics } from "@/components/demo/DemoAnalytics";

interface DemoConfig {
  companyName: string;
  industry: string;
  tagline: string;
  accentColor: string;
  alertColor: string;
  logoEmoji: string;
  city: string;
  state: string;
  zip: string;
  currentSiteUrl: string;
  fakeVisitors: { company: string; page: string; time: string; badge: string; value: string }[];
  stats: {
    jobsToday: string;
    jobsSub: string;
    techsInField: string;
    techsSub: string;
    openRevenue: string;
    revenueSub: string;
    reviewScore: string;
    reviewSub: string;
  };
  yearOneSavings?: string;
  candidates?: { name: string; license: string; city: string; score: number; source: string }[];
  competitorPricing?: { name: string; price: string; note: string }[];
  ourPrice?: { name: string; price: string; note: string };
  sizzleVideoSrc?: string;
  buyerRadarValue?: string;
  missedCallStats?: { responseTime: string; coverage: string; recoveryRate: string };
}

const scoreColor = (s: number) => (s >= 8 ? "#dc2626" : s >= 7 ? "#e8621a" : "#f59e0b");

export default function DemoTemplate() {
  const { slug } = useParams<{ slug: string }>();
  const { kiosk, isFullscreen, requestFullscreen } = useKioskMode();
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    import(`@/data/demoConfigs/${slug}.json`)
      .then((m) => setConfig(m.default as DemoConfig))
      .catch(() => setError(`Demo config "${slug}" not found.`));
  }, [slug]);

  // Record a "view" once we have a slug + config (kiosk or not — every demo open counts)
  useEffect(() => {
    if (config) demoAnalytics.recordView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.companyName]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#060e1a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "-apple-system, sans-serif" }}>
        <p style={{ fontSize: 24, fontWeight: 800 }}>404 · {error}</p>
        <p style={{ color: "#64748b", marginTop: 8 }}>Drop a JSON file at <code>src/data/demoConfigs/{slug}.json</code> to enable this demo.</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ minHeight: "100vh", background: "#060e1a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#475569", letterSpacing: "0.3em", fontWeight: 700 }}>LOADING DEMO…</p>
      </div>
    );
  }

  const c = config;

  return (
    <div
      className={kiosk ? "kiosk-mode" : ""}
      style={{ minHeight: "100vh", background: "#060e1a", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <style>{KIOSK_GLOBAL_STYLES}</style>

      {/* Header */}
      <header
        data-demo-header
        style={{
          background: "#0a1628",
          borderBottom: "1px solid #1e3a5f",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: c.alertColor, borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {c.logoEmoji}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 15, letterSpacing: "-0.3px" }}>{c.companyName.toUpperCase()}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.tagline}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: c.accentColor, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Powered by Detroit Web Agency
          </p>
          <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>detroitwebagent.com · (313) 992-1219</p>
        </div>
      </header>

      <div style={{ maxWidth: kiosk ? 1400 : 1100, margin: "0 auto", padding: kiosk ? "20px 24px" : "24px 20px" }}>
        {/* Sizzle reel */}
        <section id="demo-sizzle" style={{ scrollMarginTop: 16 }}>
          <SizzleHero src={c.sizzleVideoSrc} kiosk={kiosk} companyName={c.companyName} />
        </section>

        <section id="demo-stats" style={{ scrollMarginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Jobs Today", value: c.stats.jobsToday, sub: c.stats.jobsSub, color: "#e8621a" },
              { label: "Techs in Field", value: c.stats.techsInField, sub: c.stats.techsSub, color: c.accentColor },
              { label: "Open Revenue", value: c.stats.openRevenue, sub: c.stats.revenueSub, color: "#10b981" },
              { label: "Avg Review Score", value: c.stats.reviewScore, sub: c.stats.reviewSub, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#0a1628", border: `1px solid ${s.color}30`, borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -8, right: -8, width: 60, height: 60, borderRadius: "50%", background: s.color, opacity: 0.08, filter: "blur(16px)" }} />
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                <p style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SiteRadar */}
        <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>👁 Companies Visiting {c.currentSiteUrl} Today</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>SiteRadar identifies businesses by IP — you see company names, not just traffic numbers</p>
            </div>
            <span style={{ background: `${c.accentColor}15`, border: `1px solid ${c.accentColor}40`, color: c.accentColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {c.fakeVisitors.map((v) => (
              <div key={v.company} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#060e1a", borderRadius: 10, padding: "10px 14px", border: "1px solid #1e3a5f" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{v.badge}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{v.company}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Viewed: {v.page}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 11, color: c.accentColor }}>{v.time}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#10b981", fontWeight: 700 }}>{v.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missed-Call */}
        <MissedCallPanel
          responseTime={c.missedCallStats?.responseTime}
          coverage={c.missedCallStats?.coverage}
          recoveryRate={c.missedCallStats?.recoveryRate}
        />

        {/* Buyer Radar */}
        <BuyerRadarPanel city={c.city} buyerRadarValue={c.buyerRadarValue} />

        {/* Pricing */}
        {c.competitorPricing && c.ourPrice && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${c.competitorPricing.length + 1}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {[...c.competitorPricing.map((p) => ({ ...p, bad: true })), { ...c.ourPrice, bad: false }].map((p) => (
              <div key={p.name} style={{ background: p.bad ? "#0a1628" : "#10b98110", border: `2px solid ${p.bad ? "#1e3a5f" : "#10b981"}`, borderRadius: 14, padding: "18px", textAlign: "center" }}>
                {!p.bad && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#10b981", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>✓ Best Value</p>}
                <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 15, color: p.bad ? "#94a3b8" : "#fff" }}>{p.name}</p>
                <p style={{ margin: "0 0 8px", fontWeight: 900, fontSize: 28, color: p.bad ? "#ef4444" : "#10b981" }}>{p.price}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{p.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Year-one savings */}
        {c.yearOneSavings && (
          <div style={{ background: "linear-gradient(135deg, #10b98115, #00d4ff10)", border: "1px solid #10b98130", borderRadius: 16, padding: "20px 24px", marginBottom: 20, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 900, color: "#10b981" }}>Save {c.yearOneSavings} in Year One</p>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Switching to the Detroit Web Agency stack</p>
          </div>
        )}

        {/* Talent Radar candidates */}
        {c.candidates && c.candidates.length > 0 && (
          <div style={{ background: "#0a1628", border: `1px solid ${c.accentColor}30`, borderRadius: 16, padding: "20px 24px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: c.accentColor, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ⚡ Talent Radar — $99/mo Add-On
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
              Available right now near {c.city}, {c.state}:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
              {c.candidates.map((cand) => (
                <div key={cand.name} style={{ background: "#060e1a", border: `1px solid ${scoreColor(cand.score)}40`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{cand.name} · {cand.city}</p>
                    <span style={{ background: `${scoreColor(cand.score)}20`, color: scoreColor(cand.score), borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>
                      {cand.score}/10
                    </span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>{cand.license} · via {cand.source}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#334155" }}>
          Detroit Web Agency · detroitwebagent.com · matt@detroitwebagent.com · (313) 992-1219
        </p>
      </div>

      {!kiosk && <StartDemoButton />}
      {kiosk && <ExitKioskButton />}
      {kiosk && !isFullscreen && <FullscreenPrompt onEnter={requestFullscreen} />}
    </div>
  );
}
