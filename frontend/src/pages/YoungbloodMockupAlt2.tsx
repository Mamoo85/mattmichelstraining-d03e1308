import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import { ChevronRight, Phone, Mail, MapPin, Cpu, Settings, Shield, Zap, ArrowRight, CheckCircle, Menu, X } from "lucide-react";

// ─── Design: "Precision Engineering" — Swiss Grid / German Industrial Minimal ───
// Colors: Deep Navy #0A1628, Electric Blue #0066FF, Steel Grey #8896A8, Off-white #F4F6F9
// Typography: Inter/system, weight 300-700, tight grid, technical precision
// No decorative elements — only data, specs, and clean geometry

const NAVY = "#0A1628";
const BLUE = "#0066FF";
const STEEL = "#8896A8";
const OFFWHITE = "#F4F6F9";
const WHITE = "#FFFFFF";
const BORDER = "#1E3050";

const SOLUTIONS = [
  { id: "01", label: "Pneumatics", desc: "Manifold assemblies, valve islands, FRL units, and custom pneumatic panels for OEM and end-user applications." },
  { id: "02", label: "Electro-Pneumatic", desc: "Integrated solenoid valve panels, proportional control systems, and hybrid pneumatic-electric solutions." },
  { id: "03", label: "Hydraulics", desc: "Industrial and mobile hydraulic power units, manifold blocks, and high-pressure systems up to 6,000 PSI." },
  { id: "04", label: "Robotics & EOAT", desc: "Collaborative robot integration, end-of-arm tooling, and complete workcell design for automation lines." },
  { id: "05", label: "Sensing & Safety", desc: "Machine guarding, safety relay systems, vision systems, and IIoT sensor networks for Industry 4.0." },
  { id: "06", label: "Motion Control", desc: "Servo and stepper drive systems, linear actuators, and precision positioning for assembly and manufacturing." },
];

const STATS = [
  { value: "2,400+", label: "Systems Deployed" },
  { value: "98.7%", label: "Uptime Guarantee" },
  { value: "34", label: "States Served" },
  { value: "4–72hr", label: "Emergency Response" },
];

const INDUSTRIES = [
  "Automotive & Tier 1", "Food & Beverage", "Pharmaceutical",
  "Aerospace & Defense", "Packaging & Converting", "Steel & Metals",
  "Heavy Equipment", "Semiconductor", "Oil & Gas",
];

const PARTNERS = ["Parker Hannifin", "SMC Corporation", "Festo", "Bosch Rexroth", "Norgren", "Aventics"];

const PROCESS = [
  { step: "01", title: "Requirements Analysis", desc: "Our engineers review your spec sheet, environment, and cycle requirements." },
  { step: "02", title: "System Design", desc: "CAD models, P&ID diagrams, and BOM delivered for approval before build." },
  { step: "03", title: "Assembly & Testing", desc: "In-house build and full-cycle testing under operating conditions." },
  { step: "04", title: "Commissioning", desc: "On-site installation, startup support, and operator training." },
];

export default function YoungbloodMockupAlt2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastY, setLastY] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setHeaderVisible(y < lastY || y < 60);
      setLastY(y);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastY]);

  return (
    <>
      <Helmet>
        <title>Youngblood Automation Solutions | Precision Industrial Systems</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .fade-in { animation: fadeIn 0.7s ease both; }
        .solution-card:hover { border-color: ${BLUE} !important; }
        .solution-card:hover .sol-id { color: ${BLUE} !important; }
        .process-step:hover .step-num { background: ${BLUE} !important; color: ${WHITE} !important; }
        .partner-chip:hover { border-color: ${BLUE} !important; color: ${BLUE} !important; }
      `}</style>

      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background: BLUE, color: WHITE }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* Header */}
      <header style={{
        position: "fixed", top: 32, left: 0, right: 0, zIndex: 100,
        background: NAVY, borderBottom: `1px solid ${BORDER}`,
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s ease",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Cpu size={18} color={WHITE} />
            </div>
            <div>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>Youngblood</div>
              <div style={{ color: STEEL, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Automation Solutions</div>
            </div>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden lg:flex">
            {["Solutions", "Industries", "Process", "Partners", "Contact"].map(n => (
              <a key={n} href="#" style={{ color: STEEL, fontSize: 13, letterSpacing: "0.06em", textDecoration: "none", textTransform: "uppercase", fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
                onMouseLeave={e => (e.currentTarget.style.color = STEEL)}
              >{n}</a>
            ))}
            <a href="#rfq" style={{ background: BLUE, color: WHITE, padding: "9px 20px", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
              Request Quote
            </a>
          </nav>
          <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: WHITE, cursor: "pointer" }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div style={{ background: NAVY, borderTop: `1px solid ${BORDER}`, padding: "16px 24px 24px" }}>
            {["Solutions", "Industries", "Process", "Contact"].map(n => (
              <div key={n} style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                <a href="#" style={{ color: STEEL, fontSize: 14, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>{n}</a>
              </div>
            ))}
            <a href="#rfq" style={{ display: "block", marginTop: 16, background: BLUE, color: WHITE, padding: "12px 20px", textAlign: "center", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
              Request Quote
            </a>
          </div>
        )}
      </header>

      {/* Hero */}
      <section style={{ background: NAVY, paddingTop: 64, minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Technical grid background */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: `linear-gradient(${BLUE} 1px, transparent 1px), linear-gradient(90deg, ${BLUE} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
        {/* Right accent line */}
        <div style={{ position: "absolute", top: 0, right: "33%", bottom: 0, width: 1, background: `linear-gradient(to bottom, transparent, ${BLUE}44, transparent)` }} />

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", gap: 64, alignItems: "center", width: "100%", position: "relative" }}>
          <div className="fade-in">
            {/* Status indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
              <div style={{ width: 8, height: 8, background: "#00D68F", borderRadius: "50%", boxShadow: "0 0 12px #00D68F" }} />
              <span style={{ color: STEEL, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>Systems Online · EST. 1998</span>
            </div>

            <h1 style={{ color: WHITE, fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 300, lineHeight: 1.1, marginBottom: 24 }}>
              Industrial Automation<br />
              <span style={{ fontWeight: 700 }}>Engineered to</span><br />
              <span style={{ color: BLUE, fontWeight: 700 }}>Exact Spec.</span>
            </h1>

            <p style={{ color: STEEL, fontSize: 16, lineHeight: 1.7, maxWidth: 460, marginBottom: 40 }}>
              Custom pneumatic, hydraulic, and robotic systems for manufacturers who can't afford downtime.
              From single-component sourcing to full turnkey workcell integration.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <a href="#rfq" style={{ background: BLUE, color: WHITE, padding: "14px 28px", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                Request Quote <ArrowRight size={15} />
              </a>
              <a href="#solutions" style={{ border: `1px solid ${BORDER}`, color: STEEL, padding: "14px 28px", fontSize: 13, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = WHITE; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = STEEL; }}
              >
                View Solutions
              </a>
            </div>
          </div>

          {/* Stats panel */}
          <div className="grid grid-cols-2" style={{ gap: 1, background: BORDER }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: "#0D1E36", padding: "32px 28px" }}>
                <div style={{ color: BLUE, fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>{s.value}</div>
                <div style={{ color: STEEL, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section id="solutions" style={{ background: "#060E1A", padding: "100px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ marginBottom: 64 }}>
              <div style={{ color: BLUE, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>// Solution Portfolio</div>
              <h2 style={{ color: WHITE, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.1 }}>
                Complete Systems.<br />
                <span style={{ color: STEEL, fontWeight: 300 }}>Single-Source Expertise.</span>
              </h2>
            </div>
          </RevealSection>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1, background: BORDER }}>
            {SOLUTIONS.map(s => (
              <RevealSection key={s.id}>
                <div className="solution-card" style={{ background: "#0A1628", padding: "36px 32px", cursor: "pointer", transition: "border-color 0.2s", border: "1px solid transparent" }}>
                  <div className="sol-id" style={{ color: STEEL, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 600, transition: "color 0.2s" }}>{s.id} ——</div>
                  <div style={{ color: WHITE, fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{s.label}</div>
                  <div style={{ color: STEEL, fontSize: 14, lineHeight: 1.65 }}>{s.desc}</div>
                  <div style={{ marginTop: 24, color: BLUE, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    Technical Specs <ChevronRight size={13} />
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section style={{ background: NAVY, padding: "80px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 64, alignItems: "start" }}>
              <div>
                <div style={{ color: BLUE, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>// Markets Served</div>
                <h2 style={{ color: WHITE, fontSize: 36, fontWeight: 700, lineHeight: 1.15 }}>Industry<br />Verticals</h2>
                <p style={{ color: STEEL, fontSize: 14, lineHeight: 1.65, marginTop: 16 }}>
                  Cross-industry experience means proven solutions faster. We've seen the failure modes. We've built the fixes.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-2" style={{ gap: 1, background: BORDER }}>
                {INDUSTRIES.map(ind => (
                  <div key={ind} style={{ background: NAVY, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 4, height: 4, background: BLUE, flexShrink: 0 }} />
                    <span style={{ color: STEEL, fontSize: 13, fontWeight: 500 }}>{ind}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Process */}
      <section id="process" style={{ background: "#060E1A", padding: "100px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ marginBottom: 64, textAlign: "center" }}>
              <div style={{ color: BLUE, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>// Engagement Process</div>
              <h2 style={{ color: WHITE, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700 }}>How We Build</h2>
            </div>
          </RevealSection>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 0, background: BORDER }}>
            {PROCESS.map((p, i) => (
              <RevealSection key={p.step}>
                <div className="process-step" style={{ background: "#0A1628", padding: "40px 32px", position: "relative" }}>
                  <div className="step-num" style={{
                    width: 48, height: 48, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center",
                    color: STEEL, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 24, transition: "all 0.2s",
                  }}>{p.step}</div>
                  <div style={{ color: WHITE, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{p.title}</div>
                  <div style={{ color: STEEL, fontSize: 13, lineHeight: 1.65 }}>{p.desc}</div>
                  {i < PROCESS.length - 1 && (
                    <div style={{ position: "absolute", top: "50%", right: -1, width: 1, height: "50%", background: `linear-gradient(to bottom, ${BLUE}66, transparent)` }} />
                  )}
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section style={{ background: NAVY, padding: "64px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ color: STEEL, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>// Authorized Distributor &amp; Systems Integrator</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              {PARTNERS.map(p => (
                <div key={p} className="partner-chip" style={{
                  border: `1px solid ${BORDER}`, color: STEEL, padding: "12px 24px",
                  fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", transition: "all 0.2s",
                  cursor: "default",
                }}>{p}</div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* RFQ Form */}
      <section id="rfq" style={{ background: "#060E1A", padding: "100px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ marginBottom: 48 }}>
              <div style={{ color: BLUE, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>// Request for Quotation</div>
              <h2 style={{ color: WHITE, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700 }}>Submit Your Requirements</h2>
              <p style={{ color: STEEL, fontSize: 15, lineHeight: 1.65, marginTop: 12 }}>
                Our engineering team reviews every submission and responds within 4 business hours with preliminary sizing and pricing.
              </p>
            </div>

            <form onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 1, background: BORDER, marginBottom: 1 }}>
                {[
                  { label: "Company Name", placeholder: "Acme Manufacturing Co.", type: "text" },
                  { label: "Contact Name", placeholder: "John Smith", type: "text" },
                  { label: "Email Address", placeholder: "j.smith@acmemfg.com", type: "email" },
                  { label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
                ].map(field => (
                  <div key={field.label} style={{ background: "#0A1628", padding: "24px" }}>
                    <label style={{ display: "block", color: STEEL, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      style={{
                        width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`,
                        color: WHITE, fontSize: 15, padding: "8px 0", outline: "none",
                      }}
                      onFocus={e => (e.target.style.borderBottomColor = BLUE)}
                      onBlur={e => (e.target.style.borderBottomColor = BORDER)}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 1, background: BORDER, marginBottom: 1 }}>
                {[
                  {
                    label: "Product Category", type: "select",
                    options: ["Select Category", "Pneumatics / Manifolds", "Electro-Pneumatic Panels", "Hydraulics — Industrial", "Hydraulics — Mobile", "Robotics / Cobots", "End-of-Arm Tooling", "Sensing / Safety Systems", "Vision Systems", "Motion Control", "Custom Manifold Build", "Panel Building / Enclosures", "Not Sure — Need Consultation"],
                  },
                  {
                    label: "Estimated Quantity", type: "select",
                    options: ["Select Quantity", "1–5 units", "6–25 units", "26–100 units", "100+ units", "Ongoing / Stocking Order"],
                  },
                  {
                    label: "Timeline / Urgency", type: "select",
                    options: ["Select Timeline", "Immediate — Line Down", "< 2 Weeks", "2–4 Weeks", "1–3 Months", "Exploring / Budgeting"],
                  },
                ].map(field => (
                  <div key={field.label} style={{ background: "#0A1628", padding: "24px" }}>
                    <label style={{ display: "block", color: STEEL, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>{field.label}</label>
                    <select style={{
                      width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`,
                      color: STEEL, fontSize: 14, padding: "8px 0", outline: "none", cursor: "pointer",
                    }}
                      onFocus={e => (e.target.style.borderBottomColor = BLUE)}
                      onBlur={e => (e.target.style.borderBottomColor = BORDER)}
                    >
                      {field.options.map(o => <option key={o} style={{ background: "#0A1628" }}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ background: "#0A1628", padding: "24px", borderTop: `1px solid ${BORDER}` }}>
                <label style={{ display: "block", color: STEEL, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Application Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe the application: operating environment, cycle rates, pressure/flow requirements, integration points, or any known constraints."
                  style={{
                    width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`,
                    color: WHITE, fontSize: 14, padding: "8px 0", outline: "none", resize: "vertical",
                    lineHeight: 1.65,
                  }}
                  onFocus={e => (e.target.style.borderBottomColor = BLUE)}
                  onBlur={e => (e.target.style.borderBottomColor = BORDER)}
                />
              </div>

              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  style={{
                    background: BLUE, color: WHITE, border: "none",
                    padding: "16px 40px", fontSize: 12, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  Submit RFQ <ArrowRight size={14} />
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: STEEL, fontSize: 12 }}>
                  <Shield size={14} color={BLUE} />
                  <span>4-hour engineering response guaranteed</span>
                </div>
              </div>
            </form>
          </RevealSection>
        </div>
      </section>

      {/* Contact Footer */}
      <section style={{ background: NAVY, padding: "64px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ maxWidth: 1200, margin: "0 auto", gap: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Cpu size={15} color={WHITE} />
              </div>
              <span style={{ color: WHITE, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>Youngblood Automation</span>
            </div>
            <p style={{ color: STEEL, fontSize: 13, lineHeight: 1.65, maxWidth: 280 }}>
              Precision-engineered automation systems for North American manufacturers since 1998.
            </p>
          </div>
          <div>
            <div style={{ color: WHITE, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>Solutions</div>
            {["Pneumatics", "Hydraulics", "Robotics", "Motion Control", "Sensing"].map(l => (
              <div key={l} style={{ marginBottom: 10 }}><a href="#" style={{ color: STEEL, fontSize: 13, textDecoration: "none" }}>{l}</a></div>
            ))}
          </div>
          <div>
            <div style={{ color: WHITE, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>Company</div>
            {["About", "Process", "Partners", "Case Studies", "Careers"].map(l => (
              <div key={l} style={{ marginBottom: 10 }}><a href="#" style={{ color: STEEL, fontSize: 13, textDecoration: "none" }}>{l}</a></div>
            ))}
          </div>
          <div>
            <div style={{ color: WHITE, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>Contact</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a href="tel:8005550100" style={{ color: STEEL, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <Phone size={13} color={BLUE} /> (800) 555-0100
              </a>
              <a href="mailto:rfq@youngbloodauto.com" style={{ color: STEEL, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={13} color={BLUE} /> rfq@youngbloodauto.com
              </a>
              <div style={{ color: STEEL, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={13} color={BLUE} /> Detroit Metro, MI
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: "40px auto 0", paddingTop: 24, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: STEEL, fontSize: 12 }}>© 2026 Youngblood Automation Solutions. All rights reserved.</span>
          <a href="/manufacturing-web-design" style={{ color: STEEL, fontSize: 11, textDecoration: "none", letterSpacing: "0.06em" }}>
            Site by M² Web Design
          </a>
        </div>
      </section>

      {/* Design Switcher */}
      <div className="hidden lg:block" style={{ position: "fixed", bottom: 20, left: 16, zIndex: 60 }}>
        <div style={{ background: "#0A0A0A", border: "1px solid #333", padding: "10px 14px", fontSize: 11 }}>
          <div style={{ color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Design Variant</div>
          {[
            { to: "/demo-youngblood", label: "Original (Dark Slate)" },
            { to: "/demo-youngblood-alt1", label: "Steel & Fire (Brutalist)" },
            { to: "/demo-youngblood-alt2", label: "Precision (Swiss Grid)", active: true },
          ].map(d => (
            <Link
              key={d.to}
              to={d.to}
              style={{
                display: "block", padding: "5px 0",
                color: d.active ? BLUE : "#888",
                textDecoration: "none",
                fontWeight: d.active ? 600 : 400,
                fontSize: 11,
              }}
            >
              {d.active ? "▶ " : "  "}{d.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
