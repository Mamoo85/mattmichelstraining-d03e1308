import { useState } from "react";
import TechMap from "@/components/field-service/TechMap";
import DispatchBoard from "@/components/field-service/DispatchBoard";

// ── Fake SiteRadar visitor data for demo ──────────────────────────────────────
const DEMO_VISITORS = [
  { company: "Stellantis Facilities Mgmt", page: "Boiler Tune-Up Services", time: "14 min ago", badge: "🏭" },
  { company: "Detroit Medical Center", page: "Service Contracts", time: "1h 22m ago", badge: "🏥" },
  { company: "Wayne County Schools", page: "Homepage", time: "2h 51m ago", badge: "🏫" },
];

// ── Fake tech alert candidates ────────────────────────────────────────────────
const DEMO_CANDIDATES = [
  { name: "James P.", license: "1st Class Boiler Op", city: "Warren", score: 9, source: "MIOSHA" },
  { name: "Kevin M.", license: "2nd Class Boiler Op", city: "Sterling Heights", score: 7, source: "Apollo" },
];

const scoreColor = (s: number) => s >= 8 ? "#dc2626" : s >= 7 ? "#e8621a" : "#f59e0b";

export default function DJConleyDemo2() {
  const [activeSection, setActiveSection] = useState<"dispatch" | "map">("dispatch");

  return (
    <div style={{ minHeight: "100vh", background: "#060e1a", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Top Nav ── */}
      <header style={{ background: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "#dc2626", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔥</div>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 15, letterSpacing: "-0.3px" }}>D.J. CONLEY ASSOCIATES</p>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Field Operations Command Center</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#00d4ff", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Powered by Detroit Web Agency</p>
          <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>detroitwebagent.com · (313) 806-4952</p>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── Stat Strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Jobs Today", value: "7", sub: "2 emergency", color: "#e8621a", icon: "⚡" },
            { label: "Techs in Field", value: "4", sub: "All active now", color: "#00d4ff", icon: "📍" },
            { label: "Open Revenue", value: "$34,200", sub: "Pending invoices", color: "#10b981", icon: "💰" },
            { label: "Avg Review Score", value: "4.8 ⭐", sub: "Last 30 days", color: "#f59e0b", icon: "🏆" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0a1628", border: `1px solid ${s.color}30`, borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -8, right: -8, width: 60, height: 60, borderRadius: "50%", background: s.color, opacity: 0.08, filter: "blur(16px)" }} />
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── SiteRadar — Visitor Intel ── */}
        <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#fff" }}>👁 Companies Visiting DJConley.com Today</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>SiteRadar identifies businesses by IP — you see company names, not just traffic numbers</p>
            </div>
            <span style={{ background: "#00d4ff15", border: "1px solid #00d4ff40", color: "#00d4ff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DEMO_VISITORS.map((v) => (
              <div key={v.company} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#060e1a", borderRadius: 10, padding: "10px 14px", border: "1px solid #1e3a5f" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{v.badge}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#fff" }}>{v.company}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Viewed: {v.page}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#00d4ff" }}>{v.time}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>Potential lead</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#475569", textAlign: "center" }}>
            eWay-CRM shows you nothing. We tell you Stellantis Facilities was on your site 14 minutes ago.
          </p>
        </div>

        {/* ── Dispatch Board / Map Toggle ── */}
        <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f" }}>
            {(["dispatch", "map"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSection(tab)}
                style={{ flex: 1, padding: "12px", fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none", transition: "all 0.15s", background: activeSection === tab ? "#060e1a" : "transparent", color: activeSection === tab ? "#00d4ff" : "#64748b", borderBottom: activeSection === tab ? "2px solid #00d4ff" : "2px solid transparent" }}
              >
                {tab === "dispatch" ? "📋 Dispatch Board" : "🗺 Live Tech Map"}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {activeSection === "dispatch"
              ? <DispatchBoard clientId="demo" />
              : <TechMap clientId="demo" />
            }
          </div>
        </div>

        {/* ── eWay vs FieldDesk ── */}
        <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 16px", fontWeight: 800, fontSize: 15 }}>📊 What Pat Actually Needs — Does eWay Do It?</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e3a5f" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>What Pat Needs</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>eWay-CRM</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: "#94a3b8", fontWeight: 600 }}>FieldDesk</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["See where his techs are right now", false, true],
                  ["Auto-text customer when tech is 10 min away", false, true],
                  ["Missed call → instant auto-text back", false, true],
                  ["Work offline in a basement", false, true],
                  ["Get Google reviews automatically after jobs", false, true],
                  ["Know when a building manager visits his website", false, true],
                  ["SMS blast for seasonal tune-ups", false, true],
                  ["Revenue pipeline graphs on a real dashboard", false, true],
                ].map(([need, eway, fd]) => (
                  <tr key={need as string} style={{ borderBottom: "1px solid #0f1f35" }}>
                    <td style={{ padding: "9px 12px", color: "#cbd5e1" }}>{need as string}</td>
                    <td style={{ textAlign: "center", padding: "9px 12px", color: "#ef4444", fontWeight: 700 }}>{eway ? "✓" : "✗ No"}</td>
                    <td style={{ textAlign: "center", padding: "9px 12px", color: "#10b981", fontWeight: 700 }}>{fd ? "✓ Yes" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "#f59e0b", fontWeight: 700, textAlign: "center" }}>
            eWay is a secretary tool. FieldDesk is a field operations command center.
          </p>
        </div>

        {/* ── Price Comparison ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { name: "FieldServio", price: "$1,400/mo", note: "Built for forklift rental companies", color: "#ef4444", bad: true },
            { name: "eWay-CRM", price: "$300–400/mo", note: "An Outlook plugin. For desk workers.", color: "#f59e0b", bad: true },
            { name: "FieldDesk", price: "$199/mo", note: "Unlimited users. Built for boiler rooms.", color: "#10b981", bad: false },
          ].map((p) => (
            <div key={p.name} style={{ background: p.bad ? "#0a1628" : "#10b98110", border: `2px solid ${p.bad ? "#1e3a5f" : "#10b981"}`, borderRadius: 14, padding: "18px", textAlign: "center" }}>
              {!p.bad && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#10b981", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>✓ Best Value</p>}
              <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 15, color: p.bad ? "#94a3b8" : "#fff" }}>{p.name}</p>
              <p style={{ margin: "0 0 8px", fontWeight: 900, fontSize: 28, color: p.color }}>{p.price}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{p.note}</p>
            </div>
          ))}
        </div>

        {/* ── Savings Banner ── */}
        <div style={{ background: "linear-gradient(135deg, #10b98115, #00d4ff10)", border: "1px solid #10b98130", borderRadius: 16, padding: "20px 24px", marginBottom: 20, textAlign: "center" }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#94a3b8" }}>Switching from FieldServio to FieldDesk</p>
          <p style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 900, color: "#10b981" }}>Save $14,412 in Year One</p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>$1,400/mo → $199/mo × 12 months = $14,412 back in Pat's pocket</p>
        </div>

        {/* ── TechAlert Kicker ── */}
        <div style={{ background: "#0a1628", border: "1px solid #00d4ff30", borderRadius: 16, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#00d4ff", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>⚡ TechAlert — $99/mo Add-On</p>
              <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 16 }}>Need to hire a licensed boiler op?<br />We know before anyone else.</p>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                Michigan MIOSHA publishes every licensed boiler operator in the state. The day a new license is issued — a tech just became available — we alert you first. No other hiring tool watches this.
              </p>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", fontWeight: 600 }}>Available right now near Warren:</p>
              {DEMO_CANDIDATES.map((c) => (
                <div key={c.name} style={{ background: "#060e1a", border: `1px solid ${scoreColor(c.score)}40`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{c.name} · {c.city}</p>
                    <span style={{ background: `${scoreColor(c.score)}20`, color: scoreColor(c.score), borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>Score {c.score}/10</span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>{c.license} · via {c.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#334155" }}>
          Detroit Web Agency · detroitwebagent.com · matt@mattmichelstraining.com · (313) 806-4952
        </p>

      </div>
    </div>
  );
}
