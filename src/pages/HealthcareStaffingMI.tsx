import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const painPoints = [
  { stat: "16%", label: "Michigan RN deficit (MHA 2025)", color: "#fbbf24" },
  { stat: "$20k+", label: "Margin per successful placement", color: ACCENT },
  { stat: "50+", label: "Staffing agencies in Metro Detroit", color: "#a78bfa" },
  { stat: "1.4★", label: "Avg facility rating in target ZIPs", color: "#f87171" },
];

const stack = [
  {
    title: "TechAlert — Healthcare Staffing Edition",
    desc: "Daily SMS the moment a SNF, hospital, or home-health agency posts an RN/LPN/CNA opening. Sourced from Indeed, LinkedIn, BLS Detroit metro, and SAM.gov federal contract awards.",
    price: "$149/mo",
    cta: "/talent-radar",
  },
  {
    title: "Medicare Star Scanner (sales ammo)",
    desc: "We pre-load your portal with every 1-star and 2-star facility in your service area. Walk in with the inspection findings, walk out with a contract. Zero cold-call awkwardness.",
    price: "Included",
    cta: "/contractor-marketplace",
  },
  {
    title: "Mortgage-grade outreach automation",
    desc: "Same multi-channel stack we built for loan officers — fax, postcard, SMS — repurposed for DON, HR Director, and Administrator decision-makers. Manual approval gate keeps you TCPA-clean.",
    price: "$99/mo add-on",
    cta: "/missed-call-text-back",
  },
];

const faqs = [
  {
    q: "Why healthcare staffing instead of all verticals?",
    a: "Focus wins. Michigan healthcare staffing is the smallest TAM with the most urgent pain and highest LTV. We dominate this beachhead first, then expand. You're not paying for tools that try to serve everyone.",
  },
  {
    q: "Are these real-time job alerts or scraped daily?",
    a: "Both. Indeed and LinkedIn pulls run every 4 hours. BLS and SAM.gov refresh weekly. SMS to your phone within 30 minutes of detection — fast enough to be the first agency calling.",
  },
  {
    q: "Do you handle the actual outreach?",
    a: "No. Every email and SMS draft requires your manual click-to-send. We build the list, draft the copy, surface the Medicare findings — you decide when to fire. This keeps you compliant and in control.",
  },
  {
    q: "What's the realistic ROI?",
    a: "One placement covers 10+ months of subscription. If TechAlert + Medicare ammo gets you in front of 3 facilities a week and you close 1 per quarter, you're up $19k/year net. We don't promise leads — we promise signal.",
  },
];

export default function HealthcareStaffingMI() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title="Healthcare Staffing Intelligence for Michigan Agencies | Detroit Web Agency"
        description="The signal stack built for Metro Detroit healthcare staffing agencies. Real-time RN/LPN/CNA job alerts, Medicare 1-star facility intel, and TCPA-clean outreach automation. $149/mo."
      />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 20px" }}>
        {/* Vertical badge */}
        <div style={{ display: "inline-block", background: `${ACCENT}15`, border: `1px solid ${ACCENT}50`, borderRadius: 999, padding: "6px 14px", marginBottom: 20 }}>
          <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Vertical · Michigan Healthcare Staffing</span>
        </div>

        <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.15, margin: "0 0 16px" }}>
          Own Michigan healthcare staffing.<br />
          <span style={{ color: ACCENT }}>One vertical. One playbook.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 17, lineHeight: 1.7, margin: "0 0 40px", maxWidth: 720 }}>
          You're a Metro Detroit healthcare staffing agency. The nursing shortage isn't slowing down — and the
          facilities with the worst Medicare star ratings are the ones most desperate to fill shifts. We give you
          the signal stack to be first in line, every time. No fluff. No tools you won't use.
        </p>

        {/* Pain stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 56 }}>
          {painPoints.map((p, i) => (
            <div key={i} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 10, padding: "20px 18px" }}>
              <div style={{ color: p.color, fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 6 }}>{p.stat}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>{p.label}</div>
            </div>
          ))}
        </div>

        {/* Stack */}
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 20px" }}>The healthcare-staffing stack</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 56 }}>
          {stack.map((s, i) => (
            <div key={i} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 12, padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 800, margin: 0 }}>{s.title}</h3>
                <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14 }}>{s.price}</span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.65, margin: "0 0 12px" }}>{s.desc}</p>
              <Link to={s.cta} style={{ color: ACCENT, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Learn more →</Link>
            </div>
          ))}
        </div>

        {/* Honest framing */}
        <div style={{ background: "#0d1f3c", border: `2px solid ${ACCENT}30`, borderRadius: 12, padding: "24px 26px", marginBottom: 56 }}>
          <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 10px" }}>What we are — and aren't</p>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.7, margin: "0 0 12px" }}>
            <strong style={{ color: "#fff" }}>We are:</strong> a signal layer. We surface job postings, facility ratings, and decision-maker contacts so you can act first.
          </p>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: "#fff" }}>We are NOT:</strong> a recruiting CRM, an ATS replacement, or a pretend-AI auto-dialer. You still own the relationship and the close. We just make sure you're never the second call.
          </p>
        </div>

        {/* FAQ */}
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 20px" }}>Questions Metro Detroit agencies ask</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 56 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 10, padding: "18px 22px" }}>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: "0 0 8px" }}>{f.q}</p>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "40px 24px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}40`, borderRadius: 12 }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 6 }}>Built for one vertical. One state. One mission.</p>
          <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>Be the first agency on every open shift.</p>
          <Link
            to="/talent-radar"
            style={{ display: "inline-block", background: ACCENT, color: "#0a1628", fontWeight: 800, fontSize: 16, padding: "14px 36px", borderRadius: 8, textDecoration: "none" }}
          >
            Start with TechAlert — $149/mo →
          </Link>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 14 }}>
            Or text Matt directly: <a href="sms:+13139921219" style={{ color: ACCENT, textDecoration: "none" }}>(313) 992-1219</a>
          </p>
        </div>
      </div>
    </div>
  );
}
