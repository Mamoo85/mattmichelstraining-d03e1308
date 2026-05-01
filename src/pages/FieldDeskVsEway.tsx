import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

/**
 * Honest rewrite (per master plan §5).
 * Old version made strong "eWay can't do X" claims that aren't all defensible.
 * New framing: the products are different shapes for different shops. If you love
 * eWay, keep it and add our Marketing Layer. If you want one consolidated tool
 * built for the field, FieldDesk wins on price and mobility.
 */

const honestComparison = [
  {
    label: "Where it lives",
    eway: "Outlook plugin — your office is the user, customers are invisible",
    fielddesk: "Mobile-first — works in a boiler room on a phone",
    note: "If your team lives in Outlook, eWay is the right shape. If your team lives in trucks, FieldDesk is.",
  },
  {
    label: "Pricing model",
    eway: "Per-user (~$24–40/user/mo)",
    fielddesk: "$199/mo flat — unlimited techs",
    note: "8 techs on eWay = $192–320/mo. 25 techs = $600–1,000/mo. FieldDesk stays $199.",
  },
  {
    label: "Customer-facing SMS",
    eway: "Not a built-in workflow",
    fielddesk: "Auto-text on dispatch, en route, and complete",
    note: "Either tool can be wired to send SMS via integrations. Out-of-the-box, FieldDesk does it; eWay needs a separate add-on.",
  },
  {
    label: "GPS / live tech tracking",
    eway: "Not a core feature",
    fielddesk: "Live map of all techs",
    note: "If you need to see where the crew is right now, you'll need a separate tool to add it onto eWay.",
  },
  {
    label: "Outlook + Office 365 sync",
    eway: "Native — this is its strength",
    fielddesk: "Via Zapier / API",
    note: "If your contracts, projects, and email all live in Outlook, eWay's deep integration is hard to beat.",
  },
  {
    label: "Setup + workflow change",
    eway: "Already deployed if you have it",
    fielddesk: "1–2 day setup, dual-run option available",
    note: "Switching tools is real work. We'd rather sell you the Marketing Layer than burn your team on a migration you don't need.",
  },
];

export default function FieldDeskVsEway() {
  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        color: "#e2e8f0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <SEOHead
        title="FieldDesk vs eWay CRM — Honest Comparison | Detroit Web Agency"
        description="eWay CRM and FieldDesk are different shapes for different shops. eWay shines for office-based teams in Outlook. FieldDesk is built for mobile field crews at $199/mo flat. Here's the honest comparison."
      />

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px" }}>
        <p
          style={{
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          FieldDesk vs eWay CRM · honest comparison
        </p>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            lineHeight: 1.2,
            margin: "0 0 18px",
          }}
        >
          Two different tools.{" "}
          <span style={{ color: ACCENT }}>Two different shops.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 36px" }}>
          We're not here to trash eWay. It's a real product with real strengths —
          especially if your business runs out of Outlook. FieldDesk is shaped
          differently: mobile-first, flat-rate, built around dispatch and customer
          SMS. Below is the straight comparison so you can pick what actually fits.
        </p>

        <div style={{ overflowX: "auto", marginBottom: 36 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #1e3a5f", width: "22%" }}></th>
                <th style={{ textAlign: "left", padding: "12px 14px", color: "#94a3b8", fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>eWay CRM</th>
                <th style={{ textAlign: "left", padding: "12px 14px", color: ACCENT, fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>FieldDesk</th>
              </tr>
            </thead>
            <tbody>
              {honestComparison.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#0d1f3c" : "transparent", verticalAlign: "top" }}>
                  <td style={{ padding: "14px 14px", color: "#fff", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.label}</td>
                  <td style={{ padding: "14px 14px", color: "#94a3b8", borderBottom: "1px solid #1e3a5f1a" }}>
                    <div>{r.eway}</div>
                  </td>
                  <td style={{ padding: "14px 14px", color: "#e2e8f0", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>
                    <div>{r.fielddesk}</div>
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 400, marginTop: 4 }}>{r.note}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 32 }}>
          <div
            style={{
              background: "#0d1f3c",
              border: `1px solid ${ACCENT}30`,
              borderRadius: 12,
              padding: "22px 24px",
            }}
          >
            <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 8px" }}>
              Already happy with eWay?
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
              Don't switch. Add the Marketing Layer.
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
              Customer SMS, review automation, missed-call text-back, and Predictive
              Sales alerts — bolted on top of your eWay workflow. $149/mo flat.
            </p>
            <Link
              to="/marketing-layer-for-eway"
              style={{
                color: ACCENT,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                borderBottom: `1px solid ${ACCENT}`,
                paddingBottom: 2,
              }}
            >
              See the Marketing Layer →
            </Link>
          </div>

          <div
            style={{
              background: "#0d1f3c",
              border: `1px solid ${ACCENT}30`,
              borderRadius: 12,
              padding: "22px 24px",
            }}
          >
            <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 8px" }}>
              Want to consolidate?
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
              FieldDesk migration path
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
              Dual-run period so nothing breaks. Import customers, jobs, and history
              from eWay. Move your team off Outlook on your timeline.
            </p>
            <Link
              to="/fielddesk-migration"
              style={{
                color: ACCENT,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                borderBottom: `1px solid ${ACCENT}`,
                paddingBottom: 2,
              }}
            >
              See the migration path →
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link
            to="/field-service"
            style={{
              display: "inline-block",
              background: ACCENT,
              color: "#0a1628",
              fontWeight: 800,
              fontSize: 16,
              padding: "14px 36px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            See FieldDesk — $199/mo flat →
          </Link>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>
            No per-user fees. No contracts. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
