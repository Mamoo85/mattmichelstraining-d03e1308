import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, MapPin, ArrowRight, Menu, X, CheckCircle, Star, Smile, Sparkles, Shield, Award, Clock, Heart } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

// Nordic/Minimal — Sage & Ivory
const SAGE = "#4A7B6F";
const DARK = "#2C3A32";
const IVORY = "#FAFAF7";
const SAGE_LIGHT = "#EEF4F2";
const SAGE_MID = "#6B9E91";
const WHITE = "#ffffff";
const GRAY = "#6b7280";

const SERVICES = [
  { icon: Smile, title: "Family Dentistry", desc: "Comprehensive care for every age — from first check-ups to lifetime maintenance." },
  { icon: Sparkles, title: "Cosmetic Treatments", desc: "Veneers, whitening, bonding, and complete smile makeovers crafted with artistry." },
  { icon: Shield, title: "CEREC Same-Day Crowns", desc: "Precision-milled porcelain crowns designed and fitted in a single appointment." },
  { icon: Heart, title: "Dental Implants", desc: "Permanent tooth replacement that looks, feels, and functions like your natural teeth." },
  { icon: Award, title: "Invisalign", desc: "Discreet clear aligner therapy for a straighter smile — no brackets, no wires." },
  { icon: Clock, title: "Emergency Care", desc: "Same-day appointments for dental pain, broken teeth, or urgent restorations." },
];

const REVIEWS = [
  { name: "Karen M.", stars: 5, text: "The most calm, unhurried dental experience I've had. The office is beautiful and Dr. Stewart is exceptional." },
  { name: "David T.", stars: 5, text: "CEREC crown in one visit — I was amazed. No temporaries, no second appointment. Technology is incredible." },
  { name: "Lisa P.", stars: 5, text: "My Invisalign results are stunning. Dr. Chen took such care with every detail of my treatment plan." },
  { name: "Robert H.", stars: 5, text: "Emergency appointment on a Friday afternoon, seen within the hour. This practice truly goes above and beyond." },
];

const STATS = [
  { value: "35+", label: "Years in Practice" },
  { value: "4,800+", label: "Patient Families" },
  { value: "4.9", label: "Google Rating" },
  { value: "1-Day", label: "CEREC Crowns" },
];

export default function DentalMockupAlt2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderVisible(y < 80 || y < lastY);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  return (
    <>
      <Helmet>
        <title>Stewart Dental Group | Grosse Pointe Woods, MI</title>
        <meta name="robots" content="noindex" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <style>{`
        body { font-family: 'Inter', sans-serif; }
        .serif { font-family: 'DM Serif Display', serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .service-card:hover { background: ${SAGE_LIGHT} !important; }
        .service-card { transition: background 0.2s ease; }
        .nav-link:hover { color: ${SAGE} !important; }
      `}</style>

      {/* Full-Width Demo Banner */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: SAGE, color: WHITE,
        padding: "9px 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 12, flexWrap: "wrap",
        fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
        textAlign: "center",
      }}>
        <span>REDESIGN CONCEPT</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <Link to="/manufacturing-web-design" style={{ color: WHITE, textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.5)" }}>
          Matt Michels Web Design
        </Link>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="tel:3138064952" style={{ color: WHITE, textDecoration: "none", fontWeight: 700 }}>313.806.4952</a>
      </div>

      {/* Header */}
      <header style={{
        position: "fixed", top: 36, left: 0, right: 0, zIndex: 90,
        background: "rgba(250,250,247,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(74,123,111,0.12)",
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s ease",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div>
            <div className="serif" style={{ color: DARK, fontSize: 18, lineHeight: 1.1 }}>Stewart Dental Group</div>
            <div style={{ color: SAGE, fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>Grosse Pointe Woods, MI</div>
          </div>

          <nav className="hidden lg:flex" style={{ alignItems: "center", gap: 36 }}>
            {["Services", "About", "Technology", "Reviews", "New Patients"].map(n => (
              <a key={n} className="nav-link" href="#" style={{ color: GRAY, fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}>{n}</a>
            ))}
          </nav>

          <div className="hidden lg:flex" style={{ alignItems: "center", gap: 16 }}>
            <a href="tel:3138828711" style={{ color: DARK, fontWeight: 600, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Phone size={15} color={SAGE} /> (313) 882-8711
            </a>
            <a href="#appointment" style={{
              background: SAGE, color: WHITE, padding: "10px 22px", borderRadius: 4,
              fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
            }}>Book Appointment</a>
          </div>

          <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: DARK, padding: 4 }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{
            position: "fixed", top: 100, left: 0, right: 0, bottom: 0,
            background: DARK, zIndex: 80,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 30,
          }}>
            {["Services", "About", "Technology", "Reviews", "New Patients"].map(n => (
              <a key={n} href="#" onClick={() => setMenuOpen(false)}
                className="serif"
                style={{ color: IVORY, fontSize: 28, textDecoration: "none" }}
              >{n}</a>
            ))}
            <a href="tel:3138828711" style={{ color: SAGE_MID, fontSize: 20, textDecoration: "none", fontWeight: 500, marginTop: 8 }}>
              (313) 882-8711
            </a>
            <a href="#appointment" onClick={() => setMenuOpen(false)}
              style={{ background: SAGE, color: WHITE, padding: "14px 36px", fontSize: 15, fontWeight: 600, textDecoration: "none", borderRadius: 4, marginTop: 8 }}>
              Book Appointment
            </a>
          </div>
        )}
      </header>

      {/* Hero — Split Layout */}
      <section style={{ minHeight: "100vh", paddingTop: 100, background: IVORY, display: "flex", alignItems: "stretch" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", width: "100%", display: "flex", alignItems: "stretch" }}>
          {/* Left — Text */}
          <div className="fade-up" style={{
            flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "80px 48px 80px 0",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginBottom: 28,
            }}>
              <div style={{ width: 24, height: 1, background: SAGE }} />
              <span style={{ color: SAGE, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>Now Accepting New Patients</span>
            </div>

            <h1 className="serif" style={{
              color: DARK, fontSize: "clamp(38px,5vw,68px)", lineHeight: 1.1, marginBottom: 24,
            }}>
              Dentistry that<br />
              <em style={{ color: SAGE }}>feels different.</em>
            </h1>

            <p style={{ color: GRAY, fontSize: 16, lineHeight: 1.8, marginBottom: 36, maxWidth: 440 }}>
              35 years of unhurried, precise dental care for Grosse Pointe families. Modern technology, natural results, and a practice that always puts comfort first.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 40 }}>
              <a href="tel:3138828711" style={{
                background: SAGE, color: WHITE, padding: "14px 28px", borderRadius: 4,
                fontSize: 15, fontWeight: 600, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Phone size={18} /> (313) 882-8711
              </a>
              <a href="#services" style={{
                border: `1.5px solid ${SAGE}`, color: SAGE, padding: "14px 28px", borderRadius: 4,
                fontSize: 15, fontWeight: 600, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                Our Services <ArrowRight size={17} />
              </a>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {["ADA Member", "CEREC Certified", "Invisalign Provider"].map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 6, color: GRAY, fontSize: 12 }}>
                  <CheckCircle size={14} color={SAGE} /> {b}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Image (desktop only) */}
          <div className="hidden lg:block" style={{ flex: "0 0 50%", position: "relative", overflow: "hidden" }}>
            <img
              src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80"
              alt="Dr. Stewart"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(250,250,247,0.15) 0%, transparent 30%)" }} />
            {/* Stat card overlay */}
            <div style={{
              position: "absolute", bottom: 40, left: -24,
              background: IVORY, borderRadius: 8, padding: "20px 24px",
              boxShadow: "0 8px 40px rgba(44,58,50,0.15)",
              minWidth: 200,
            }}>
              <div className="serif" style={{ color: DARK, fontSize: 28, lineHeight: 1 }}>4.9 ★</div>
              <div style={{ color: GRAY, fontSize: 12, marginTop: 4 }}>340+ Google reviews</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section style={{ background: SAGE, padding: "0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} style={{
                padding: "28px 24px", textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}>
                <div className="serif" style={{ color: WHITE, fontSize: "clamp(26px,3.5vw,38px)", marginBottom: 4 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" style={{ background: IVORY, padding: "100px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ marginBottom: 60 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 1, background: SAGE }} />
                <span style={{ color: SAGE, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>What We Offer</span>
              </div>
              <h2 className="serif" style={{ color: DARK, fontSize: "clamp(30px,4vw,52px)", lineHeight: 1.1, maxWidth: 540 }}>
                Complete dental care, all in one place.
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 1, background: "rgba(74,123,111,0.1)" }}>
            {SERVICES.map(s => (
              <RevealSection key={s.title}>
                <div className="service-card" style={{
                  background: IVORY, padding: "40px 36px", cursor: "pointer",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, background: SAGE_LIGHT,
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
                  }}>
                    <s.icon size={22} color={SAGE} />
                  </div>
                  <h3 className="serif" style={{ color: DARK, fontSize: 22, marginBottom: 12 }}>{s.title}</h3>
                  <p style={{ color: GRAY, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, color: SAGE, fontSize: 13, fontWeight: 600 }}>
                    Learn more <ArrowRight size={14} />
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section style={{ background: SAGE_LIGHT, padding: "100px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 80, alignItems: "center" }}>
            <RevealSection>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 1, background: SAGE }} />
                  <span style={{ color: SAGE, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>Advanced Technology</span>
                </div>
                <h2 className="serif" style={{ color: DARK, fontSize: "clamp(28px,4vw,48px)", lineHeight: 1.15, marginBottom: 20 }}>
                  Same-day crowns.<br />No waiting.
                </h2>
                <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.8, marginBottom: 28 }}>
                  Our CEREC system mills a precision porcelain crown in under two hours. Digital impressions, no temporary crowns, no return visit. Just a beautiful result in one appointment.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {["CEREC Same-Day Milling", "Digital Impression Scanning", "3D Cone Beam CT Imaging", "Digital X-rays (80% less radiation)", "Intraoral Camera Education"].map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: DARK, fontSize: 14 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: SAGE, flexShrink: 0 }} /> {t}
                    </div>
                  ))}
                </div>
              </div>
            </RevealSection>
            <RevealSection>
              <div style={{ borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <img
                  src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80"
                  alt="Dental office technology"
                  style={{ width: "100%", height: 480, objectFit: "cover" }}
                />
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" style={{ background: IVORY, padding: "100px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ marginBottom: 56 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 1, background: SAGE }} />
                <span style={{ color: SAGE, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>Patient Stories</span>
              </div>
              <h2 className="serif" style={{ color: DARK, fontSize: "clamp(28px,4vw,48px)" }}>What patients say.</h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
            {REVIEWS.map(r => (
              <RevealSection key={r.name}>
                <div style={{ padding: "28px", background: SAGE_LIGHT, borderRadius: 4 }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
                    {[...Array(r.stars)].map((_, i) => <Star key={i} size={13} color="#b7864a" fill="#b7864a" />)}
                  </div>
                  <p style={{ color: DARK, fontSize: 14, lineHeight: 1.7, marginBottom: 16, fontStyle: "italic" }}>"{r.text}"</p>
                  <div style={{ color: SAGE, fontSize: 12, fontWeight: 700 }}>— {r.name}</div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="appointment" style={{ background: DARK, padding: "96px 32px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <RevealSection>
            <h2 className="serif" style={{ color: IVORY, fontSize: "clamp(30px,4vw,54px)", lineHeight: 1.15, marginBottom: 20 }}>
              Ready to love your smile?
            </h2>
            <p style={{ color: "rgba(250,250,247,0.65)", fontSize: 16, lineHeight: 1.75, marginBottom: 36 }}>
              New patients welcome. Most insurance accepted. Same-day emergency appointments available.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
              <a href="tel:3138828711" style={{
                background: SAGE, color: WHITE, padding: "15px 32px", borderRadius: 4,
                fontSize: 15, fontWeight: 600, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Phone size={18} /> (313) 882-8711
              </a>
              <a href="#contact" style={{
                border: "1.5px solid rgba(250,250,247,0.3)", color: IVORY, padding: "15px 32px", borderRadius: 4,
                fontSize: 15, fontWeight: 500, textDecoration: "none",
              }}>
                Request Online
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "rgba(250,250,247,0.4)", fontSize: 13 }}>
              <MapPin size={14} /> 19635 Mack Avenue, Grosse Pointe Woods, MI 48236
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#1a2420", padding: "56px 32px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 40, marginBottom: 40 }}>
            <div>
              <div className="serif" style={{ color: IVORY, fontSize: 18, marginBottom: 12 }}>Stewart Dental Group</div>
              <p style={{ color: "rgba(250,250,247,0.4)", fontSize: 13, lineHeight: 1.7 }}>
                Serving Grosse Pointe families with compassionate dental care since 1989.
              </p>
            </div>
            <div>
              <div style={{ color: "rgba(250,250,247,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Services</div>
              {["Family Dentistry", "Cosmetic Dentistry", "CEREC Crowns", "Dental Implants", "Invisalign", "Emergency Care"].map(s => (
                <div key={s} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ color: "rgba(250,250,247,0.5)", fontSize: 13, textDecoration: "none" }}>{s}</a>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: "rgba(250,250,247,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Hours</div>
              {[
                { day: "Mon – Thu", hrs: "8am – 5pm" },
                { day: "Friday", hrs: "8am – 2pm" },
                { day: "Weekend", hrs: "By Appt." },
              ].map(h => (
                <div key={h.day} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(250,250,247,0.5)", fontSize: 13 }}>{h.day}</span>
                  <span style={{ color: "rgba(250,250,247,0.3)", fontSize: 13 }}>{h.hrs}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: "rgba(250,250,247,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Contact</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <a href="tel:3138828711" style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(250,250,247,0.5)", fontSize: 13, textDecoration: "none" }}>
                  <Phone size={14} color={SAGE} /> (313) 882-8711
                </a>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "rgba(250,250,247,0.5)", fontSize: 13 }}>
                  <MapPin size={14} color={SAGE} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>19635 Mack Avenue<br />Grosse Pointe Woods, MI 48236</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(250,250,247,0.07)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span style={{ color: "rgba(250,250,247,0.25)", fontSize: 12 }}>© 2026 Stewart Dental Group. All rights reserved.</span>
            <a href="/manufacturing-web-design" style={{ color: "rgba(250,250,247,0.25)", fontSize: 11, textDecoration: "none" }}>Site by M2 Web Design</a>
          </div>
        </div>
      </footer>

      {/* Design Switcher */}
      <div className="hidden lg:block" style={{ position: "fixed", bottom: 20, left: 16, zIndex: 60 }}>
        <div style={{ background: "rgba(26,36,32,0.97)", border: "1px solid rgba(74,123,111,0.3)", borderRadius: 8, padding: "12px 16px", minWidth: 220, fontSize: 11 }}>
          <div style={{ color: SAGE_MID, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Design Variant</div>
          {[
            { to: "/demo-dental", label: "Teal / Clinical" },
            { to: "/demo-dental-alt1", label: "Warm / Friendly" },
            { to: "/demo-dental-alt2", label: "Nordic / Minimal", active: true },
          ].map(d => (
            <Link
              key={d.to}
              to={d.to}
              style={{
                display: "block", padding: "5px 0",
                color: d.active ? SAGE_MID : "rgba(250,250,247,0.4)",
                textDecoration: "none", fontWeight: d.active ? 700 : 400,
                fontSize: 11,
              }}
            >
              {d.active ? "● " : "  "}{d.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
