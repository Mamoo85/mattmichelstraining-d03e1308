import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import {
  Phone, Shield, Star, Award, Clock, CheckCircle, Lock,
  Smile, ScanLine, Microscope, Stethoscope, MapPin, FileCheck, ArrowRight
} from "lucide-react";

const SAGE = "#4A7B6F";
const DARK = "#2C3A32";
const IVORY = "#FAFAF7";
const SAGE_LIGHT = "#EEF4F2";

export default function DentalMockupAlt2() {
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(20px, -20px) scale(1.04); }
        }
        .alt2-fadein { animation: fadeUp .65s ease both; }
        .alt2-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(74,123,111,.13) !important; }
        .alt2-card { transition: transform .25s, box-shadow .25s; }
        .alt2-btn-sage { transition: background .2s; }
        .alt2-btn-sage:hover { background: #3d6a5f !important; }
        .alt2-btn-ghost:hover { background: rgba(74,123,111,.08) !important; }
        .alt2-input:focus { outline: none; border-color: ${SAGE} !important; }
        .alt2-scroll-row { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .alt2-scroll-row::-webkit-scrollbar { display: none; }
        .alt2-scroll-card { scroll-snap-align: start; flex-shrink: 0; }
        .alt2-check { color: ${SAGE}; }
      `}</style>

      {/* DEMO BADGE */}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        background: SAGE, color: "white", borderRadius: 9999,
        padding: "8px 18px", fontSize: 11, fontWeight: 700,
        letterSpacing: ".04em", boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        textAlign: "center", maxWidth: 260, lineHeight: 1.5
      }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* DESIGN SWITCHER */}
      <div style={{
        position: "fixed", bottom: 24, left: 24, zIndex: 9999,
        background: IVORY, border: `1.5px solid ${SAGE}`, borderRadius: 12,
        padding: "12px 18px", boxShadow: "0 4px 20px rgba(74,123,111,.15)",
        fontSize: 12
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: DARK }}>Design Options</div>
        <Link to="/demo-dental" style={{ display: "block", color: "#555", marginBottom: 4, textDecoration: "none" }}>Teal/Clinical</Link>
        <Link to="/demo-dental-alt1" style={{ display: "block", color: "#555", marginBottom: 4, textDecoration: "none" }}>Prestige</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: SAGE, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: SAGE, display: "inline-block" }} />
          Nordic Wellness (Current)
        </div>
      </div>

      {/* HEADER */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "white",
        borderBottom: "1px solid #e5ede9",
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform .3s ease",
        padding: "0 32px"
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", height: 68,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: SAGE, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Smile size={18} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: DARK, letterSpacing: "-.01em" }}>
              Stewart Dental Group
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#appointment" style={{
              padding: "8px 18px", borderRadius: 8,
              border: `1.5px solid ${SAGE}`, color: SAGE,
              fontSize: 13, fontWeight: 600,
              textDecoration: "none", background: "transparent"
            }} className="alt2-btn-ghost">New Patients</a>
            <a href="tel:3138828711" style={{
              padding: "8px 18px", borderRadius: 8,
              background: SAGE, color: "white",
              fontSize: 13, fontWeight: 600,
              textDecoration: "none", display: "flex", alignItems: "center", gap: 6
            }} className="alt2-btn-sage">
              <Phone size={13} /> Call (313) 882-8711
            </a>
          </div>
        </div>
      </header>

      {/* HERO — Split Layout */}
      <section style={{
        minHeight: "100vh", background: IVORY, paddingTop: 68,
        display: "flex", alignItems: "stretch", position: "relative", overflow: "hidden"
      }}>
        {/* Organic blob background */}
        <div style={{
          position: "absolute", top: "10%", left: "5%",
          width: 500, height: 500, borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
          background: `radial-gradient(ellipse, ${SAGE}0d 0%, transparent 70%)`,
          animation: "blobFloat 8s ease-in-out infinite",
          pointerEvents: "none", zIndex: 0
        }} />

        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 24px",
          display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap",
          position: "relative", zIndex: 1, width: "100%", minHeight: "calc(100vh - 68px)"
        }}>
          {/* Left text side */}
          <div style={{ flex: "1 1 400px", padding: "60px 0" }} className="alt2-fadein">
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: SAGE_LIGHT, borderRadius: 50,
              padding: "6px 16px", marginBottom: 28,
              color: SAGE, fontSize: 12, fontWeight: 600,
              letterSpacing: ".04em"
            }}>
              36+ years · Grosse Pointe Woods
            </div>
            <h1 style={{
              fontSize: "clamp(44px, 7vw, 72px)",
              fontWeight: 800, color: DARK,
              lineHeight: 1.1, margin: "0 0 20px",
              letterSpacing: "-.02em"
            }}>
              Your smile<br />
              <span style={{ color: SAGE }}>is worth it.</span>
            </h1>
            <p style={{
              fontSize: 18, color: "#5f7268", lineHeight: 1.75,
              marginBottom: 36, maxWidth: 440
            }}>
              Expert prosthodontic care, one visit at a time. Dr. Robert Stewart brings 36+ years of Mayo Clinic-trained excellence to every smile.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 44 }}>
              <a href="#appointment" style={{
                padding: "14px 28px", background: SAGE, color: "white",
                borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8
              }} className="alt2-btn-sage">
                Schedule a Visit <ArrowRight size={15} />
              </a>
              <a href="tel:3138828711" style={{
                padding: "14px 28px", border: `1.5px solid ${SAGE}`,
                color: SAGE, borderRadius: 10, fontWeight: 600,
                fontSize: 15, textDecoration: "none"
              }} className="alt2-btn-ghost">
                Call Us
              </a>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {["Board-Certified", "Same-Day Crowns", "Mayo Clinic Trained", "14× Top Dentist"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b8f7e", fontWeight: 600 }}>
                  <CheckCircle size={13} color={SAGE} /> {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right image side */}
          <div style={{
            flex: "1 1 360px", display: "flex", alignItems: "center",
            justifyContent: "center", padding: "60px 0"
          }}>
            <div style={{
              borderRadius: 20,
              overflow: "hidden",
              transform: "rotate(-1.5deg)",
              boxShadow: "0 24px 64px rgba(44,58,50,.15)",
              maxWidth: 480, width: "100%"
            }}>
              <img
                src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&q=80"
                alt="Dental care in Grosse Pointe Woods"
                style={{ width: "100%", display: "block", height: 480, objectFit: "cover" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <RevealSection>
        <section style={{ background: SAGE_LIGHT, padding: "22px 24px" }}>
          <div style={{
            maxWidth: 900, margin: "0 auto",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, flexWrap: "wrap"
          }}>
            {[
              { icon: <Clock size={14} color={SAGE} />, text: "36+ Years" },
              { icon: <Star size={14} color={SAGE} />, text: "14× Detroit Top Dentist" },
              { icon: <Award size={14} color={SAGE} />, text: "Mayo Clinic Trained" },
              { icon: <CheckCircle size={14} color={SAGE} />, text: "Same-Day Crowns" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4a7b6f", fontWeight: 600 }}>
                  {item.icon} {item.text}
                </div>
                {i < 3 && <span style={{ color: "#94b8af", fontSize: 18, fontWeight: 300 }}>·</span>}
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* CEREC PROCESS — HORIZONTAL TIMELINE */}
      <RevealSection>
        <section style={{ background: "white", padding: "80px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p style={{ color: SAGE, fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>CEREC SAME-DAY TECHNOLOGY</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: DARK, margin: 0, letterSpacing: "-.02em" }}>
                One Visit. Your Crown. Done.
              </h2>
            </div>
            {/* Timeline track */}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", top: 32, left: "12.5%", right: "12.5%",
                height: 2, background: SAGE_LIGHT, zIndex: 0
              }} />
              <div style={{
                display: "flex", justifyContent: "space-between", gap: 16,
                flexWrap: "wrap"
              }}>
                {[
                  { num: "1", icon: <ScanLine size={20} color="white" />, title: "3D Scan", desc: "Precise digital impression — no gooey trays." },
                  { num: "2", icon: <Microscope size={20} color="white" />, title: "CAD Design", desc: "Custom crown designed to perfect fit on-screen." },
                  { num: "3", icon: <Stethoscope size={20} color="white" />, title: "In-Office Mill", desc: "Porcelain milled to your exact shade in minutes." },
                  { num: "4", icon: <CheckCircle size={20} color="white" />, title: "Bond & Done", desc: "Permanent crown bonded — you leave complete." },
                ].map((step, i) => (
                  <div key={i} style={{
                    flex: "1 1 180px", display: "flex", flexDirection: "column",
                    alignItems: "center", textAlign: "center", position: "relative", zIndex: 1
                  }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: SAGE, display: "flex", alignItems: "center",
                      justifyContent: "center", marginBottom: 16,
                      boxShadow: `0 0 0 6px white, 0 0 0 8px ${SAGE_LIGHT}`
                    }}>
                      {step.icon}
                    </div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 8 }}>{step.title}</h4>
                    <p style={{ fontSize: 13, color: "#6b8f7e", lineHeight: 1.6, margin: 0, maxWidth: 160 }}>{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* SERVICES */}
      <RevealSection>
        <section style={{ background: SAGE_LIGHT, padding: "80px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ color: SAGE, fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>WHAT WE OFFER</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: DARK, margin: 0, letterSpacing: "-.02em" }}>Prosthodontic Services</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              {[
                { icon: <ScanLine size={22} color={SAGE} />, name: "Same-Day CEREC Crowns", desc: "Full porcelain crown — designed, milled, and bonded in a single appointment. No temporaries." },
                { icon: <Stethoscope size={22} color={SAGE} />, name: "Dental Implants", desc: "Permanent tooth replacement that looks, feels, and functions exactly like a natural tooth." },
                { icon: <FileCheck size={22} color={SAGE} />, name: "Bridges & Partials", desc: "Custom-crafted removable and fixed prosthetics when multiple teeth need restoration." },
                { icon: <Smile size={22} color={SAGE} />, name: "Complete Dentures", desc: "Full-arch restorations engineered for comfort, natural appearance, and long-term stability." },
              ].map((s, i) => (
                <div key={i} style={{
                  background: "white", borderRadius: 20, padding: "28px 24px",
                  boxShadow: "0 2px 12px rgba(74,123,111,.06)"
                }} className="alt2-card">
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: SAGE_LIGHT, display: "flex", alignItems: "center",
                    justifyContent: "center", marginBottom: 16
                  }}>
                    {s.icon}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 10 }}>{s.name}</h3>
                  <p style={{ fontSize: 14, color: "#6b8f7e", lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* DOCTOR */}
      <RevealSection>
        <section style={{ background: "white", padding: "80px 24px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 60, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto" }}>
              <img
                src="/images/dental-doctor.jpg"
                alt="Dr. Robert Stewart, DDS, MS"
                style={{
                  width: 220, height: 220, borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${SAGE}`,
                  boxShadow: `0 8px 32px rgba(74,123,111,.15)`
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <p style={{ color: SAGE, fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 12 }}>YOUR DOCTOR</p>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: DARK, margin: "0 0 4px", letterSpacing: "-.02em" }}>Dr. Robert Stewart</h2>
              <p style={{ color: "#6b8f7e", fontSize: 15, marginBottom: 28 }}>DDS, MS — Board-Certified Prosthodontist</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                {[
                  "DDS, University of Michigan — 1987",
                  "MS in Prosthodontics, Mayo Clinic — 1990",
                  "Diplomate, American Board of Prosthodontics — 1995",
                  "14× Named Detroit Top Dentist",
                ].map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CheckCircle size={15} color={SAGE} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
              <div style={{
                background: SAGE_LIGHT, borderRadius: 16, padding: "20px 24px"
              }}>
                <p style={{ fontStyle: "italic", color: SAGE, fontSize: 16, lineHeight: 1.65, margin: "0 0 8px" }}>
                  "We take on the cases others say can't be done."
                </p>
                <p style={{ fontSize: 12, color: "#9db8b0", margin: 0, fontWeight: 600 }}>— Dr. Robert Stewart, DDS, MS</p>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* TESTIMONIALS — HORIZONTAL SCROLL */}
      <RevealSection>
        <section style={{ background: IVORY, padding: "80px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <p style={{ color: SAGE, fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>PATIENT STORIES</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: DARK, margin: 0, letterSpacing: "-.02em" }}>What patients are saying</h2>
            </div>
          </div>
          <div className="alt2-scroll-row" style={{
            display: "flex", gap: 20, paddingLeft: 24, paddingRight: 24,
            paddingBottom: 12
          }}>
            {[
              { quote: "I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment.", attr: "C.P., Grosse Pointe Farms" },
              { quote: "Dr. Stewart and his team gave me back the confidence to laugh out loud again. The professionalism, compassion and care were nothing short of fantastic.", attr: "M.Z., St. Clair Shores" },
              { quote: "He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. And his shots don't hurt.", attr: "S.R., Detroit" },
              { quote: "Superior service and staff — always accommodating. I have been a patient for 38 years!", attr: "Patient of Record" },
            ].map((t, i) => (
              <div key={i} className="alt2-scroll-card" style={{
                width: 320, background: "white", borderRadius: 16,
                padding: "28px 24px",
                boxShadow: "0 4px 20px rgba(44,58,50,.07)"
              }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill={SAGE} color={SAGE} />
                  ))}
                </div>
                <p style={{ fontStyle: "italic", color: DARK, lineHeight: 1.75, fontSize: 14, marginBottom: 16 }}>
                  "{t.quote}"
                </p>
                <p style={{ fontSize: 12, color: "#9db8b0", margin: 0, fontWeight: 600 }}>— {t.attr}</p>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* SAFETY BAND */}
      <RevealSection>
        <section style={{ background: SAGE_LIGHT, padding: "28px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20 }}>
            {[
              { icon: <Shield size={16} color={SAGE} />, label: "HIPAA Compliant" },
              { icon: <Award size={16} color={SAGE} />, label: "ADA Member" },
              { icon: <FileCheck size={16} color={SAGE} />, label: "Sterilization Certified" },
              { icon: <Lock size={16} color={SAGE} />, label: "Secure Records" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4a7b6f", fontWeight: 600 }}>
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* APPOINTMENT FORM */}
      <RevealSection>
        <section id="appointment" style={{ background: "white", padding: "80px 24px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{
              background: "white", borderRadius: 20,
              boxShadow: "0 8px 48px rgba(44,58,50,.1)",
              padding: "48px 40px"
            }}>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <p style={{ color: SAGE, fontSize: 12, letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 }}>GET IN TOUCH</p>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: DARK, margin: 0, letterSpacing: "-.02em" }}>Request an Appointment</h2>
              </div>
              <form onSubmit={(e) => e.preventDefault()}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                  {[
                    { id: "firstName", label: "First Name", type: "text", placeholder: "Jane" },
                    { id: "lastName", label: "Last Name", type: "text", placeholder: "Smith" },
                    { id: "phone", label: "Phone", type: "tel", placeholder: "(313) 000-0000" },
                    { id: "email", label: "Email", type: "email", placeholder: "jane@email.com" },
                  ].map((f) => (
                    <div key={f.id} style={{ marginBottom: 20 }}>
                      <label style={{ display: "block", fontSize: 12, color: "#6b8f7e", fontWeight: 600, marginBottom: 6 }}>{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={(formData as any)[f.id]}
                        onChange={(e) => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                        className="alt2-input"
                        style={{
                          width: "100%", padding: "10px 14px",
                          border: "1px solid #d1e0db", borderRadius: 12,
                          fontSize: 14, color: DARK, background: "white",
                          outline: "none"
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#6b8f7e", fontWeight: 600, marginBottom: 6 }}>Preferred Day</label>
                  <select
                    value={formData.preferredDay}
                    onChange={(e) => setFormData(p => ({ ...p, preferredDay: e.target.value }))}
                    className="alt2-input"
                    style={{
                      width: "100%", padding: "10px 14px",
                      border: "1px solid #d1e0db", borderRadius: 12,
                      fontSize: 14, color: DARK, background: "white",
                      outline: "none", appearance: "none"
                    }}
                  >
                    <option value="">Select a day</option>
                    <option>Monday</option>
                    <option>Tuesday</option>
                    <option>Thursday</option>
                  </select>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#6b8f7e", fontWeight: 600, marginBottom: 6 }}>Reason for Visit</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData(p => ({ ...p, reason: e.target.value }))}
                    className="alt2-input"
                    style={{
                      width: "100%", padding: "10px 14px",
                      border: "1px solid #d1e0db", borderRadius: 12,
                      fontSize: 14, color: DARK, background: "white",
                      outline: "none", appearance: "none"
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
                  width: "100%", padding: "15px", background: SAGE, color: "white",
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: "pointer", letterSpacing: ".01em"
                }} className="alt2-btn-sage">
                  Request My Appointment
                </button>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, marginTop: 16, color: "#9db8b0", fontSize: 12
                }}>
                  <Lock size={12} /> Your information is private and HIPAA-protected.
                </div>
              </form>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* FOOTER */}
      <footer style={{ background: DARK, padding: "52px 24px 28px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: SAGE, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Smile size={16} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>Stewart Dental Group</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 40 }}>
            <div>
              <h4 style={{ color: SAGE, fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 14 }}>CONTACT</h4>
              <div style={{ color: "#94b8af", fontSize: 14, lineHeight: 2 }}>
                <div>19635 Mack Avenue</div>
                <div>Grosse Pointe Woods, MI 48236</div>
                <a href="tel:3138828711" style={{ color: "white", textDecoration: "none", display: "block" }}>(313) 882-8711</a>
              </div>
            </div>
            <div>
              <h4 style={{ color: SAGE, fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 14 }}>OFFICE HOURS</h4>
              <div style={{ color: "#94b8af", fontSize: 14, lineHeight: 2 }}>
                <div><span style={{ color: "white" }}>Mon / Tue / Thu</span> — 7:30 – 4:00</div>
                <div><span style={{ color: "white" }}>Wednesday</span> — 8:30 – 12:30</div>
                <div><span style={{ color: "white" }}>Fri – Sun</span> — Closed</div>
              </div>
            </div>
            <div>
              <h4 style={{ color: SAGE, fontSize: 11, letterSpacing: ".1em", fontWeight: 700, marginBottom: 14 }}>PAYMENT</h4>
              <div style={{ color: "#94b8af", fontSize: 14, lineHeight: 2 }}>
                <div>Visa · MasterCard</div>
                <div>American Express · CareCredit</div>
              </div>
            </div>
          </div>
          <div style={{
            borderTop: "1px solid rgba(74,123,111,.25)", paddingTop: 22,
            display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12
          }}>
            <p style={{ color: "#4a6b5a", fontSize: 12, margin: 0 }}>
              © 2024 Stewart Dental Group. All rights reserved.
            </p>
            <Link to="/dental-web-design" style={{ color: SAGE, fontSize: 12, textDecoration: "none" }}>
              Site by Matt Michels Web Design
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
