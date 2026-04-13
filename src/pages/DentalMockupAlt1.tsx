import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import { Phone, Shield, Star, Award, Clock, CheckCircle, Lock, ScanLine, Microscope, Stethoscope, MapPin, ArrowRight, Menu, X } from "lucide-react";

const G = "#C9A84C";
const N = "#0B1426";
const C = "#F8F3EC";
const P = "#FDFAF5";

export default function DentalMockupAlt1() {
  const [vis, setVis] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first: "", last: "", phone: "", email: "", day: "", reason: "" });

  useEffect(() => {
    const fn = () => { const y = window.scrollY; setVis(y < 80 || y < lastY); setLastY(y); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [lastY]);

  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const field = (id: keyof typeof form, label: string, type: string) => (
    <div key={id}>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>{label}</label>
      <input type={type} value={form[id]} onChange={e => setForm(p => ({ ...p, [id]: e.target.value }))}
        className="w-full bg-transparent text-sm outline-none"
        style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N, fontFamily: "Inter, sans-serif" }} />
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Stewart Dental Group — Grosse Pointe Woods Prosthodontist</title>
        <meta name="description" content="Dr. Robert Stewart, Board-Certified Prosthodontist. Same-day CEREC crowns, dental implants, full-mouth rehabilitation. Grosse Pointe Woods, MI." />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8" style={{ background: N }}>
          <button onClick={() => setOpen(false)} className="absolute top-5 right-5 p-2" style={{ color: "white", background: "none", border: "none", cursor: "pointer" }}><X size={28} /></button>
          {[["#cerec","CEREC Technology"],["#services","Our Services"],["#doctor","Meet Dr. Stewart"],["#appointment","Schedule a Visit"]].map(([h,l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="text-3xl font-light tracking-wide transition-colors"
              style={{ fontFamily: "'Playfair Display', serif", color: "white", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = G)} onMouseLeave={e => (e.currentTarget.style.color = "white")}>{l}</a>
          ))}
          <a href="#appointment" onClick={() => setOpen(false)} className="mt-4 px-10 py-4 font-bold text-sm tracking-widest rounded"
            style={{ background: G, color: N, textDecoration: "none" }}>BOOK YOUR VISIT</a>
          <a href="tel:3138828711" style={{ color: G, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>(313) 882-8711</a>
        </div>
      )}

      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background: G, color: N }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* Design switcher */}
      <div className="hidden lg:block fixed bottom-5 left-5 z-[150] text-xs" style={{ background: "white", border: `1.5px solid ${G}`, borderRadius: 10, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,.1)", fontFamily: "Inter, sans-serif" }}>
        <div className="font-bold mb-2" style={{ fontSize: 10, letterSpacing: ".1em", color: N }}>DESIGN OPTIONS</div>
        <Link to="/demo-dental" style={{ display: "block", color: "#888", marginBottom: 4, textDecoration: "none" }}>Teal / Clinical</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: G, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: G, display: "inline-block" }} /> Prestige (Current)
        </div>
        <Link to="/demo-dental-alt2" style={{ display: "block", color: "#888", textDecoration: "none" }}>Nordic Wellness</Link>
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 z-[100] transition-transform duration-300"
        style={{ top: 32, transform: vis ? "translateY(0)" : "translateY(-100%)", background: "rgba(253,250,245,.97)", backdropFilter: "blur(12px)", borderBottom: `1px solid rgba(201,168,76,.25)` }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: N }}>
              <span style={{ color: G, fontSize: 16 }}>✦</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600, color: N, letterSpacing: ".05em", lineHeight: 1.2 }}>STEWART<br />DENTAL GROUP</div>
          </div>
          <nav className="hidden md:flex items-center gap-3">
            <a href="#appointment" className="px-4 py-2 rounded text-sm font-semibold" style={{ border: `1.5px solid ${G}`, color: G, textDecoration: "none" }}>New Patients</a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold" style={{ background: G, color: N, textDecoration: "none" }}>
              <Phone size={13} /> (313) 882-8711
            </a>
          </nav>
          <button className="md:hidden p-2" onClick={() => setOpen(true)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <Menu size={24} color={N} />
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative flex items-center justify-center overflow-hidden min-h-screen" style={{ background: N, paddingTop: "calc(32px + 64px)" }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1588776814546-1ffbb1b72cb7?w=1920&q=80)", opacity: 0.12 }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(11,20,38,.98) 0%, rgba(11,20,38,.75) 55%, rgba(11,20,38,.5) 100%)" }} />
        <div className="relative z-10 max-w-5xl mx-auto px-5 py-24 text-center w-full">
          <div className="inline-flex items-center gap-2 rounded-full border mb-8 px-5 py-2 text-xs font-semibold tracking-widest" style={{ borderColor: "rgba(201,168,76,.5)", color: G }}>
            <Award size={12} /> Board-Certified Prosthodontist · Grosse Pointe Woods
          </div>
          <h1 className="mb-6" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(44px,7vw,80px)", fontWeight: 400, color: "white", lineHeight: 1.1 }}>
            Where Precision<br />Meets <span style={{ color: G }}>Artistry</span>
          </h1>
          <div className="mx-auto mb-8" style={{ width: 56, height: 2, background: G }} />
          <p className="mx-auto mb-10 text-lg font-light" style={{ color: "rgba(200,208,220,.85)", lineHeight: 1.8, maxWidth: 560 }}>
            Dr. Robert Stewart brings Mayo Clinic-trained prosthodontic expertise to Grosse Pointe Woods.
            Same-day CEREC crowns, implants, and full-mouth rehabilitation — all under one roof.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
            <a href="#appointment" className="flex items-center gap-2 px-8 py-4 rounded font-bold text-sm tracking-wide w-full sm:w-auto justify-center" style={{ background: G, color: N, textDecoration: "none" }}>
              Schedule Your Visit <ArrowRight size={16} />
            </a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-sm w-full sm:w-auto justify-center" style={{ border: `1.5px solid ${G}`, color: G, textDecoration: "none" }}>
              <Phone size={14} /> Call the Office
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {[[<Clock size={14} key="c" />,"36+ Years"],[<Star size={14} key="s" />,"14× Top Dentist"],[<Award size={14} key="a" />,"Mayo Clinic Trained"],[<CheckCircle size={14} key="ch" />,"Same-Day Crowns"]].map(([icon,label],i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color: G }}>{icon} {label as string}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="py-5 px-5" style={{ background: "white", borderBottom: "1px solid rgba(201,168,76,.12)" }}>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6">
          {["HIPAA Compliant","ADA Member Dentist","Autoclave Sterilized","Digital X-Ray Safety"].map(t => (
            <div key={t} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#6b7280" }}>
              <Shield size={14} color={G} /> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <RevealSection>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ background: N, borderTop: "1px solid rgba(201,168,76,.1)" }}>
          {[["36+","Years of Excellence"],["14×","Detroit Top Dentist"],["Mayo","Clinic Trained"],["1 Visit","CEREC Crowns"]].map(([n,l],i) => (
            <div key={i} className="text-center py-10 px-4" style={{ borderRight: i < 3 ? "1px solid rgba(201,168,76,.1)" : "none" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px,4vw,52px)", color: G, fontWeight: 400 }}>{n}</div>
              <div className="text-xs uppercase tracking-widest mt-2" style={{ color: "rgba(138,154,181,.65)" }}>{l}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* CEREC */}
      <RevealSection>
        <section id="cerec" className="py-20 px-5" style={{ background: C }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>CEREC Technology</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>The Desktop Laboratory</h2>
              <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: "#6b7280" }}>Your crown — designed, milled, and placed in a single visit. No temporaries. No second appointment.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: N }}>
                <img src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80" alt="CEREC technology" className="w-full object-cover" style={{ height: 240 }} />
                <div className="p-9 flex-1 flex flex-col justify-between">
                  <div>
                    <div style={{ width: 40, height: 2, background: G, marginBottom: 20 }} />
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 22, fontWeight: 400, marginBottom: 14 }}>Your Crown, Built In-Office</h3>
                    <p style={{ color: "rgba(138,154,181,.8)", lineHeight: 1.85, fontSize: 14 }}>
                      Our CEREC system is a complete dental laboratory inside our practice. Unlike most offices that ship impressions to an outside lab — a 2-to-3 week wait — we design, mill, and bond your porcelain crown the same day, often in under two hours.
                    </p>
                  </div>
                  <div className="mt-8" style={{ borderLeft: `3px solid ${G}`, paddingLeft: 18 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: G, fontSize: 15, lineHeight: 1.65 }}>"We are all about prosthetic dentistry here. We are ready for you."</p>
                    <p style={{ color: "rgba(138,154,181,.45)", fontSize: 11, marginTop: 8 }}>— Dr. Robert Stewart, DDS, MS</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {[[<ScanLine size={20} color={G} key="sl" />,"01","3D Digital Scan","Precision optical impressions replace uncomfortable molds. Micron-level accuracy, zero discomfort."],
                  [<Microscope size={20} color={G} key="m" />,"02","CAD/CAM Design","Your restoration designed on-screen in real time. Perfect fit, bite, and occlusion before a single cut."],
                  [<Stethoscope size={20} color={G} key="st" />,"03","In-Office Milling","All-ceramic porcelain milled on-site from a single block. Shade-matched exactly to your smile."]].map(([icon,step,title,desc]) => (
                  <div key={step as string} className="rounded-xl p-6" style={{ background: "white", borderTop: `3px solid ${G}` }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: G, opacity: .35, lineHeight: 1 }}>{step as string}</span>
                      {icon}
                    </div>
                    <h4 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{title as string}</h4>
                    <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.75 }}>{desc as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Services */}
      <RevealSection>
        <section id="services" className="py-20 px-5" style={{ background: "white" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>What We Do</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>Prosthodontic Services</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[["Same-Day CEREC Crowns","Full porcelain crown designed and placed in one visit. No temporaries, no second appointment, no lab wait."],
                ["Dental Implants","Permanent tooth replacement anchored to your jawbone. Coordinated with top surgical specialists for seamless care."],
                ["Bridges & Partials","Custom-crafted prosthetics to restore function and appearance when multiple teeth are missing."],
                ["Complete Dentures","Full-arch restorations engineered for comfort, stability, and a smile that looks completely natural."],
                ["Full-Mouth Rehabilitation","Comprehensive reconstruction combining multiple procedures to fully restore form, function, and confidence."],
                ["Second Opinions","Unsure about your treatment plan? Dr. Stewart provides comprehensive consultations for peace of mind."]].map(([name,desc]) => (
                <div key={name as string} className="p-6 rounded-r-xl" style={{ borderLeft: `4px solid ${G}`, background: C }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", color: G, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>{name as string}</h3>
                  <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.75 }}>{desc as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Doctor */}
      <RevealSection>
        <section id="doctor" className="py-20 px-5" style={{ background: N }}>
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-10 items-start">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80"
                  alt="Dr. Robert Stewart, DDS, MS" className="rounded-xl object-cover"
                  style={{ width: 260, height: 320, border: `3px solid ${G}`, display: "block" }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Meet Your Doctor</p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: G, fontSize: "clamp(28px,4vw,40px)", fontWeight: 400, marginBottom: 4 }}>Dr. Robert Stewart</h2>
                <p className="text-sm mb-8 tracking-wider" style={{ color: "rgba(138,154,181,.55)" }}>DDS, MS — Board-Certified Prosthodontist</p>
                <div className="flex flex-col gap-3 mb-8">
                  {["DDS, University of Michigan School of Dentistry — 1987",
                    "MS in Prosthodontics, Mayo Clinic Graduate School — 1990",
                    "Diplomate, American Board of Prosthodontics — 1995",
                    "14× named Detroit Top Dentist by Hour Detroit Magazine"].map(c => (
                    <div key={c} className="flex gap-3 items-start text-sm" style={{ color: "rgba(200,208,220,.8)" }}>
                      <CheckCircle size={14} color={G} style={{ flexShrink: 0, marginTop: 2 }} /> {c}
                    </div>
                  ))}
                </div>
                <blockquote style={{ borderLeft: `3px solid ${G}`, paddingLeft: 18 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: C, fontSize: 16, lineHeight: 1.7 }}>
                    "We enjoy the challenge of the most complex dental problems. Many patients worry their case is 'the worst.' We are ready for you."
                  </p>
                </blockquote>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection>
        <section className="py-20 px-5" style={{ background: C }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Patient Words</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>What Our Patients Say</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {[["I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment.","C.P., Grosse Pointe Farms"],
                ["Dr. Stewart and his team gave me back the confidence to laugh out loud again. The professionalism, compassion, and care were nothing short of fantastic.","M.Z., St. Clair Shores"],
                ["He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. And his shots don't hurt.","S.R., Detroit"],
                ["Superior service and staff — always accommodating. Staff has consistently been with the practice for many years. I have been a patient for 38 years!","Long-Time Patient"]].map(([q,a]) => (
                <div key={a as string} className="rounded-xl p-6" style={{ background: "white", border: "1px solid rgba(201,168,76,.18)" }}>
                  <div className="flex gap-1 mb-4">{[...Array(5)].map((_,j) => <Star key={j} size={13} fill={G} color={G} />)}</div>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, color: G, lineHeight: 0, display: "block", marginBottom: 16, opacity: .3 }}>❝</span>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: N, lineHeight: 1.8, fontSize: 14, marginBottom: 12 }}>{q as string}</p>
                  <p style={{ color: "#9ca3af", fontSize: 11 }}>— {a as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Form */}
      <RevealSection>
        <section id="appointment" className="py-20 px-5" style={{ background: P }}>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Get Started</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>Schedule Your Visit</h2>
              <p className="mt-2 text-sm" style={{ color: "#6b7280" }}>We'll confirm within one business day.</p>
            </div>
            <form onSubmit={e => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                {field("first","First Name","text")}{field("last","Last Name","text")}
                {field("phone","Phone Number","tel")}{field("email","Email Address","email")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Preferred Day</label>
                  <select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))} className="w-full bg-transparent text-sm outline-none appearance-none"
                    style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N }}>
                    <option value="">Select a day</option>
                    {["Monday","Tuesday","Thursday"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Reason for Visit</label>
                  <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="w-full bg-transparent text-sm outline-none appearance-none"
                    style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N }}>
                    <option value="">Select a reason</option>
                    {["Crown / Same-Day CEREC","Dental Implant Consultation","Bridge or Partial","Complete Dentures","Full-Mouth Rehabilitation","Second Opinion","New Patient Exam"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-10">
                <button type="submit" className="w-full py-4 font-bold text-sm tracking-widest rounded" style={{ background: G, color: N, border: "none", cursor: "pointer", letterSpacing: ".04em" }}>
                  REQUEST MY APPOINTMENT →
                </button>
                <p className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: "#9ca3af" }}>
                  <Lock size={11} /> Your information is private and HIPAA-protected.
                </p>
              </div>
            </form>
          </div>
        </section>
      </RevealSection>

      {/* Footer */}
      <footer style={{ background: N, padding: "64px 20px 32px" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: G }}>
                  <span style={{ color: N, fontSize: 14 }}>✦</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "white", letterSpacing: ".05em" }}>STEWART DENTAL GROUP</span>
              </div>
              <p style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 1.8 }}>Mayo Clinic-trained prosthodontic care serving Grosse Pointe and Detroit for over 36 years.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Contact</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>
                <div className="flex items-start gap-2"><MapPin size={12} color={G} style={{ marginTop: 4, flexShrink: 0 }} />19635 Mack Avenue<br />Grosse Pointe Woods, MI 48236</div>
                <a href="tel:3138828711" style={{ color: G, textDecoration: "none", display: "block", marginTop: 4 }}>(313) 882-8711</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Hours</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>Mon / Tue / Thu 7:30–4:00<br />Wednesday 8:30–12:30<br />Fri – Sun Closed</div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Payment</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>Visa · MasterCard<br />American Express<br />CareCredit®</div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop: "1px solid rgba(201,168,76,.1)" }}>
            <p style={{ color: "rgba(75,85,99,.45)", fontSize: 11 }}>© 2025 Stewart Dental Group. All rights reserved.</p>
            <Link to="/dental-web-design" style={{ color: G, fontSize: 11, textDecoration: "none" }}>Site by Matt Michels Web Design</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
