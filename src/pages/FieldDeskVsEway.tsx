import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const rows = [
  { label: "Monthly cost (8 techs)", eway: "$216–320/mo ($27–40 per user)", fielddesk: "$199/mo flat — unlimited techs" },
  { label: "Where it runs", eway: "Microsoft Outlook — desktop only", fielddesk: "Any phone, tablet, or browser — works in a boiler room" },
  { label: "GPS tech tracking", eway: "❌ Not available", fielddesk: "✅ Live map, real-time positions" },
  { label: "Customer auto-SMS", eway: "❌ Not available", fielddesk: "✅ Auto-text on dispatch, en route, complete" },
  { label: "Job dispatch board", eway: "❌ Email tagging only", fielddesk: "✅ Drag-and-drop board, tech availability visible" },
  { label: "Mobile job notes + photos", eway: "❌ Requires Outlook desktop", fielddesk: "✅ Tech uploads from job site in real time" },
  { label: "Review requests", eway: "❌ Not built in", fielddesk: "✅ Auto-sent after job close" },
  { label: "Cost as you hire", eway: "Price goes up $27–40 per new tech", fielddesk: "Price stays $199/mo — hire freely" },
];

export default function FieldDeskVsEway() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title="FieldDesk vs eWay CRM — $199/mo Flat vs $27/User | Detroit Web Agency"
        description="Compare FieldDesk to eWay CRM. eWay is an Outlook plugin that requires a desktop — no GPS, no dispatch, no mobile. FieldDesk is $199/mo flat for your entire crew with live dispatch, GPS tracking, and auto-SMS."
      />

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 20px" }}>
        <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>FieldDesk vs eWay CRM</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, margin: "0 0 16px" }}>
          eWay is an Outlook plugin.<br />
          <span style={{ color: ACCENT }}>Your techs aren't at a desk.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 48px" }}>
          eWay CRM is built for office workers who manage email. It requires Microsoft Outlook on a desktop.
          It has no dispatch board, no GPS, no auto-SMS to customers, and it charges you $27–40 per user —
          every new hire costs you more. FieldDesk is $199/month flat, works on any phone, and was built for
          companies where the work happens in crawl spaces, boiler rooms, and job sites.
        </p>

        <div style={{ overflowX: "auto", marginBottom: 48 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #1e3a5f", width: "30%" }}></th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#94a3b8", fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>eWay CRM</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: ACCENT, fontWeight: 700, borderBottom: "1px solid #1e3a5f" }}>FieldDesk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#0d1f3c" : "transparent" }}>
                  <td style={{ padding: "14px 16px", color: "#ffffff", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.label}</td>
                  <td style={{ padding: "14px 16px", color: "#94a3b8", borderBottom: "1px solid #1e3a5f1a" }}>{r.eway}</td>
                  <td style={{ padding: "14px 16px", color: "#e2e8f0", fontWeight: 600, borderBottom: "1px solid #1e3a5f1a" }}>{r.fielddesk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: "#0d1f3c", border: `2px solid ${ACCENT}30`, borderRadius: 12, padding: "28px 32px", marginBottom: 48, textAlign: "center" }}>
          <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 8px" }}>8-Tech Company Math</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>Switch from eWay and save <span style={{ color: ACCENT }}>$4,500+/year</span></p>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
            eWay at $27/user × 8 techs = $216/mo ($2,592/yr). FieldDesk = $199/mo ($2,388/yr).
            You save $204/year on price alone — plus your techs can actually use it in the field.
            With Jobber's Growth plan and 8 techs? You're paying $580+/mo. FieldDesk saves you $4,584/year.
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Built for Metro Detroit field service companies. Flat rate, unlimited techs.</p>
          <Link
            to="/field-service"
            style={{ display: "inline-block", background: ACCENT, color: "#0a1628", fontWeight: 800, fontSize: 16, padding: "14px 36px", borderRadius: 8, textDecoration: "none" }}
          >
            See FieldDesk — $199/mo →
          </Link>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>No per-user fees. No contracts. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
