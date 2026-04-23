import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const rows = [
  { label: "Cost per hire", staffing: "$12,000–$18,000 (20–30% of salary)", radar: "$149/mo — regardless of how many you hire" },
  { label: "Speed to candidate", staffing: "2–6 weeks to source", radar: "Alerts fire the morning a new license goes active" },
  { label: "Who else gets the candidate", staffing: "Staffing agency shops to multiple employers", radar: "You only — no other company sees your alert" },
  { label: "Ongoing monitoring", staffing: "None — you pay per search, per hire", radar: "Daily scans, 365 days a year" },
  { label: "Healthcare coverage", staffing: "Limited to agency's candidate pool", radar: "Every CNA, LPN, RN licensed in Michigan via BPL + NPI" },
  { label: "Trades coverage", staffing: "General job postings — whoever applies", radar: "MIOSHA + LARA database — every licensed tradesperson in MI" },
  { label: "Contract", staffing: "Per-placement fee — often non-refundable", radar: "Monthly, cancel anytime" },
];

export default function TalentRadarVsStaffing() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title="Talent Radar vs Staffing Agency — $149/mo vs $18,000 Per Hire | Detroit Web Agency"
        description="Compare Talent Radar to traditional staffing agencies. One hire with a staffing agency costs $12,000–$18,000. Talent Radar is $149/month — and monitors every licensed tradesperson in Michigan, daily."
      />

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 20px" }}>
        {/* Hero */}
        <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>Talent Radar vs Staffing Agency</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, margin: "0 0 16px" }}>
          One hire with a staffing agency costs <span style={{ color: ACCENT }}>$15,000.</span><br />
          Talent Radar is $149/month — forever.
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 48px" }}>
          A single licensed HVAC tech generates $80K–120K/year in billable revenue for your company.
          Staffing agencies charge 20–30% of that salary — once. Then you pay again for the next hire.
          Talent Radar monitors every licensed tradesperson in Michigan, every morning, for a flat monthly fee.
          One hire pays for 8 years of the service.
        </p>

        {/* Comparison table */}
        <div style={{ overflowX: "auto", marginBottom: 48 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #1e3a5f", width: "30%" }}></th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#94a3b8", fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>Staffing Agency</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: ACCENT, fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>Talent Radar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#0d1f3c" : "transparent" }}>
                  <td style={{ padding: "14px 16px", color: "#ffffff", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.label}</td>
                  <td style={{ padding: "14px 16px", color: "#94a3b8", borderBottom: "1px solid #1e3a5f1a" }}>{r.staffing}</td>
                  <td style={{ padding: "14px 16px", color: "#e2e8f0", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.radar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The math */}
        <div style={{ background: "#0d1f3c", border: `2px solid ${ACCENT}30`, borderRadius: 12, padding: "28px 32px", marginBottom: 48, textAlign: "center" }}>
          <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 8px" }}>The Math</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>One hire pays for <span style={{ color: ACCENT }}>8 years</span> of Talent Radar</p>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
            Staffing agency charges $15,000 for one HVAC tech. Talent Radar: $149/mo × 12 = $1,788/year.
            One hire via Talent Radar vs. staffing agency saves you <strong style={{ color: "#fff" }}>$13,212</strong> — enough to fund the service for over 7 years.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Michigan's only hiring monitor that checks the MIOSHA license database every morning.</p>
          <Link
            to="/hire-alert"
            style={{ display: "inline-block", background: ACCENT, color: "#0a1628", fontWeight: 800, fontSize: 16, padding: "14px 36px", borderRadius: 8, textDecoration: "none" }}
          >
            Start Talent Radar — $149/mo →
          </Link>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>Cancel anytime. No placement fees. Ever.</p>
        </div>
      </div>
    </div>
  );
}
