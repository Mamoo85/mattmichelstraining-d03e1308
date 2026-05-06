import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, FileText, Phone, ArrowRight, ExternalLink } from "lucide-react";

const MAIN_BULLETS = [
  "The 5 non-negotiables of a contractor website (with Detroit market benchmarks)",
  "Which GBP category beats competitors by trade — HVAC, roofing, plumbing, electrical",
  "The seasonal revenue calendar for SE Michigan contractors",
  "Missed-call recovery system that recaptures 30–40% of lost leads",
  "Review automation: reach 100+ Google reviews in under 12 months",
  "90-day launch checklist — week-by-week, no guesswork",
];

const OTHER_BLUEPRINTS = [
  {
    title: "The SE Michigan Roofer's Lead Machine",
    sub: "Find storm leads before homeowners call anyone",
    href: "/blueprint/roofing-radar.html",
    badge: "Roofing",
    color: "#ff6b35",
    cta: "Free Roofing Radar trial →",
    trialLink: "/start-trial?product=trade_radar_roofing",
  },
  {
    title: "The Metro Detroit LO's Referral Pipeline",
    sub: "FSBO, probate & divorce signals for loan officers",
    href: "/blueprint/mortgage-radar.html",
    badge: "Mortgage",
    color: "#00d4ff",
    cta: "Free Mortgage Radar trial →",
    trialLink: "/start-trial?product=mortgage_radar",
  },
  {
    title: "The Trades Hiring Blueprint",
    sub: "Find licensed techs before they post their resume",
    href: "/blueprint/hiring-blueprint.html",
    badge: "Hiring",
    color: "#a78bfa",
    cta: "Free TechAlert trial →",
    trialLink: "/start-trial?product=techalert",
  },
];

export default function BlueprintLanding() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleFree = async () => {
    if (!email || !email.includes("@")) {
      alert("Enter your email to get the blueprint.");
      return;
    }
    setLoading(true);
    // Store email fire-and-forget — don't block on it
    supabase.from("blueprint_signups" as any).upsert(
      { email: email.trim().toLowerCase(), blueprint: "contractor_website", source: "blueprint_landing" },
      { onConflict: "email,blueprint" }
    ).then(() => {}).catch(() => {});
    // Open blueprint in new tab
    window.open("/blueprint/index.html", "_blank");
    setDone(true);
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Free Contractor Website Blueprint — Detroit Web Agency</title>
        <meta name="description" content="The exact system Metro Detroit contractors use to turn their website into a 24/7 lead machine. Detroit-specific market data, GBP setup by trade, missed-call recovery, 90-day checklist." />
      </Helmet>

      <div style={{ background: "#0a1628", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

        {/* NAV */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="/" style={{ color: "#00d4ff", fontWeight: 900, fontSize: "15px", letterSpacing: "-0.01em", textDecoration: "none" }}>
            Detroit Web Agency
          </a>
          <a href="tel:+13139921219" style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
            <Phone size={14} />
            (313) 992-1219
          </a>
        </div>

        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "60px 24px 80px" }}>

          {/* FREE BADGE */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "20px", padding: "6px 14px", marginBottom: "28px" }}>
            <FileText size={13} color="#00d4ff" />
            <span style={{ color: "#00d4ff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>100% Free · No Credit Card</span>
          </div>

          <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            The Contractor<br />
            <span style={{ color: "#00d4ff" }}>Website Blueprint</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "17px", lineHeight: 1.65, marginBottom: "40px", maxWidth: "580px" }}>
            Everything a Metro Detroit contractor needs to turn their website into a 24/7 lead machine — with actual Detroit market data, not generic advice you can Google.
          </p>

          {/* BULLETS */}
          <div style={{ marginBottom: "40px" }}>
            {MAIN_BULLETS.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", alignItems: "flex-start" }}>
                <CheckCircle size={17} color="#00d4ff" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "15px", lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* FREE CAPTURE BOX */}
          {!done ? (
            <div style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "16px", padding: "32px", marginBottom: "40px" }}>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ color: "#fff", fontSize: "22px", fontWeight: 900 }}>Free Download</span>
                <span style={{ background: "#00d4ff", color: "#0a1628", fontSize: "11px", fontWeight: 900, padding: "3px 8px", borderRadius: "4px", marginLeft: "10px", letterSpacing: "0.05em", verticalAlign: "middle" }}>NO COST</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "20px", marginTop: "4px" }}>Enter your email and get instant access.</p>

              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFree()}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontSize: "15px",
                  marginBottom: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={handleFree}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "none",
                  background: loading ? "rgba(0,212,255,0.4)" : "#00d4ff",
                  color: "#0a1628",
                  fontSize: "16px",
                  fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {loading ? "Opening blueprint…" : (<><span>Get the Free Blueprint</span><ArrowRight size={18} /></>)}
              </button>
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", textAlign: "center", marginTop: "10px", marginBottom: 0 }}>
                No spam. No subscription. Just the blueprint.
              </p>
            </div>
          ) : (
            <div style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "16px", padding: "28px", marginBottom: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: "18px", marginBottom: "8px" }}>Blueprint is open in a new tab.</div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "16px" }}>
                Didn't open? <a href="/blueprint/index.html" target="_blank" rel="noreferrer" style={{ color: "#00d4ff", textDecoration: "none" }}>Click here to access it directly →</a>
              </p>
              <a href="/start-trial?product=field_desk" style={{ display: "inline-block", background: "#00d4ff", color: "#0a1628", fontWeight: 900, fontSize: "14px", padding: "12px 24px", borderRadius: "8px", textDecoration: "none" }}>
                Try FieldDesk Free for 7 Days →
              </a>
            </div>
          )}

          {/* OTHER BLUEPRINTS */}
          <div style={{ marginBottom: "48px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "20px" }}>
              More Free Blueprints
            </div>
            {OTHER_BLUEPRINTS.map((bp, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px 24px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ background: `${bp.color}20`, border: `1px solid ${bp.color}40`, color: bp.color, fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.08em" }}>
                      {bp.badge}
                    </span>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{bp.title}</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px" }}>{bp.sub}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
                  <a href={bp.href} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px" }}>
                    <ExternalLink size={12} /> Read
                  </a>
                  <a href={bp.trialLink} style={{ color: bp.color, fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", padding: "8px 12px", background: `${bp.color}15`, border: `1px solid ${bp.color}30`, borderRadius: "6px" }}>
                    {bp.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* ABOUT */}
          <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#fff", fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>Written by Matt Michels · Detroit Web Agency</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.6 }}>
              Based in Grosse Pointe, MI. Building websites and automated lead systems for Metro Detroit trade businesses. Questions? Text directly: <a href="tel:+13139921219" style={{ color: "#00d4ff", textDecoration: "none" }}>(313) 992-1219</a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
