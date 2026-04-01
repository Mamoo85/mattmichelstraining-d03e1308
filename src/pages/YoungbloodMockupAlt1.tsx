import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import { Phone, Mail, MapPin, ChevronDown } from "lucide-react";

const keyframes = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

const ACCENT = "#C8290A";
const BLACK = "#0D0D0D";
const WHITE = "#FFFFFF";

const gridOverlay = {
  backgroundImage: `repeating-linear-gradient(0deg, rgba(13,13,13,0.05) 0px, rgba(13,13,13,0.05) 1px, transparent 1px, transparent 60px),
    repeating-linear-gradient(90deg, rgba(13,13,13,0.05) 0px, rgba(13,13,13,0.05) 1px, transparent 1px, transparent 60px)`,
};

export default function YoungbloodMockupAlt1() {
  const [scrolled, setScrolled] = useState(false);
  const [lastY, setLastY] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [formData, setFormData] = useState({
    name: "", company: "", phone: "", email: "",
    category: "", quantity: "", urgency: "", description: "",
  });

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 50);
      setHeaderVisible(y < lastY || y < 80);
      setLastY(y);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastY]);

  return (
    <>
      <style>{keyframes}</style>
      <Helmet>
        <title>Youngblood Automation — Steel & Fire | Redesign Concept</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* DEMO BADGE */}
      <div style={{
        position: "fixed", top: 16, right: 0, zIndex: 9999,
        background: ACCENT, color: WHITE, padding: "10px 18px",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        borderRadius: 0, lineHeight: 1.5, textAlign: "right",
        boxShadow: "-4px 4px 0 rgba(0,0,0,0.3)",
      }}>
        REDESIGN CONCEPT · Matt Michels Web Design<br />313.806.4952
      </div>

      {/* DESIGN SWITCHER */}
      <div style={{
        position: "fixed", bottom: 24, left: 0, zIndex: 9999,
        background: "rgba(13,13,13,0.93)", border: `1px solid ${WHITE}`,
        borderRadius: 0, padding: "16px 20px", minWidth: 220,
      }}>
        <div style={{ color: WHITE, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10, opacity: 0.5 }}>
          DESIGN CONCEPTS
        </div>
        {[
          { path: "/demo-youngblood", label: "Dark / Blue" },
          { path: "/demo-youngblood-alt1", label: "Steel & Fire", active: true },
          { path: "/demo-youngblood-alt2", label: "Precision Grid" },
        ].map(({ path, label, active }) => (
          <Link key={path} to={path} style={{
            display: "block", color: active ? ACCENT : "rgba(255,255,255,0.6)",
            fontSize: 12, fontWeight: active ? 700 : 400, letterSpacing: "0.06em",
            textDecoration: "none", padding: "4px 0",
          }}>
            {active ? `▶ ${label} — CURRENT` : label}
          </Link>
        ))}
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 10, letterSpacing: "0.06em" }}>
          Matt (313) 806-4952
        </div>
      </div>

      {/* HEADER */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: WHITE, borderBottom: `3px solid ${BLACK}`,
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s ease",
        padding: "0 40px",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color: BLACK }}>
            YOUNGBLOOD <span style={{ color: ACCENT }}>|</span> AUTOMATION
          </div>
          <nav style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {["SOLUTIONS", "INDUSTRIES", "PARTNERS", "LOCATIONS", "ABOUT"].map(item => (
              <a key={item} href="#" style={{
                color: BLACK, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.12em", textDecoration: "none",
              }}>{item}</a>
            ))}
            <a href="tel:5862641240" style={{
              color: BLACK, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.06em", textDecoration: "none",
            }}>(586) 264-1240</a>
            <a href="#rfq" style={{
              background: ACCENT, color: WHITE,
              padding: "10px 22px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", textDecoration: "none", borderRadius: 0,
            }}>REQUEST QUOTE</a>
          </nav>
        </div>
      </header>

      <main style={{ fontFamily: "'Arial', sans-serif" }}>

        {/* HERO */}
        <section style={{
          position: "relative", minHeight: "100vh",
          display: "flex", alignItems: "center",
          overflow: "hidden", background: WHITE,
          paddingTop: 68,
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "url(https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80)",
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: 0.15,
          }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)" }} />
          <div style={{ position: "absolute", inset: 0, ...gridOverlay }} />
          <div style={{
            position: "relative", zIndex: 2,
            maxWidth: 1400, margin: "0 auto", padding: "80px 40px",
          }}>
            <div style={{
              display: "inline-block", background: BLACK,
              color: WHITE, padding: "4px 12px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
              marginBottom: 32, borderRadius: 0,
            }}>EST. 1964 — WARREN, MI</div>
            <div style={{ animation: "fadeInUp .8s ease both" }}>
              <div style={{ fontSize: "clamp(72px,10vw,120px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.04em", color: BLACK }}>POWER.</div>
              <div style={{ fontSize: "clamp(72px,10vw,120px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.04em", color: BLACK }}>PRECISION.</div>
              <div style={{ fontSize: "clamp(72px,10vw,120px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.04em", color: ACCENT }}>NO EXCUSES.</div>
            </div>
            <p style={{ fontSize: 18, color: "#555", marginTop: 32, maxWidth: 520, lineHeight: 1.6 }}>
              Michigan's premier automation distributor. Motion control, fluid power, and robotic integration — engineered for the factory floor.
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap" }}>
              <a href="#solutions" style={{
                background: ACCENT, color: WHITE,
                padding: "18px 40px", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.12em", textDecoration: "none", borderRadius: 0,
              }}>EXPLORE SOLUTIONS</a>
              <a href="#rfq" style={{
                background: "transparent", color: BLACK, border: `2px solid ${BLACK}`,
                padding: "18px 40px", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.12em", textDecoration: "none", borderRadius: 0,
              }}>TALK TO ENGINEERING</a>
            </div>
          </div>
        </section>

        {/* SOLUTIONS */}
        <section id="solutions" style={{
          background: BLACK,
          clipPath: "polygon(0 0, 100% 0, 100% 90%, 0 100%)",
          paddingBottom: "12%",
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 40px 40px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.2em", marginBottom: 48 }}>
              CORE CAPABILITIES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              {[
                { n: "01", title: "MOTION CONTROL", desc: "Servo drives, linear actuators, PLCs, and precision positioning systems." },
                { n: "02", title: "FLUID POWER", desc: "Hydraulic and pneumatic systems engineered for high-cycle industrial use." },
                { n: "03", title: "ROBOTIC INTEGRATION", desc: "Collaborative and industrial robot cells from UR, FANUC, and KUKA." },
                { n: "04", title: "CUSTOM PANELS", desc: "In-house UL 508A panel builds with full documentation and testing." },
              ].map(({ n, title, desc }, i) => (
                <RevealSection key={n}>
                  <div style={{
                    padding: "40px 32px",
                    borderRight: i < 3 ? `1px solid rgba(255,255,255,0.15)` : "none",
                  }}>
                    <div style={{ fontSize: 48, fontWeight: 900, color: ACCENT, letterSpacing: "-0.04em", lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: WHITE, letterSpacing: "-0.02em", margin: "16px 0 12px" }}>{title}</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <section style={{ background: BLACK, paddingTop: "5%" }}>
          <div style={{
            maxWidth: 1400, margin: "0 auto", padding: "0 40px 80px",
            display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            borderTop: `1px solid rgba(255,255,255,0.1)`,
          }}>
            {[
              { val: "1964", label: "YEAR FOUNDED" },
              { val: "4 OFFICES", label: "MICHIGAN LOCATIONS" },
              { val: "99.2%", label: "UPTIME GUARANTEE" },
              { val: "60+", label: "MANUFACTURER LINES" },
            ].map(({ val, label }) => (
              <RevealSection key={label}>
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 56, fontWeight: 900, color: ACCENT, letterSpacing: "-0.04em", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", marginTop: 8 }}>{label}</div>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* PARTNERS */}
        <section style={{ background: WHITE, padding: "100px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ fontSize: "clamp(48px,6vw,80px)", fontWeight: 900, letterSpacing: "-0.04em", color: BLACK, marginBottom: 60 }}>
              TIER 1 PARTNERS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
              {[
                { name: "SICK", sub: "Industrial Sensors & Safety Systems" },
                { name: "EATON", sub: "Hydraulics & Electrical Distribution" },
                { name: "EMERSON", sub: "Automation & Process Control" },
                { name: "UNIVERSAL ROBOTS", sub: "Collaborative Robotic Systems" },
              ].map(({ name, sub }, i) => (
                <RevealSection key={name}>
                  <div style={{
                    padding: "40px 48px",
                    borderBottom: `1px solid rgba(0,0,0,0.1)`,
                    borderRight: i % 2 === 0 ? `1px solid rgba(0,0,0,0.1)` : "none",
                  }}>
                    <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: BLACK }}>{name}</div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 6, letterSpacing: "0.04em" }}>{sub}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${BLACK}`, marginTop: 60, paddingTop: 24 }}>
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                {["BOSCH REXROTH", "PARKER HANNIFIN", "ALLEN-BRADLEY", "SIEMENS", "FESTO", "SMC", "IGUS", "LENZE"].map(name => (
                  <span key={name} style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.2)", letterSpacing: "0.08em" }}>{name}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BUILT IN-HOUSE */}
        <section style={{ background: "#F5F5F5", padding: "100px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.2em", marginBottom: 48 }}>
              MANUFACTURED IN MICHIGAN
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
              {[
                { img: "/images/engineered-cell.jpg", fallback: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&q=80&w=600", title: "ENGINEERED CELLS", desc: "Complete turnkey automation cells designed and assembled in our Warren facility." },
                { img: "/images/hydraulics-actual.jpg", fallback: "https://images.unsplash.com/photo-1581094271901-8022df4466f9?auto=format&fit=crop&q=80&w=600", title: "HYDRAULIC SYSTEMS", desc: "Custom manifolds, power units, and hydraulic circuit assemblies built to spec." },
                { img: "/images/robotic-arm-actual.jpg", fallback: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=600", title: "ROBOTIC INTEGRATION", desc: "End-of-arm tooling, safety fencing, vision systems, and full cell commissioning." },
              ].map(({ img, fallback, title, desc }) => (
                <RevealSection key={title}>
                  <div>
                    <div style={{
                      height: 280, overflow: "hidden",
                      backgroundImage: `url(${fallback})`,
                      backgroundSize: "cover", backgroundPosition: "center",
                    }} />
                    <div style={{
                      padding: "32px", background: WHITE,
                      borderTop: `4px solid ${ACCENT}`,
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, marginBottom: 10 }}>{title}</div>
                      <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section style={{ background: BLACK, padding: "100px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ fontSize: "clamp(48px,6vw,80px)", fontWeight: 900, letterSpacing: "-0.04em", color: WHITE, marginBottom: 48 }}>
              INDUSTRIES SERVED
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[
                "AUTOMOTIVE OEM", "TIER 1 SUPPLIER", "AEROSPACE", "STAMPING", "WELDING",
                "MACHINING CENTERS", "FOOD & BEVERAGE", "PHARMACEUTICAL", "HEAVY EQUIPMENT",
                "DEFENSE", "ENERGY", "PLASTICS", "FOUNDRY", "MATERIAL HANDLING",
                "PACKAGING", "SEMICONDUCTOR", "MARINE", "AGRICULTURE",
              ].map(tag => (
                <span key={tag} style={{
                  border: `1px solid ${ACCENT}`, color: ACCENT,
                  padding: "8px 16px", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.1em", borderRadius: 0,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        </section>

        {/* LOCATIONS */}
        <section style={{ background: WHITE, padding: "100px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.2em", marginBottom: 48 }}>
              MICHIGAN OFFICES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
              {[
                { city: "WARREN", role: "HQ & Main Distribution" },
                { city: "GRAND RAPIDS", role: "West Michigan Hub" },
                { city: "LANSING", role: "Central Michigan" },
                { city: "DETROIT", role: "Metro Engineering Center" },
              ].map(({ city, role }, i) => (
                <RevealSection key={city}>
                  <div style={{
                    padding: "48px 32px",
                    borderRight: i < 3 ? `1px solid rgba(0,0,0,0.1)` : "none",
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: BLACK }}>{city}</div>
                    <div style={{ width: 40, height: 3, background: ACCENT, margin: "14px 0" }} />
                    <div style={{ fontSize: 13, color: "#777", letterSpacing: "0.04em" }}>{role}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* RFQ FORM */}
        <section id="rfq" style={{ background: BLACK, padding: "100px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.2em", marginBottom: 24 }}>
                GET STARTED
              </div>
              <div style={{ fontSize: "clamp(48px,6vw,72px)", fontWeight: 900, letterSpacing: "-0.04em", color: WHITE, lineHeight: 0.9, marginBottom: 48 }}>
                SUBMIT RFQ
              </div>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {[
                  { key: "name", label: "FULL NAME", type: "text" },
                  { key: "company", label: "COMPANY", type: "text" },
                  { key: "phone", label: "PHONE", type: "tel" },
                  { key: "email", label: "EMAIL", type: "email" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", marginBottom: 6 }}>{label}</label>
                    <input type={type} style={{
                      width: "100%", background: "transparent",
                      border: `1px solid rgba(255,255,255,0.25)`, borderRadius: 0,
                      padding: "14px 16px", color: WHITE, fontSize: 14,
                      outline: "none", boxSizing: "border-box",
                    }}
                    value={formData[key as keyof typeof formData]}
                    onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", marginBottom: 6 }}>PRODUCT CATEGORY</label>
                  <select style={{
                    width: "100%", background: BLACK, borderRadius: 0,
                    border: `1px solid rgba(255,255,255,0.25)`,
                    padding: "14px 16px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                  value={formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select Category</option>
                    {["Motion Control", "Hydraulics", "Pneumatics", "Robotics", "Sensors", "Safety Systems", "Linear Motion", "Servo Drives", "PLCs / HMIs", "Cable Management", "Lubrication", "Conveyor Systems", "Custom Panel Builds"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", marginBottom: 6 }}>QUANTITY RANGE</label>
                  <select style={{
                    width: "100%", background: BLACK, borderRadius: 0,
                    border: `1px solid rgba(255,255,255,0.25)`,
                    padding: "14px 16px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                  value={formData.quantity}
                  onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))}>
                    <option value="">Select Quantity</option>
                    {["1–5 Units", "6–25 Units", "26–100 Units", "100–500 Units", "500+ Units", "Contract / Annual"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", marginBottom: 6 }}>URGENCY / TIMELINE</label>
                  <select style={{
                    width: "100%", background: BLACK, borderRadius: 0,
                    border: `1px solid rgba(255,255,255,0.25)`,
                    padding: "14px 16px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                  value={formData.urgency}
                  onChange={e => setFormData(f => ({ ...f, urgency: e.target.value }))}>
                    <option value="">Select Timeline</option>
                    {["Emergency / Down Line", "Within 48 Hours", "This Week", "This Month", "Ongoing / Scheduled", "Planning Phase"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", marginBottom: 6 }}>APPLICATION DESCRIPTION</label>
                  <textarea rows={5} style={{
                    width: "100%", background: "transparent", borderRadius: 0,
                    border: `1px solid rgba(255,255,255,0.25)`,
                    padding: "14px 16px", color: WHITE, fontSize: 14,
                    outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your application, machine type, and any relevant specs..." />
                </div>
                <button type="submit" style={{
                  background: ACCENT, color: WHITE, border: "none", borderRadius: 0,
                  padding: "18px 40px", fontSize: 13, fontWeight: 700,
                  letterSpacing: "0.12em", cursor: "pointer", alignSelf: "flex-start",
                }}>SUBMIT RFQ</button>
              </form>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.2em", marginBottom: 40 }}>CONTACT DIRECTLY</div>
              {[
                { icon: <Phone size={16} />, label: "MAIN", val: "(586) 264-1240" },
                { icon: <Mail size={16} />, label: "EMAIL", val: "sales@youngbloodautomation.com" },
                { icon: <MapPin size={16} />, label: "HQ", val: "12345 Van Dyke Ave, Warren, MI 48089" },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 28 }}>
                  <div style={{ color: ACCENT, paddingTop: 2 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em" }}>{label}</div>
                    <div style={{ fontSize: 16, color: WHITE, fontWeight: 700, marginTop: 4 }}>{val}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 48, padding: "32px", border: `1px solid rgba(255,255,255,0.1)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "0.16em", marginBottom: 12 }}>EMERGENCY LINE</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: "-0.02em" }}>(586) 264-1241</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>24/7 for critical downtime situations</div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: BLACK, borderTop: `1px solid rgba(255,255,255,0.08)`, padding: "80px 40px 40px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: WHITE, marginBottom: 60 }}>
              YOUNGBLOOD <span style={{ color: ACCENT }}>|</span> AUTOMATION
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 60, marginBottom: 60 }}>
              <div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 300 }}>
                  Michigan's leading automation distributor since 1964. Serving automotive, aerospace, and industrial manufacturers across the Great Lakes region.
                </div>
              </div>
              {[
                { title: "SOLUTIONS", items: ["Motion Control", "Fluid Power", "Robotics", "Custom Panels", "Sensing"] },
                { title: "RESOURCES", items: ["3D CAD Library", "Product Catalog", "Application Notes", "Training Videos", "Careers"] },
                { title: "CONTACT", items: ["(586) 264-1240", "Warren, MI HQ", "Grand Rapids", "Lansing", "Detroit"] },
              ].map(({ title, items }) => (
                <div key={title}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: "0.16em", marginBottom: 20 }}>{title}</div>
                  {items.map(item => (
                    <div key={item} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>{item}</div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid rgba(255,255,255,0.08)`, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>© 2024 Youngblood Automation. All rights reserved.</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Redesign concept by{" "}
                <Link to="/manufacturing-web-design" style={{ color: ACCENT, textDecoration: "none" }}>Matt Michels Web Design</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
