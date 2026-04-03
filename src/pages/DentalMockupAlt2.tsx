import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Shield, Star, Award, CheckCircle, Lock, ScanLine, Microscope, Stethoscope, MapPin, ArrowRight, Menu, X } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const S = "#4A7B6F";
const D = "#2C3A32";
const I = "#FAFAF7";
const SL = "#EEF4F2";

export default function DentalMockupAlt2() {
  const [vis, setVis] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first:"", last:"", phone:"", email:"", day:"", reason:"" });

  useEffect(() => {
    const fn = () => { const y = window.scrollY; setVis(y < 80 || y < lastY); setLastY(y); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [lastY]);

  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  return (
    <>
      <Helmet>
        <title>Stewart Dental Group — Grosse Pointe Woods Prosthodontist</title>
        <meta name="description" content="Dr. Robert Stewart, Board-Certified Prosthodontist. Same-day CEREC crowns, dental implants, full-mouth rehabilitation. Grosse Pointe Woods, MI." />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8" style={{ background:D }}>
          <button onClick={() => setOpen(false)} className="absolute top-5 right-5 p-2" style={{ color:"white", background:"none", border:"none", cursor:"pointer" }}><X size={28} /></button>
          {[["#cerec","CEREC Technology"],["#services","Services"],["#doctor","Dr. Stewart"],["#appointment","Book a Visit"]].map(([h,l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="text-3xl font-light"
              style={{ fontFamily:"'DM Serif Display', serif", color:"white", textDecoration:"none" }}
              onMouseEnter={e=>(e.currentTarget.style.color=S)} onMouseLeave={e=>(e.currentTarget.style.color="white")}>{l}</a>
          ))}
          <a href="#appointment" onClick={() => setOpen(false)} className="mt-4 px-10 py-4 font-semibold text-sm tracking-wider rounded"
            style={{ background:S, color:"white", textDecoration:"none" }}>Book a Visit</a>
          <a href="tel:3138828711" style={{ color:S, textDecoration:"none", fontSize:14, fontWeight:500 }}>(313) 882-8711</a>
        </div>
      )}

      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background:S, color:"white" }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* Design switcher */}
      <div className="hidden lg:block fixed bottom-5 left-5 z-[150] text-xs" style={{ background:"white", border:`1.5px solid ${S}`, borderRadius:10, padding:"12px 16px", boxShadow:"0 4px 20px rgba(0,0,0,.08)", fontFamily:"Inter, sans-serif" }}>
        <div className="font-bold mb-2" style={{ fontSize:10, letterSpacing:".1em", color:D }}>DESIGN OPTIONS</div>
        <Link to="/demo-dental" style={{ display:"block", color:"#888", marginBottom:4, textDecoration:"none" }}>Teal / Clinical</Link>
        <Link to="/demo-dental-alt1" style={{ display:"block", color:"#888", marginBottom:4, textDecoration:"none" }}>Prestige (Navy & Gold)</Link>
        <div style={{ display:"flex", alignItems:"center", gap:5, color:S, fontWeight:700 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:S, display:"inline-block" }} /> Nordic Wellness (Current)
        </div>
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 z-[100] transition-transform duration-300"
        style={{ top:32, transform:vis?"translateY(0)":"translateY(-100%)", background:"rgba(250,250,247,.97)", backdropFilter:"blur(12px)", borderBottom:`1px solid rgba(74,123,111,.2)` }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div style={{ fontFamily:"'DM Serif Display', serif", fontSize:16, color:D, letterSpacing:".02em" }}>
            Stewart <span style={{ color:S }}>Dental Group</span>
          </div>
          <nav className="hidden md:flex items-center gap-3">
            <a href="#appointment" className="px-4 py-2 rounded text-sm font-medium" style={{ border:`1px solid ${S}`, color:S, textDecoration:"none" }}>New Patients</a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold" style={{ background:S, color:"white", textDecoration:"none" }}>
              <Phone size={13} /> (313) 882-8711
            </a>
          </nav>
          <button className="md:hidden p-2" onClick={() => setOpen(true)} style={{ border:"none", background:"transparent", cursor:"pointer" }}>
            <Menu size={24} color={D} />
          </button>
        </div>
      </header>

      {/* HERO — split layout */}
      <section className="min-h-screen flex flex-col md:flex-row" style={{ paddingTop:"calc(32px + 64px)" }}>
        {/* Left */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-20" style={{ background:I }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:S }}>Board-Certified Prosthodontist</p>
          <h1 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(42px,5vw,68px)", color:D, lineHeight:1.1, marginBottom:20 }}>
            Precision Care.<br /><span style={{ color:S }}>Your Smile.</span>
          </h1>
          <div style={{ width:48, height:2, background:S, marginBottom:24 }} />
          <p className="text-base mb-8 font-light leading-relaxed max-w-md" style={{ color:"#6B7C74" }}>
            Dr. Robert Stewart has dedicated 36 years to the art and science of prosthodontics in Grosse Pointe Woods — same-day CEREC crowns, implants, and full-mouth rehabilitation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <a href="#appointment" className="flex items-center gap-2 px-7 py-4 rounded font-semibold text-sm w-full sm:w-auto justify-center" style={{ background:S, color:"white", textDecoration:"none" }}>
              Book a Visit <ArrowRight size={16} />
            </a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-7 py-4 rounded font-medium text-sm w-full sm:w-auto justify-center" style={{ border:`1.5px solid ${S}`, color:S, textDecoration:"none" }}>
              <Phone size={14} /> Call the Office
            </a>
          </div>
          <div className="flex flex-wrap gap-5">
            {["36+ Years","Mayo Clinic","Same-Day CEREC","14× Top Dentist"].map(l => (
              <div key={l} className="flex items-center gap-2 text-xs font-medium" style={{ color:S }}>
                <CheckCircle size={13} /> {l}
              </div>
            ))}
          </div>
        </div>
        {/* Right image */}
        <div className="w-full md:w-2/5 flex-shrink-0 min-h-72 md:min-h-0">
          <img src="https://images.unsplash.com/photo-1588776814546-1ffbb1b72cb7?w=1200&q=80"
            alt="Modern dental practice"
            className="w-full h-full object-cover" style={{ minHeight:320 }} />
        </div>
      </section>

      {/* Philosophy quote */}
      <RevealSection>
        <div className="py-16 px-5" style={{ background:I }}>
          <div className="max-w-3xl mx-auto text-center">
            <div style={{ width:40, height:2, background:S, margin:"0 auto 28px" }} />
            <p style={{ fontFamily:"'DM Serif Display', serif", fontStyle:"italic", fontSize:"clamp(18px,2.5vw,24px)", color:D, lineHeight:1.65 }}>
              "We enjoy the challenge of the most complex dental problems. Many patients worry their case is 'the worst.' We are ready for you."
            </p>
            <p className="mt-5 text-sm font-medium" style={{ color:S }}>— Dr. Robert Stewart, DDS, MS</p>
            <div style={{ width:40, height:2, background:S, margin:"28px auto 0" }} />
          </div>
        </div>
      </RevealSection>

      {/* Stats */}
      <RevealSection>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ background:SL }}>
          {[["36+","Years in Practice"],["14×","Top Dentist Award"],["Mayo","Clinic Training"],["1 Visit","Crown Placement"]].map(([n,l],idx) => (
            <div key={idx} className="text-center py-10 px-4" style={{ borderRight:idx<3?"1px solid rgba(74,123,111,.15)":"none" }}>
              <div style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(36px,4vw,48px)", color:S }}>{n}</div>
              <div className="text-xs uppercase tracking-wider mt-2 font-medium" style={{ color:"#6B7C74" }}>{l}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* CEREC */}
      <RevealSection>
        <section id="cerec" className="py-20 px-5" style={{ background:I }}>
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:S }}>CEREC Technology</p>
              <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(28px,4vw,44px)", color:D, marginBottom:20 }}>Built in our office.<br />Ready the same day.</h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color:"#6B7C74" }}>
                Our CEREC system is a complete dental laboratory inside our practice. Unlike offices that outsource to labs — a 2–3 week wait — we design, mill, and bond your porcelain crown the same day. No temporaries. No second appointment.
              </p>
              <div className="space-y-5">
                {[[<ScanLine size={16} color={S} key="sl" />,"3D Digital Scan","Precision optical impressions. No trays, no mess, no discomfort."],
                  [<Microscope size={16} color={S} key="m" />,"CAD/CAM Design","Real-time restoration design with perfect fit and occlusion."],
                  [<Stethoscope size={16} color={S} key="st" />,"In-Office Milling","All-ceramic porcelain, shade-matched, bonded same visit."]].map(([icon,title,desc]) => (
                  <div key={title as string} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background:SL }}>{icon as React.ReactNode}</div>
                    <div>
                      <p className="font-semibold text-sm mb-1" style={{ color:D }}>{title as string}</p>
                      <p className="text-xs leading-relaxed" style={{ color:"#6B7C74" }}>{desc as string}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border:`2px solid rgba(74,123,111,.2)` }}>
              <img src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80" alt="CEREC technology" className="w-full object-cover" style={{ height:400 }} />
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Services */}
      <RevealSection>
        <section id="services" className="py-20 px-5" style={{ background:D }}>
          <div className="max-w-6xl mx-auto">
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(28px,4vw,44px)", color:"white", marginBottom:48, textAlign:"center" }}>Our Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[["Same-Day CEREC Crowns","One appointment. No temporaries. No lab wait. Your permanent porcelain crown, built here."],
                ["Dental Implants","Permanent tooth replacement, coordinated with top surgical specialists for seamless care."],
                ["Bridges & Partials","Custom-crafted prosthetics to restore function and appearance when multiple teeth are missing."],
                ["Complete Dentures","Full-arch restorations engineered for comfort, stability, and a completely natural-looking smile."],
                ["Full-Mouth Rehabilitation","Comprehensive reconstruction to fully restore form, function, and confidence."],
                ["Second Opinions","Thorough consultations for patients uncertain about their proposed treatment plan."]].map(([n,d]) => (
                <div key={n as string} className="p-6 rounded" style={{ borderLeft:`3px solid ${S}`, background:"rgba(255,255,255,.04)" }}>
                  <h3 style={{ fontFamily:"'DM Serif Display', serif", color:S, fontSize:18, marginBottom:8 }}>{n as string}</h3>
                  <p className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.55)" }}>{d as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Doctor */}
      <RevealSection>
        <section id="doctor" className="py-20 px-5" style={{ background:I }}>
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-start">
            <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80"
              alt="Dr. Robert Stewart" className="object-cover rounded flex-shrink-0 mx-auto md:mx-0"
              style={{ width:240, height:300, border:`2px solid rgba(74,123,111,.3)` }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:S }}>Meet Your Doctor</p>
              <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(26px,3.5vw,38px)", color:D, marginBottom:4 }}>Dr. Robert Stewart</h2>
              <p className="text-sm mb-6 font-medium" style={{ color:S }}>DDS, MS — Board-Certified Prosthodontist</p>
              <div className="space-y-2 mb-6">
                {["DDS, University of Michigan — 1987","MS Prosthodontics, Mayo Clinic — 1990","American Board of Prosthodontics — 1995","14× Detroit Top Dentist"].map(c => (
                  <div key={c} className="flex items-center gap-2 text-sm" style={{ color:"#6B7C74" }}>
                    <CheckCircle size={13} color={S} /> {c}
                  </div>
                ))}
              </div>
              <blockquote className="p-5 rounded" style={{ background:SL, borderLeft:`3px solid ${S}` }}>
                <p style={{ fontFamily:"'DM Serif Display', serif", fontStyle:"italic", color:D, fontSize:16, lineHeight:1.65 }}>
                  "We enjoy the challenge of the most complex dental problems. We are ready for you."
                </p>
              </blockquote>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection>
        <section className="py-20 px-5" style={{ background:SL }}>
          <div className="max-w-6xl mx-auto">
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(28px,4vw,40px)", color:D, textAlign:"center", marginBottom:48 }}>Patient Stories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[["I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment.","C.P., Grosse Pointe Farms"],
                ["Dr. Stewart and his team gave me back the confidence to laugh out loud again. Professionalism, compassion and care — nothing short of fantastic.","M.Z., St. Clair Shores"],
                ["He combines skill, artistry, and personality to create a pleasant experience that yields great results. His shots don't hurt either.","S.R., Detroit"],
                ["Superior service and staff — always accommodating. I have been a patient for 38 years!","Long-Time Patient"]].map(([q,a]) => (
                <div key={a as string} className="p-6 rounded-xl" style={{ background:"white" }}>
                  <div className="flex gap-1 mb-4">{[...Array(5)].map((_,j)=><Star key={j} size={13} fill={S} color={S} />)}</div>
                  <p style={{ fontFamily:"'DM Serif Display', serif", fontStyle:"italic", color:D, lineHeight:1.75, fontSize:15, marginBottom:12 }}>{q as string}</p>
                  <p className="text-xs" style={{ color:"#9ca3af" }}>— {a as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Form */}
      <RevealSection>
        <section id="appointment" className="py-20 px-5" style={{ background:I }}>
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:S }}>Get Started</p>
              <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(28px,4vw,40px)", color:D }}>Schedule Your Visit</h2>
              <p className="mt-2 text-sm" style={{ color:"#6B7C74" }}>We'll confirm within one business day.</p>
            </div>
            <form onSubmit={e=>e.preventDefault()} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[["first","First Name","text"],["last","Last Name","text"],["phone","Phone","tel"],["email","Email","email"]].map(([k,l,t]) => (
                  <div key={k as string}>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color:S }}>{l as string}</label>
                    <input type={t as string} value={form[k as keyof typeof form]} onChange={e=>setForm(p=>({...p,[k as string]:e.target.value}))}
                      className="w-full bg-transparent text-sm outline-none"
                      style={{ borderBottom:`1.5px solid rgba(74,123,111,.35)`, padding:"8px 0", color:D }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color:S }}>Preferred Day</label>
                <select value={form.day} onChange={e=>setForm(p=>({...p,day:e.target.value}))} className="w-full bg-transparent text-sm outline-none appearance-none" style={{ borderBottom:`1.5px solid rgba(74,123,111,.35)`, padding:"8px 0", color:D }}>
                  <option value="">Select a day</option>
                  {["Monday","Tuesday","Thursday"].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color:S }}>Reason for Visit</label>
                <select value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} className="w-full bg-transparent text-sm outline-none appearance-none" style={{ borderBottom:`1.5px solid rgba(74,123,111,.35)`, padding:"8px 0", color:D }}>
                  <option value="">Select a reason</option>
                  {["Crown / Same-Day CEREC","Dental Implant Consultation","Bridge or Partial","Complete Dentures","Full-Mouth Rehabilitation","Second Opinion","New Patient Exam"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-4 font-semibold text-sm tracking-wider rounded" style={{ background:S, color:"white", border:"none", cursor:"pointer" }}>
                Request My Appointment →
              </button>
              <p className="flex items-center justify-center gap-2 text-xs" style={{ color:"#9ca3af" }}>
                <Lock size={11} /> Your information is HIPAA-protected.
              </p>
            </form>
          </div>
        </section>
      </RevealSection>

      {/* Footer */}
      <footer style={{ background:D, padding:"60px 20px 32px" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div>
              <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:16, color:"white", marginBottom:12 }}>Stewart Dental Group</p>
              <p className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.45)" }}>Mayo Clinic-trained prosthodontic care in Grosse Pointe Woods for over 36 years.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:S }}>Contact</h4>
              <div className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.45)" }}>
                <div className="flex items-start gap-2 mb-2"><MapPin size={12} color={S} style={{ marginTop:2, flexShrink:0 }} />19635 Mack Ave, Grosse Pointe Woods, MI</div>
                <a href="tel:3138828711" style={{ color:S, textDecoration:"none" }}>(313) 882-8711</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:S }}>Hours</h4>
              <div className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.45)" }}>Mon/Tue/Thu 7:30–4:00<br />Wed 8:30–12:30<br />Fri–Sun Closed</div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:S }}>Payment</h4>
              <div className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.45)" }}>Visa · MasterCard<br />AmEx · CareCredit®</div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop:"1px solid rgba(255,255,255,.08)" }}>
            <p className="text-xs" style={{ color:"rgba(255,255,255,.25)" }}>© 2025 Stewart Dental Group. All rights reserved.</p>
            <Link to="/dental-web-design" className="text-xs" style={{ color:S, textDecoration:"none" }}>Site by Matt Michels Web Design</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
