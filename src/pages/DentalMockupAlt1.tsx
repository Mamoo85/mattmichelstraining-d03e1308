import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import {
  Phone, Shield, Star, Award, Clock, CheckCircle, Lock,
  ScanLine, Microscope, Stethoscope, MapPin, FileCheck, ChevronRight, ArrowRight
} from "lucide-react";

const GOLD = "#C9A84C";
const NAVY = "#0B1426";
const CREAM = "#F8F3EC";
const PEARL = "#FDFAF5";

const headingFont: React.CSSProperties = { fontFamily: "'Georgia', serif" };

export default function DentalMockupAlt1() {
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    preferredDay: "", reason: ""
  });

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setVisible(current < lastY || current < 60);
      setLastY(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastY]);

  return (
    <>
      <Helmet>
        <title>Stewart Dental Group — Grosse Pointe Woods Prosthodontist</title>
        <meta name="description" content="Dr. Robert Stewart, Board-Certified Prosthodontist. Same-day CEREC crowns, dental implants, and full-mouth rehabilitation in Grosse Pointe Woods, MI." />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes goldPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,.4); }
          50%      { box-shadow: 0 0 0 12px rgba(201,168,76,0); }
        }
        .alt1-fadein { animation: fadeUp .7s ease both; }
        .alt1-card:hover { box-shadow: 0 8px 32px rgba(201,168,76,.18); transform: translateY(-3px); }
        .alt1-card { transition: box-shadow .25s, transform .25s; }
        .alt1-input:focus { outline: none; border-bottom-color: ${GOLD} !important; }
        .alt1-btn-gold { transition: background .2s, color .2s; }
        .alt1-btn-gold:hover { background: #b8913e !important; }
        .alt1-btn-ghost:hover { background: rgba(201,168,76,.08) !important; }
        .alt1-service:hover { box-shadow: 4px 8px 24px rgba(201,168,76,.15); }
        .alt1-service { transition: box-shadow .25s; }
        .alt1-scroll-x { scrollbar-width: none; }
        .alt1-scroll-x::-webkit-scrollbar { display: none; }
      `}</style>

      {/* DEMO BADGE */}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        background: GOLD, color: NAVY, borderRadius: 9999,
        padding: "8px 18px", fontSize: 11, fontWeight: 700,
        letterSpacing: ".04em", boxShadow: "0 4px 16px rgba(0,0,0,.25)",
        fontFamily: "Inter, sans-serif", textAlign: "center", maxWidth: 260,
        lineHeight: 1.5
      }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* DESIGN SWITCHER */}
      <div style={{
        position: "fixed", bottom: 24, left: 24, zIndex: 9999,
        background: "white", border: `1.5px solid ${GOLD}`, borderRadius: 12,
        padding: "12px 18px", boxShadow: "0 4px 20px rgba(0,0,0,.13)",
        fontFamily: "Inter, sans-serif", fontSize: 12
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: NAVY }}>Design Options</div>
        <Link to="/demo-dental" style={{ display: "block", color: "#555", marginBottom: 4, textDecoration: "none" }}>Teal/Clinical</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: GOLD, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
          Prestige (Current)
        </div>
        <Link to="/demo-dental-alt2" style={{ display: "block", color: "#555", textDecoration: "none" }}>Nordic Wellness</Link>
      </div>

      {/* HEADER */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: `rgba(253,250,245,.97)`,
        backdropFilter: "blur(10px)",
        borderBottom: `1.5px solid ${GOLD}`,
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform .3s ease",
        padding: "0 32px"
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", height: 70,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: GOLD, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span style={{ fontSize: 20 }}>✦</span>
            </div>
            <span style={{ ...headingFont, fontSize: 17, fontWeight: 700, color: NAVY, letterSpacing: ".06em" }}>
              STEWART DENTAL GROUP
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="#appointment" style={{
              padding: "8px 20px", borderRadius: 6,
              border: `1.5px solid ${GOLD}`, color: GOLD,
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
              textDecoration: "none", background: "transparent"
            }} className="alt1-btn-ghost">New Patients</a>
            <a href="tel:3138828711" style={{
              padding: "8px 20px", borderRadius: 6,
              background: GOLD, color: NAVY,
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700,
              textDecoration: "none", display: "flex", alignItems: "center", gap: 6
            }} className="alt1-btn-gold">
              <Phone size={14} /> Call (313) 882-8711
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", background: NAVY, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        paddingTop: 70, overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1600&q=80)`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: .2
        }} />
        <div style={{ position: "relative", textAlign: "center", maxWidth: 780, padding: "0 24px" }} className="alt1-fadein">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: `1px solid ${GOLD}`, borderRadius: 50,
            padding: "6px 18px", marginBottom: 28,
            color: GOLD, fontSize: 12, fontFamily: "Inter, sans-serif",
            letterSpacing: ".08em", fontWeight: 600
          }}>
            <Award size={13} /> Board-Certified Prosthodontist
          </div>
          <h1 style={{
            ...headingFont, fontSize: "clamp(42px, 7vw, 72px)",
            color: "white", margin: "0 0 20px", lineHeight: 1.15,
            letterSpacing: ".02em", fontWeight: 400
          }}>
            Where Precision Meets <span style={{ color: GOLD }}>Artistry</span>
          </h1>
          <div style={{ width: 60, height: 2, background: GOLD, margin: "0 auto 24px" }} />
          <p style={{
            color: "#c8d0dc", fontSize: 18, lineHeight: 1.7,
            fontFamily: "Inter, sans-serif", marginBottom: 36, maxWidth: 600, margin: "0 auto 36px"
          }}>
            Dr. Robert Stewart brings Mayo Clinic-trained prosthodontic expertise to Grosse Pointe Woods.
            Same-day CEREC crowns, dental implants, and full-mouth rehabilitation — all under one roof.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 52 }}>
            <a href="#appointment" style={{
              padding: "14px 32px", background: GOLD, color: NAVY,
              borderRadius: 6, fontFamily: "Inter, sans-serif", fontWeight: 700,
              fontSize: 15, textDecoration: "none", display: "flex", alignItems: "center", gap: 8
            }} className="alt1-btn-gold">
              Schedule Your Visit <ArrowRight size={16} />
            </a>
            <a href="tel:3138828711" style={{
              padding: "14px 32px", border: `1.5px solid ${GOLD}`,
              color: GOLD, borderRadius: 6, fontFamily: "Inter, sans-serif",
              fontWeight: 600, fontSize: 15, textDecoration: "none"
            }} className="alt1-btn-ghost">
              Call the Office
            </a>
          </div>
          <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { icon: <Clock size={16} />, label: "36+ Years" },
              { icon: <Star size={16} />, label: "14× Top Dentist" },
              { icon: <Award size={16} />, label: "Mayo Clinic Trained" },
              { icon: <CheckCircle size={16} />, label: "1-Visit Crowns" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600 }}>
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <RevealSection>
        <section style={{ background: NAVY, borderTop: `1px solid rgba(201,168,76,.3)`, padding: "40px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 24 }}>
            {[
              { num: "36+", label: "Years of Excellence" },
              { num: "14×", label: "Detroit Top Dentist" },
              { num: "Mayo", label: "Clinic Trained" },
              { num: "1 Visit", label: "CEREC Crowns" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ ...headingFont, fontSize: 44, color: GOLD, letterSpacing: ".02em", fontWeight: 400 }}>{s.num}</div>
                <div style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* CEREC BENTO GRID */}
      <RevealSection>
        <section style={{ background: CREAM, padding: "80px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>CEREC TECHNOLOGY</p>
              <h2 style={{ ...headingFont, fontSize: 38, color: NAVY, margin: 0, letterSpacing: ".02em", fontWeight: 400 }}>The Desktop Laboratory</h2>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gridTemplateRows: "auto auto",
              gap: 20
            }}>
              {/* Large card */}
              <div style={{
                gridRow: "1 / 3", background: NAVY, borderRadius: 12,
                padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ width: 40, height: 3, background: GOLD, marginBottom: 24 }} />
                  <h3 style={{ ...headingFont, color: "white", fontSize: 26, fontWeight: 400, marginBottom: 16, letterSpacing: ".02em" }}>
                    Your Crown, Built In-Office
                  </h3>
                  <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", lineHeight: 1.75, fontSize: 15, marginBottom: 24 }}>
                    Our CEREC system is a complete dental laboratory inside our practice. Unlike most offices that send impressions to an outside lab — a 2-to-3-week wait — we design, mill, and bond your porcelain crown the same day, often in under two hours.
                  </p>
                  <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", lineHeight: 1.75, fontSize: 15 }}>
                    No temporaries. No second appointment. No compromise in quality.
                  </p>
                </div>
                <div style={{
                  borderLeft: `3px solid ${GOLD}`, paddingLeft: 20, marginTop: 32
                }}>
                  <p style={{ ...headingFont, color: GOLD, fontSize: 18, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                    "We are all about prosthetic dentistry here. We are ready for you."
                  </p>
                  <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 12, marginTop: 10 }}>— Dr. Robert Stewart, DDS, MS</p>
                </div>
              </div>
              {/* Small cards */}
              {[
                { step: "01", icon: <ScanLine size={22} color={GOLD} />, title: "3D Digital Scan", desc: "Precise optical impressions replace uncomfortable traditional molds." },
                { step: "02", icon: <Microscope size={22} color={GOLD} />, title: "CAD/CAM Design", desc: "Our team designs your restoration digitally to perfect fit and occlusion." },
                { step: "03", icon: <Stethoscope size={22} color={GOLD} />, title: "In-Office Milling", desc: "Porcelain milled on-site to match your exact tooth shade and contour." },
              ].map((c, i) => (
                <div key={i} style={{
                  background: "white", borderRadius: 12, borderTop: `3px solid ${GOLD}`,
                  padding: "24px 28px"
                }} className="alt1-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ ...headingFont, fontSize: 28, color: GOLD, fontWeight: 400, opacity: .5 }}>{c.step}</span>
                    {c.icon}
                  </div>
                  <h4 style={{ ...headingFont, color: NAVY, fontSize: 17, fontWeight: 400, marginBottom: 8 }}>{c.title}</h4>
                  <p style={{ color: "#6b7280", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* SERVICES */}
      <RevealSection>
        <section style={{ background: "white", padding: "80px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>WHAT WE DO</p>
              <h2 style={{ ...headingFont, fontSize: 38, color: NAVY, margin: 0, letterSpacing: ".02em", fontWeight: 400 }}>Our Services</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
              {[
                { name: "Same-Day CEREC Crowns", desc: "Full porcelain crown designed and placed in a single visit. No temporaries, no second appointment." },
                { name: "Dental Implants", desc: "Permanent, natural-looking tooth replacement anchored directly to your jawbone for lifetime results." },
                { name: "Bridges & Partials", desc: "Custom-crafted prosthetics to restore function and aesthetics when multiple teeth are missing." },
                { name: "Complete Dentures", desc: "Full-arch restorations engineered for comfort, stability, and a smile that looks completely natural." },
              ].map((s, i) => (
                <div key={i} style={{
                  borderLeft: `4px solid ${GOLD}`, padding: "20px 20px 20px 24px",
                  background: "white", borderRadius: "0 8px 8px 0"
                }} className="alt1-service">
                  <h3 style={{ ...headingFont, color: GOLD, fontSize: 18, fontWeight: 400, marginBottom: 10 }}>{s.name}</h3>
                  <p style={{ color: "#6b7280", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* DOCTOR */}
      <RevealSection>
        <section style={{ background: NAVY, padding: "80px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto" }}>
              <img
                src="/images/dental-doctor.jpg"
                alt="Dr. Robert Stewart, DDS, MS"
                style={{
                  width: 240, height: 240, borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${GOLD}`,
                  animation: "goldPulse 3s infinite"
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <p style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 12 }}>MEET YOUR DOCTOR</p>
              <h2 style={{ ...headingFont, color: GOLD, fontSize: 36, fontWeight: 400, marginBottom: 6 }}>Dr. Robert Stewart</h2>
              <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 15, marginBottom: 28 }}>DDS, MS — Board-Certified Prosthodontist</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {[
                  "DDS, University of Michigan School of Dentistry — 1987",
                  "MS in Prosthodontics, Mayo Clinic Graduate School — 1990",
                  "Diplomate, American Board of Prosthodontics — 1995",
                  "14× named Detroit Top Dentist",
                ].map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CheckCircle size={16} color={GOLD} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: "#c8d0dc", fontFamily: "Inter, sans-serif", fontSize: 14 }}>{c}</span>
                  </div>
                ))}
              </div>
              <blockquote style={{
                borderLeft: `3px solid ${GOLD}`, paddingLeft: 20, margin: 0
              }}>
                <p style={{ ...headingFont, color: CREAM, fontSize: 18, fontStyle: "italic", lineHeight: 1.65 }}>
                  "We are all about prosthetic dentistry here. We are ready for you."
                </p>
              </blockquote>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* TESTIMONIALS */}
      <RevealSection>
        <section style={{ background: CREAM, padding: "80px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>PATIENT WORDS</p>
              <h2 style={{ ...headingFont, fontSize: 38, color: NAVY, margin: 0, fontWeight: 400 }}>What Our Patients Say</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
              {[
                { quote: "I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment.", attr: "C.P., Grosse Pointe Farms" },
                { quote: "Dr. Stewart and his team gave me back the confidence to laugh out loud again. The professionalism, compassion and care were nothing short of fantastic.", attr: "M.Z., St. Clair Shores" },
                { quote: "He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. And his shots don't hurt.", attr: "S.R., Detroit" },
                { quote: "Superior service and staff — always accommodating. I have been a patient for 38 years!", attr: "Patient of Record" },
              ].map((t, i) => (
                <div key={i} style={{
                  background: "white", borderRadius: 12,
                  border: `1px solid rgba(201,168,76,.25)`, padding: "28px 24px"
                }} className="alt1-card">
                  <div style={{ fontSize: 80, color: GOLD, lineHeight: 0, marginBottom: 20, ...headingFont }}>❝</div>
                  <p style={{ ...headingFont, fontStyle: "italic", color: NAVY, lineHeight: 1.7, fontSize: 15, marginBottom: 16 }}>{t.quote}</p>
                  <p style={{ color: "#9ca3af", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>— {t.attr}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* HIPAA SAFETY BAND */}
      <RevealSection>
        <section style={{ background: "white", padding: "32px 24px", borderTop: `1px solid ${CREAM}` }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20 }}>
            {[
              "HIPAA Compliant Practice",
              "ADA Member Dentist",
              "Sterilization Certified",
              "Digital X-Ray Safety",
            ].map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Shield size={18} color={GOLD} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#4b5563" }}>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* APPOINTMENT FORM */}
      <RevealSection>
        <section id="appointment" style={{ background: CREAM, padding: "80px 24px" }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <p style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>GET STARTED</p>
              <h2 style={{ ...headingFont, fontSize: 38, color: NAVY, margin: 0, fontWeight: 400 }}>Schedule Your Visit</h2>
            </div>
            <form onSubmit={(e) => e.preventDefault()}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
                {[
                  { id: "firstName", label: "First Name", type: "text" },
                  { id: "lastName", label: "Last Name", type: "text" },
                  { id: "phone", label: "Phone", type: "tel" },
                  { id: "email", label: "Email", type: "email" },
                ].map((f) => (
                  <div key={f.id} style={{ marginBottom: 28 }}>
                    <label style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 11, color: GOLD, letterSpacing: ".08em", fontWeight: 600, marginBottom: 6 }}>{f.label.toUpperCase()}</label>
                    <input
                      type={f.type}
                      value={(formData as any)[f.id]}
                      onChange={(e) => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                      className="alt1-input"
                      style={{
                        width: "100%", background: "transparent",
                        border: "none", borderBottom: `1px solid rgba(201,168,76,.5)`,
                        padding: "8px 0", fontFamily: "Inter, sans-serif",
                        fontSize: 15, color: NAVY, outline: "none", boxSizing: "border-box"
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 11, color: GOLD, letterSpacing: ".08em", fontWeight: 600, marginBottom: 6 }}>PREFERRED DAY</label>
                <select
                  value={formData.preferredDay}
                  onChange={(e) => setFormData(p => ({ ...p, preferredDay: e.target.value }))}
                  className="alt1-input"
                  style={{
                    width: "100%", background: "transparent",
                    border: "none", borderBottom: `1px solid rgba(201,168,76,.5)`,
                    padding: "8px 0", fontFamily: "Inter, sans-serif",
                    fontSize: 15, color: NAVY, outline: "none", appearance: "none"
                  }}
                >
                  <option value="">Select a day</option>
                  <option>Monday</option>
                  <option>Tuesday</option>
                  <option>Thursday</option>
                </select>
              </div>
              <div style={{ marginBottom: 36 }}>
                <label style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 11, color: GOLD, letterSpacing: ".08em", fontWeight: 600, marginBottom: 6 }}>REASON FOR VISIT</label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData(p => ({ ...p, reason: e.target.value }))}
                  className="alt1-input"
                  style={{
                    width: "100%", background: "transparent",
                    border: "none", borderBottom: `1px solid rgba(201,168,76,.5)`,
                    padding: "8px 0", fontFamily: "Inter, sans-serif",
                    fontSize: 15, color: NAVY, outline: "none", appearance: "none"
                  }}
                >
                  <option value="">Select a reason</option>
                  <option>Crown / Same-Day CEREC</option>
                  <option>Dental Implant Consultation</option>
                  <option>Bridge or Partial</option>
                  <option>Complete Dentures</option>
                  <option>Full-Mouth Rehabilitation</option>
                  <option>Second Opinion</option>
                  <option>New Patient Exam</option>
                </select>
              </div>
              <button type="submit" style={{
                width: "100%", padding: "16px", background: GOLD, color: NAVY,
                border: "none", borderRadius: 6, fontFamily: "Inter, sans-serif",
                fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: ".03em"
              }} className="alt1-btn-gold">
                Request My Appointment
              </button>
              <p style={{
                textAlign: "center", fontFamily: "Inter, sans-serif",
                fontSize: 12, color: "#9ca3af", marginTop: 16,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6
              }}>
                <Lock size={12} /> Your information is private and HIPAA-protected.
              </p>
            </form>
          </div>
        </section>
      </RevealSection>

      {/* FOOTER */}
      <footer style={{ background: NAVY, padding: "60px 24px 30px", color: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
                <span style={{ ...headingFont, fontSize: 15, color: "white", letterSpacing: ".05em" }}>STEWART DENTAL GROUP</span>
              </div>
              <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.7 }}>
                Mayo Clinic-trained prosthodontic care serving Grosse Pointe and the greater Detroit area for over 36 years.
              </p>
            </div>
            <div>
              <h4 style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 16 }}>CONTACT</h4>
              <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.9 }}>
                19635 Mack Avenue<br />
                Grosse Pointe Woods, MI 48236<br />
                <a href="tel:3138828711" style={{ color: GOLD, textDecoration: "none" }}>(313) 882-8711</a>
              </p>
            </div>
            <div>
              <h4 style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 16 }}>HOURS</h4>
              <div style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 2 }}>
                <div>Mon / Tue / Thu — 7:30 am – 4:00 pm</div>
                <div>Wednesday — 8:30 am – 12:30 pm</div>
                <div>Fri – Sun — Closed</div>
              </div>
            </div>
            <div>
              <h4 style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 16 }}>PAYMENT</h4>
              <p style={{ color: "#8a9ab5", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.9 }}>
                Visa · MasterCard<br />American Express · CareCredit
              </p>
            </div>
          </div>
          <div style={{ borderTop: `1px solid rgba(201,168,76,.2)`, paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <p style={{ color: "#4b5563", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>
              © 2024 Stewart Dental Group. All rights reserved.
            </p>
            <Link to="/dental-web-design" style={{ color: GOLD, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "none" }}>
              Site by Matt Michels Web Design
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
