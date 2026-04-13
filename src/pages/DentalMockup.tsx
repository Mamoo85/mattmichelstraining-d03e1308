import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Shield, Star, Award, CheckCircle, MapPin, ArrowRight, Menu, X, Smile, Sparkles, Clock, Heart } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const TEAL_LIGHT = "#ccfbf1";
const NAVY = "#0f2027";
const SLATE = "#1e293b";
const WHITE = "#ffffff";
const GRAY = "#64748b";
const GRAY_LIGHT = "#f1f5f9";

const SERVICES = [
  { icon: Smile, title: "General Dentistry", desc: "Comprehensive cleanings, exams, fillings, and preventative care for the whole family.", highlight: false },
  { icon: Sparkles, title: "Cosmetic Dentistry", desc: "Veneers, whitening, bonding, and smile makeovers tailored to your unique goals.", highlight: true },
  { icon: Shield, title: "CEREC Same-Day Crowns", desc: "Digital impressions and milled porcelain crowns ready in a single appointment.", highlight: false },
  { icon: Heart, title: "Implant Dentistry", desc: "Tooth replacement solutions from single implants to full-arch restorations.", highlight: false },
  { icon: Clock, title: "Emergency Dental", desc: "Same-day emergency appointments for pain, broken teeth, or lost restorations.", highlight: false },
  { icon: Award, title: "Invisalign", desc: "Clear aligner therapy for adults and teens — straighter smile without metal braces.", highlight: false },
];

const TEAM = [
  { name: "Dr. James Stewart, DDS", role: "Lead Dentist & Founder", since: "Est. 1989", img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80" },
  { name: "Dr. Sarah Chen, DMD", role: "Cosmetic Specialist", since: "Joined 2014", img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80" },
];

const REVIEWS = [
  { name: "Karen M.", stars: 5, text: "Stewart Dental has been my family's dentist for 15 years. The new office is stunning and Dr. Stewart is always gentle and thorough." },
  { name: "Michael T.", stars: 5, text: "Got my CEREC crown done in one visit! The digital impressions are so much better than the old goop. Highly recommend." },
  { name: "Lisa P.", stars: 5, text: "Invisalign results exceeded my expectations. Dr. Chen is amazing — so patient and detail-oriented." },
  { name: "Robert H.", stars: 5, text: "Had a dental emergency on a Friday afternoon and they got me in within the hour. Truly above and beyond." },
];

const STATS = [
  { value: "35+", label: "Years Serving Grosse Pointe" },
  { value: "4,800+", label: "Patient Families" },
  { value: "4.9★", label: "Google Rating" },
  { value: "1-Day", label: "CEREC Crowns" },
];

const INSURANCES = ["Delta Dental", "Aetna", "Cigna", "BlueCross BlueShield", "MetLife", "Guardian", "Humana", "United Concordia"];

export default function DentalMockup() {
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
        <meta name="description" content="Stewart Dental Group — Family & Cosmetic Dentistry in Grosse Pointe Woods, MI. Accepting new patients. Call (313) 882-8711." />
      </Helmet>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .service-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(13,148,136,0.15); }
        .service-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .review-card:hover { border-color: ${TEAL} !important; }
        .review-card { transition: border-color 0.2s ease; }
        .btn-primary:hover { background: ${TEAL_DARK} !important; }
        .btn-primary { transition: background 0.2s ease; }
      `}</style>

      {/* ── Full-Width Demo Banner ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: TEAL, color: WHITE,
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

      {/* ── Header ── */}
      <header style={{
        position: "fixed", top: 36, left: 0, right: 0, zIndex: 90,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s ease",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Smile size={20} color={WHITE} />
            </div>
            <div>
              <div style={{ color: SLATE, fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>Stewart Dental Group</div>
              <div style={{ color: TEAL, fontSize: 10, fontWeight: 500, letterSpacing: "0.06em" }}>GROSSE POINTE WOODS, MI</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex" style={{ alignItems: "center", gap: 32 }}>
            {["Services", "About", "Technology", "Reviews", "New Patients"].map(n => (
              <a key={n} href="#" style={{ color: GRAY, fontSize: 13, fontWeight: 500, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = TEAL)}
                onMouseLeave={e => (e.currentTarget.style.color = GRAY)}
              >{n}</a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden lg:flex" style={{ alignItems: "center", gap: 12 }}>
            <a href="tel:3138828711" style={{ display: "flex", alignItems: "center", gap: 6, color: TEAL, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              <Phone size={16} /> (313) 882-8711
            </a>
            <a href="#appointment" className="btn-primary" style={{ background: TEAL, color: WHITE, padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Book Appointment
            </a>
          </div>

          {/* Hamburger */}
          <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: SLATE, padding: 4 }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{
            position: "fixed", top: 100, left: 0, right: 0, bottom: 0, zIndex: 80,
            background: "rgba(15,32,39,0.97)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 28,
          }}>
            {["Services", "About", "Technology", "Reviews", "New Patients"].map(n => (
              <a key={n} href="#" onClick={() => setMenuOpen(false)}
                style={{ color: WHITE, fontSize: 22, fontWeight: 700, textDecoration: "none", letterSpacing: "0.02em" }}
                onMouseEnter={e => (e.currentTarget.style.color = TEAL_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.color = WHITE)}
              >{n}</a>
            ))}
            <a href="tel:3138828711" style={{ color: TEAL_LIGHT, fontSize: 20, fontWeight: 700, textDecoration: "none", marginTop: 8 }}>
              (313) 882-8711
            </a>
            <a href="#appointment" onClick={() => setMenuOpen(false)}
              style={{ background: TEAL, color: WHITE, padding: "14px 32px", borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: "none", marginTop: 8 }}>
              Book Appointment
            </a>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section style={{ minHeight: "100vh", paddingTop: 100, position: "relative", overflow: "hidden", display: "flex", alignItems: "center" }}>
        {/* Background */}
        <div style={{ position: "absolute", inset: 0 }}>
          <img
            src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1400&q=80"
            alt="Modern dental office"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${NAVY}F0 0%, ${TEAL_DARK}C0 100%)` }} />
        </div>

        <div style={{ position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto", padding: "80px 24px", width: "100%" }}>
          <div style={{ maxWidth: 680 }} className="fade-up">
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.4)",
              borderRadius: 100, padding: "6px 16px", marginBottom: 24,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399" }} />
              <span style={{ color: TEAL_LIGHT, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em" }}>NOW ACCEPTING NEW PATIENTS</span>
            </div>

            <h1 style={{ color: WHITE, fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 800, lineHeight: 1.08, marginBottom: 20 }}>
              Your Family's<br />
              <span style={{ color: "#5eead4" }}>Trusted Dental</span><br />
              Home in Grosse Pointe
            </h1>

            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(15px,2vw,18px)", lineHeight: 1.7, marginBottom: 36, maxWidth: 520 }}>
              35+ years of gentle, comprehensive dental care for Grosse Pointe families.
              Modern technology. Warm, unhurried appointments. Results that last.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 48 }}>
              <a href="tel:3138828711" style={{
                display: "flex", alignItems: "center", gap: 8,
                background: WHITE, color: TEAL_DARK,
                padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 700,
                textDecoration: "none",
              }}>
                <Phone size={18} /> Call (313) 882-8711
              </a>
              <a href="#services" style={{
                display: "flex", alignItems: "center", gap: 8,
                border: "2px solid rgba(255,255,255,0.4)", color: WHITE,
                padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600,
                textDecoration: "none",
              }}>
                Our Services <ArrowRight size={17} />
              </a>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {["ADA Member", "CEREC Certified", "Invisalign Provider", "Accepting Insurance"].map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 500 }}>
                  <CheckCircle size={14} color="#34d399" /> {b}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor image */}
        <div className="hidden lg:block" style={{ position: "absolute", right: 0, bottom: 0, top: 100, width: "35%", zIndex: 5, overflow: "hidden" }}>
          <img
            src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80"
            alt="Dr. Stewart"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(15,32,39,0.8) 0%, transparent 40%)" }} />
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: TEAL, padding: "0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} style={{
                padding: "32px 24px", textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}>
                <div style={{ color: WHITE, fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" style={{ background: GRAY_LIGHT, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ color: TEAL, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>What We Offer</div>
              <h2 style={{ color: SLATE, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, marginBottom: 14 }}>Comprehensive Dental Services</h2>
              <p style={{ color: GRAY, fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
                From routine cleanings to complete smile transformations — all under one roof in Grosse Pointe Woods.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 24 }}>
            {SERVICES.map(s => (
              <RevealSection key={s.title}>
                <div className="service-card" style={{
                  background: s.highlight ? TEAL : WHITE,
                  borderRadius: 12, padding: "32px 28px",
                  border: `1px solid ${s.highlight ? "transparent" : "rgba(0,0,0,0.06)"}`,
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: s.highlight ? "rgba(255,255,255,0.2)" : TEAL_LIGHT,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 18,
                  }}>
                    <s.icon size={24} color={s.highlight ? WHITE : TEAL} />
                  </div>
                  <h3 style={{ color: s.highlight ? WHITE : SLATE, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ color: s.highlight ? "rgba(255,255,255,0.85)" : GRAY, fontSize: 14, lineHeight: 1.65 }}>{s.desc}</p>
                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, color: s.highlight ? "rgba(255,255,255,0.9)" : TEAL, fontSize: 13, fontWeight: 600 }}>
                    Learn more <ArrowRight size={14} />
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technology Section ── */}
      <section id="technology" style={{ background: SLATE, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 64, alignItems: "center" }}>
            <RevealSection>
              <div>
                <div style={{ color: TEAL_LIGHT, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Advanced Technology</div>
                <h2 style={{ color: WHITE, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
                  Same-Day Crowns.<br />
                  <span style={{ color: "#5eead4" }}>Zero Compromise.</span>
                </h2>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
                  Our CEREC system mills precision porcelain restorations in under 2 hours — no temporary crowns, no second appointments.
                  Digital X-rays reduce radiation by 80%. 3D cone beam imaging for implant planning.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {["CEREC Same-Day Crown Milling", "Digital Impression Scanning (no goop!)", "3D Cone Beam CT for Implant Planning", "Digital X-rays (80% less radiation)", "Intraoral Camera for Patient Education"].map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                      <CheckCircle size={16} color="#34d399" style={{ flexShrink: 0 }} /> {t}
                    </div>
                  ))}
                </div>
              </div>
            </RevealSection>
            <RevealSection>
              <div style={{ borderRadius: 16, overflow: "hidden", position: "relative" }}>
                <img
                  src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=700&q=80"
                  alt="CEREC dental technology"
                  style={{ width: "100%", height: 420, objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", bottom: 20, left: 20, right: 20,
                  background: "rgba(13,148,136,0.95)", borderRadius: 10,
                  padding: "16px 20px", backdropFilter: "blur(8px)",
                }}>
                  <div style={{ color: WHITE, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>CEREC Same-Day Crown</div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Digital scan → Design → Mill → Bond. All in one visit.</div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section id="about" style={{ background: WHITE, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ color: TEAL, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Meet Your Doctors</div>
              <h2 style={{ color: SLATE, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800 }}>The Stewart Dental Team</h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 32, maxWidth: 860, margin: "0 auto" }}>
            {TEAM.map(t => (
              <RevealSection key={t.name}>
                <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ height: 300, overflow: "hidden" }}>
                    <img src={t.img} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                  </div>
                  <div style={{ padding: "24px 24px", background: GRAY_LIGHT }}>
                    <div style={{ color: SLATE, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ color: TEAL, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.role}</div>
                    <div style={{ color: GRAY, fontSize: 12 }}>{t.since}</div>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews" style={{ background: GRAY_LIGHT, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <RevealSection>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ color: TEAL, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Patient Reviews</div>
              <h2 style={{ color: SLATE, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, marginBottom: 10 }}>What Patients Are Saying</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: GRAY, fontSize: 14 }}>
                <Star size={16} color="#f59e0b" fill="#f59e0b" /> 4.9 stars · 340+ Google reviews
              </div>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 20 }}>
            {REVIEWS.map(r => (
              <RevealSection key={r.name}>
                <div className="review-card" style={{
                  background: WHITE, borderRadius: 12, padding: "24px",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                    {[...Array(r.stars)].map((_, i) => <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />)}
                  </div>
                  <p style={{ color: SLATE, fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>"{r.text}"</p>
                  <div style={{ color: TEAL, fontSize: 13, fontWeight: 700 }}>— {r.name}</div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Insurance ── */}
      <section style={{ background: WHITE, padding: "64px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <RevealSection>
            <div style={{ color: GRAY, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24 }}>We Accept Most Major Insurance Plans</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8" style={{ gap: 12 }}>
              {INSURANCES.map(ins => (
                <div key={ins} style={{
                  background: GRAY_LIGHT, borderRadius: 8,
                  padding: "10px 12px", fontSize: 11, fontWeight: 600,
                  color: SLATE, textAlign: "center",
                }}>{ins}</div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── Appointment CTA ── */}
      <section id="appointment" style={{ background: TEAL, padding: "80px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <RevealSection>
            <h2 style={{ color: WHITE, fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, marginBottom: 16 }}>
              Ready for a Healthier Smile?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 17, lineHeight: 1.6, marginBottom: 36 }}>
              New patients welcome. Most insurance accepted. Same-day emergency appointments available.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="tel:3138828711" style={{
                display: "flex", alignItems: "center", gap: 8,
                background: WHITE, color: TEAL_DARK,
                padding: "16px 32px", borderRadius: 8, fontSize: 16, fontWeight: 700,
                textDecoration: "none",
              }}>
                <Phone size={20} /> (313) 882-8711
              </a>
              <a href="#contact" style={{
                display: "flex", alignItems: "center", gap: 8,
                border: "2px solid rgba(255,255,255,0.5)", color: WHITE,
                padding: "16px 32px", borderRadius: 8, fontSize: 16, fontWeight: 600,
                textDecoration: "none",
              }}>
                Request Online <ArrowRight size={18} />
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
              <MapPin size={15} /> 19635 Mack Avenue, Grosse Pointe Woods, MI 48236
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: NAVY, padding: "56px 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Smile size={17} color={WHITE} />
                </div>
                <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>Stewart Dental Group</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.65 }}>
                Serving Grosse Pointe families with comprehensive dental care since 1989.
              </p>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Services</div>
              {["General Dentistry", "Cosmetic Dentistry", "CEREC Crowns", "Dental Implants", "Invisalign", "Emergency Dental"].map(s => (
                <div key={s} style={{ marginBottom: 10 }}><a href="#" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textDecoration: "none" }}>{s}</a></div>
              ))}
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Office Hours</div>
              {[
                { day: "Mon – Thu", hrs: "8:00am – 5:00pm" },
                { day: "Friday", hrs: "8:00am – 2:00pm" },
                { day: "Saturday", hrs: "By Appointment" },
                { day: "Sunday", hrs: "Closed" },
              ].map(h => (
                <div key={h.day} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{h.day}</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{h.hrs}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Contact</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <a href="tel:3138828711" style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }}>
                  <Phone size={14} color={TEAL} /> (313) 882-8711
                </a>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  <MapPin size={14} color={TEAL} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>19635 Mack Avenue<br />Grosse Pointe Woods, MI 48236</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>© 2026 Stewart Dental Group. All rights reserved.</span>
            <a href="/manufacturing-web-design" style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textDecoration: "none" }}>Site by M² Web Design</a>
          </div>
        </div>
      </footer>

      {/* ── Design Switcher ── */}
      <div className="hidden lg:block" style={{ position: "fixed", bottom: 20, left: 16, zIndex: 60 }}>
        <div style={{ background: "rgba(15,32,39,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 220, fontSize: 11 }}>
          <div style={{ color: TEAL_LIGHT, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Design Variant</div>
          {[
            { to: "/demo-dental", label: "Teal / Clinical", active: true },
            { to: "/demo-dental-alt1", label: "Warm / Friendly" },
            { to: "/demo-dental-alt2", label: "Nordic / Minimal" },
          ].map(d => (
            <Link
              key={d.to}
              to={d.to}
              style={{
                display: "block", padding: "5px 0",
                color: d.active ? TEAL_LIGHT : "rgba(255,255,255,0.4)",
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
