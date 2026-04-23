import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const rows = [
  { label: "Legal status", trigger: "❌ Banned — H.R. 2808 effective March 4, 2026", radar: "✅ 100% legal — FCRA-clean public records only" },
  { label: "Data source", trigger: "Credit bureau pull (requires consumer consent now)", radar: "Renovation permits, FSBOs, lis pendens, new LLCs — all public" },
  { label: "FCRA compliance", trigger: "Gray area — required opt-in since March 4th", radar: "Fully compliant — no bureau data, no consent requirement" },
  { label: "Lead exclusivity", trigger: "Same lead sold to multiple lenders simultaneously", radar: "48-hour claim lock — you're the only LO working that signal" },
  { label: "Cost per signal", trigger: "$30–100 per trigger lead (shared with competitors)", radar: "10–25 signals/day in your ZIPs — under $20/signal at $399/mo" },
  { label: "Signal timing", trigger: "Fires when borrower pulls credit — they're already talking to lenders", radar: "Fires before they shop — renovation permit = they need financing now" },
  { label: "Call opener quality", trigger: "Borrower is being bombarded by calls from 5+ lenders", radar: "Borrower hasn't been called yet — you're the first relevant contact" },
];

export default function MortgageRadarVsTriggerLeads() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title="Mortgage Radar vs Trigger Leads — The Legal Alternative After H.R. 2808 | Detroit Web Agency"
        description="H.R. 2808 banned credit bureau trigger leads on March 4, 2026. Mortgage Radar is the FCRA-clean replacement — public records signals (permits, FSBOs, lis pendens) with 48-hour exclusive claim locks. $399/mo for Metro Detroit loan officers."
      />

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 20px" }}>
        {/* Alert banner */}
        <div style={{ background: "#7f1d1d", border: "1px solid #dc2626", borderRadius: 8, padding: "14px 20px", marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 14, color: "#fecaca", lineHeight: 1.6 }}>
            <strong>H.R. 2808 — Homebuyers Privacy Protection Act</strong> went into effect March 4, 2026.
            Credit bureaus can no longer sell trigger leads without explicit consumer consent or an existing account relationship.
            Trigger leads as you knew them are gone.
          </p>
        </div>

        <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>Mortgage Radar vs Trigger Leads</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, margin: "0 0 16px" }}>
          Trigger leads are banned.<br />
          <span style={{ color: ACCENT }}>Here's what replaced them.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 48px" }}>
          Mortgage Radar uses 100% public records — renovation permits, for-sale-by-owner listings,
          foreclosure filings, new LLC registrations — to identify homeowners who need financing
          before they start shopping. You reach them first. No bureau data. No consent issues. No competition.
        </p>

        <div style={{ overflowX: "auto", marginBottom: 48 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #1e3a5f", width: "30%" }}></th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#94a3b8", fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>Trigger Leads</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: ACCENT, fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>Mortgage Radar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#0d1f3c" : "transparent" }}>
                  <td style={{ padding: "14px 16px", color: "#ffffff", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.label}</td>
                  <td style={{ padding: "14px 16px", color: "#94a3b8", borderBottom: "1px solid #1e3a5f1a" }}>{r.trigger}</td>
                  <td style={{ padding: "14px 16px", color: "#e2e8f0", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.radar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: "#0d1f3c", border: `2px solid ${ACCENT}30`, borderRadius: 12, padding: "28px 32px", marginBottom: 48 }}>
          <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 8px" }}>FCRA Compliance Statement</p>
          <ul style={{ margin: 0, padding: "0 0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.9 }}>
            <li>100% public records and behavioral signals — no consumer credit data</li>
            <li>We do NOT access, purchase, or resell credit-bureau trigger leads</li>
            <li>No consumer consent required — all data is public record</li>
            <li>All outreach drafts must be manually approved and sent by the licensed loan officer</li>
            <li>Fully compliant with H.R. 2808 (Homebuyers Privacy Protection Act)</li>
          </ul>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Exclusive to your ZIP codes. One loan officer per territory. Built for Metro Detroit.</p>
          <Link
            to="/mortgage-radar"
            style={{ display: "inline-block", background: ACCENT, color: "#0a1628", fontWeight: 800, fontSize: 16, padding: "14px 36px", borderRadius: 8, textDecoration: "none" }}
          >
            Get Mortgage Radar — $399/mo →
          </Link>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>FCRA-clean. Cancel anytime. No bureau data. Ever.</p>
        </div>
      </div>
    </div>
  );
}
