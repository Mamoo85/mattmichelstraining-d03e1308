import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Shield, Star, Award, CheckCircle, Lock, ScanLine, Microscope, Stethoscope, MapPin, ArrowRight, Menu, X, FileCheck } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const T = "#0d9488";
const DARK = "#0f172a";

export default function DentalMockup() {
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
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif" }}>
      <Helmet>
        <title>Stewart Dental Group — Grosse Pointe Woods Prosthodontist</title>
        <meta name="description" content="Dr. Robert Stewart, Board-Certified Prosthodontist. Same-day CEREC crowns, dental implants, full-mouth rehabilitation. Grosse Pointe Woods, MI." />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8" style={{ background: DARK }}>
          <button onClick={() => setOpen(false)} className="absolute top-5 right-5 p-2" style={{ color:"white", background:"none", border:"none", cursor:"pointer" }}><X size={28} /></button>
          {[["#technology","CEREC Technology"],["#services","Services"],["#doctor","Dr. Stewart"],["#new-patients","Book a Visit"]].map(([h,l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="text-2xl font-semibold tracking-wide"
              style={{ color:"white", textDecoration:"none" }}
              onMouseEnter={e=>(e.currentTarget.style.color=T)} onMouseLeave={e=>(e.currentTarget.style.color="white")}>{l}</a>
          ))}
          <a href="#new-patients" onClick={() => setOpen(false)} className="mt-4 px-10 py-4 font-bold text-sm tracking-wider rounded-lg"
            style={{ background:T, color:"white", textDecoration:"none" }}>SCHEDULE A VISIT</a>
          <a href="tel:3138828711" style={{ color:T, textDecoration:"none", fontSize:14, fontWeight:600 }}>(313) 882-8711</a>
        </div>
      )}

      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background:T, color:"white" }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* Design switcher */}
      <div className="hidden lg:block fixed bottom-5 left-4 z-[150]">
        <div className="rounded-xl text-xs overflow-hidden" style={{ background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", border:"1px solid #e2e8f0", boxShadow:"0 4px 20px rgba(0,0,0,.08)", minWidth:220 }}>
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="font-bold uppercase tracking-widest text-[10px]" style={{ color:T }}>See Other Designs</p>
          </div>
          <div className="p-2 space-y-1">
            {[{to:"/demo-dental",l:"Teal / Clinical",active:true},{to:"/demo-dental-alt1",l:"Prestige (Navy & Gold)"},{to:"/demo-dental-alt2",l:"Nordic Wellness"}].map(d => (
              <Link key={d.to} to={d.to} className="flex items-center gap-2 px-3 py-2 rounded-lg text-left w-full"
                style={{ background:d.active?`rgba(13,148,136,.08)`:"transparent", color:d.active?T:"#94a3b8", textDecoration:"none" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:d.active?T:"#cbd5e1" }} />{d.l}
              </Link>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <a href="tel:3138064952" className="text-[10px] font-semibold text-slate-400">Matt — (313) 806-4952</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 z-[100] flex items-center justify-between px-5 transition-transform duration-300"
        style={{ top:32, height:64, transform:vis?"translateY(0)":"translateY(-100%)", background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", borderBottom:"1px solid #e2e8f0" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:T }}>
            <span style={{ color:"white", fontSize:16 }}>+</span>
          </div>
          <span className="text-sm font-bold tracking-wide" style={{ color:DARK }}>STEWART <span style={{ color:T }}>DENTAL GROUP</span></span>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a href="#new-patients" className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ color:T, border:`1px solid ${T}`, textDecoration:"none" }}>New Patients</a>
          <a href="tel:3138828711" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg" style={{ background:T, color:"white", textDecoration:"none" }}>
            <Phone size={12} /> (313) 882-8711
          </a>
        </div>
        <button className="md:hidden p-2" onClick={() => setOpen(true)} style={{ border:"none", background:"transparent", cursor:"pointer" }}>
          <Menu size={24} color={DARK} />
        </button>
      </header>

      {/* HERO */}
      <section className="relative flex items-center justify-center text-center overflow-hidden min-h-screen" style={{ paddingTop:"calc(32px + 64px)", background:DARK }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage:"url(https://images.unsplash.com/photo-1588776814546-1ffbb1b72cb7?w=1920&q=80)", opacity:.18 }} />
        <div className="absolute inset-0" style={{ background:"linear-gradient(to bottom, rgba(15,23,42,.85), rgba(15,23,42,.95))" }} />
        <div className="relative z-10 max-w-4xl mx-auto px-5 py-24">
          <div className="inline-flex items-center gap-2 rounded-full border mb-8 px-5 py-2 text-xs font-semibold tracking-widest" style={{ borderColor:`rgba(13,148,136,.5)`, color:T }}>
            <Award size={12} /> Board-Certified Prosthodontist · Grosse Pointe Woods
          </div>
          <h1 className="mb-6 font-extrabold tracking-tight" style={{ fontSize:"clamp(40px,7vw,76px)", color:"white", lineHeight:1.1 }}>
            Grosse Pointe's<br />Most Trusted<br /><span style={{ color:T }}>Prosthodontist</span>
          </h1>
          <div className="mx-auto mb-6" style={{ width:48, height:2, background:T }} />
          <p className="mb-10 text-lg max-w-2xl mx-auto" style={{ color:"rgba(148,163,184,.85)", lineHeight:1.75, fontWeight:300 }}>
            Dr. Robert Stewart has been crafting exceptional smiles in Grosse Pointe Woods for over 36 years. Same-day CEREC crowns, dental implants, and full-mouth rehabilitation — no waiting, no compromise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
            <a href="#new-patients" className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm w-full sm:w-auto justify-center" style={{ background:T, color:"white", textDecoration:"none", boxShadow:`0 8px 30px rgba(13,148,136,.3)` }}>
              Schedule Your Visit <ArrowRight size={16} />
            </a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm w-full sm:w-auto justify-center" style={{ border:`2px solid ${T}`, color:T, textDecoration:"none" }}>
              <Phone size={15} /> (313) 882-8711
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {[[<Award size={14} key="a" />,"36+ Years"],[<Star size={14} key="s" />,"14× Top Dentist"],[<CheckCircle size={14} key="c" />,"Mayo Clinic Trained"],[<ScanLine size={14} key="sc" />,"Same-Day Crowns"]].map(([icon,label],i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color:T }}>{icon as React.ReactNode} {label as string}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="py-5 px-5" style={{ background:"white", borderBottom:"1px solid #e2e8f0" }}>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6">
          {[{I:Lock,l:"HIPAA Compliant"},{I:Shield,l:"ADA Guidelines"},{I:FileCheck,l:"Autoclave Sterilized"},{I:CheckCircle,l:"HEPA/ULPA Filtered Air"}].map(({I,l}) => (
            <div key={l} className="flex items-center gap-2 text-xs font-semibold" style={{ color:"#64748b" }}><I size={14} color={T} /> {l}</div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <RevealSection>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ background:"#f0fdfa", borderTop:"1px solid #ccfbf1" }}>
          {[["36+","Years in Practice"],["14×","Detroit Top Dentist"],["Mayo","Clinic Trained"],["1 Visit","CEREC Crowns"]].map(([n,l],i) => (
            <div key={i} className="text-center py-10 px-4">
              <div className="text-4xl font-extrabold mb-1" style={{ color:DARK }}>{n}</div>
              <div className="text-xs uppercase tracking-wider" style={{ color:"#64748b" }}>{l}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* CEREC */}
      <RevealSection>
        <section id="technology" className="py-20 px-5" style={{ background:"white" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color:DARK }}>The Desktop Laboratory</h2>
              <p className="text-base max-w-xl mx-auto" style={{ color:"#64748b" }}>We are the lab. Your crown is 3D-scanned, designed, milled, and bonded — all in a single visit.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="rounded-2xl overflow-hidden" style={{ background:DARK }}>
                <img src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80" alt="CEREC technology" className="w-full object-cover" style={{ height:240 }} />
                <div className="p-8">
                  <div style={{ width:40, height:2, background:T, marginBottom:16 }} />
                  <h3 className="text-xl font-bold mb-4" style={{ color:"white" }}>Your Crown, Built In-Office</h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color:"rgba(148,163,184,.8)" }}>
                    Unlike most offices that ship impressions to an outside lab — a 2-to-3 week wait — we design, mill, and bond your porcelain crown the same day. No temporaries. No second appointment.
                  </p>
                  <blockquote className="pl-4 border-l-2" style={{ borderColor:T }}>
                    <p className="text-sm italic" style={{ color:"rgba(148,163,184,.9)" }}>"We are all about prosthetic dentistry here. We are ready for you." — Dr. Stewart</p>
                  </blockquote>
                </div>
              </div>
              <div className="grid gap-4">
                {[[<ScanLine size={20} color={T} key="sl" />,"3D Digital Scan","Precision optical impressions replace uncomfortable molds. Micron-level accuracy, zero discomfort."],
                  [<Microscope size={20} color={T} key="m" />,"CAD/CAM Design","Your restoration is designed on-screen in real time — perfect fit and bite before milling begins."],
                  [<Stethoscope size={20} color={T} key="st" />,"In-Office Milling","All-ceramic porcelain milled from a single block, shade-matched exactly to your smile."],
                  [<CheckCircle size={20} color={T} key="ck" />,"Same-Day Placement","Crown bonded and polished the same appointment. Leave with your permanent restoration."]].map(([icon,title,desc]) => (
                  <div key={title as string} className="flex gap-4 items-start p-5 rounded-xl" style={{ border:"1px solid #e2e8f0", background:"#f8fafc" }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background:`rgba(13,148,136,.1)` }}>{icon as React.ReactNode}</div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1" style={{ color:DARK }}>{title as string}</h4>
                      <p className="text-xs leading-relaxed" style={{ color:"#64748b" }}>{desc as string}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Services */}
      <RevealSection>
        <section id="services" className="py-20 px-5" style={{ background:"#f8fafc" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color:DARK }}>Our Services</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[["Same-Day CEREC Crowns","3D-scanned, designed, and milled in our in-office lab. One appointment, no temporaries, no lab wait."],
                ["Dental Implants","Permanent tooth replacement anchored to your jawbone. Coordinated with top surgical specialists."],
                ["Bridges & Partials","Precision-fit prosthetics to restore function and confidence when multiple teeth are missing."],
                ["Complete Dentures","Full-arch restorations engineered for natural appearance, comfort, and stability."],
                ["Full-Mouth Rehabilitation","Comprehensive reconstruction combining multiple procedures to fully restore your smile."],
                ["Second Opinions","Unsure about a treatment plan? Dr. Stewart provides thorough consultations for peace of mind."]].map(([n,d]) => (
                <div key={n as string} className="flex items-start gap-4 p-6 rounded-xl" style={{ background:"white", border:"1px solid #e2e8f0" }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background:T }} />
                  <div>
                    <h3 className="font-bold text-sm mb-2" style={{ color:DARK }}>{n as string}</h3>
                    <p className="text-xs leading-relaxed" style={{ color:"#64748b" }}>{d as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Doctor */}
      <RevealSection>
        <section id="doctor" className="py-20 px-5" style={{ background:"white" }}>
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-shrink-0">
              <img src="/images/dr-stewart.jpg"
                alt="Dr. Robert Stewart, DDS, MS"
                className="rounded-2xl object-cover"
                style={{ width:220, height:280, border:`3px solid ${T}`, display:"block" }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:T }}>Meet Your Doctor</p>
              <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color:DARK }}>Dr. Robert Stewart, DDS, MS</h2>
              <p className="text-sm mb-6" style={{ color:T }}>Board-Certified Prosthodontist</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                {["DDS, University of Michigan — 1987","MS Prosthodontics, Mayo Clinic — 1990","American Board of Prosthodontics — 1995","14× Detroit Top Dentist"].map(c => (
                  <div key={c} className="flex items-center gap-2 text-sm" style={{ color:"#475569" }}>
                    <CheckCircle size={14} color={T} /> {c}
                  </div>
                ))}
              </div>
              <blockquote className="p-4 rounded-xl text-sm italic leading-relaxed" style={{ background:"#f0fdfa", borderLeft:`3px solid ${T}`, color:DARK }}>
                "We enjoy the challenge of the most complex dental problems. Many patients worry their case is 'the worst.' <strong style={{ color:T }}>We are ready for you.</strong>"
              </blockquote>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection>
        <section className="py-20 px-5" style={{ background:"#f0fdfa" }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-14" style={{ color:DARK }}>Patient Testimonials</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[["I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment.","C.P., Grosse Pointe Farms"],
                ["Dr. Stewart and his team gave me back the confidence to laugh out loud again. The professionalism, compassion and care were nothing short of fantastic.","M.Z., St. Clair Shores"],
                ["He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. And his shots don't hurt.","S.R., Detroit"],
                ["Superior service and staff — always accommodating. Staff has consistently been with the practice for many years. I have been a patient for 38 years!","Long-Time Patient"]].map(([q,a]) => (
                <div key={a as string} className="p-6 rounded-xl" style={{ background:"white", border:"1px solid #ccfbf1" }}>
                  <div className="flex gap-1 mb-3">{[...Array(5)].map((_,i)=><Star key={i} size={13} fill={T} color={T} />)}</div>
                  <p className="text-sm italic leading-relaxed mb-3" style={{ color:"#475569" }}>"{q as string}"</p>
                  <p className="text-xs font-semibold" style={{ color:"#94a3b8" }}>{a as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* New patients / form */}
      <section id="new-patients" className="py-20 px-5" style={{ background:DARK }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">New Patients Welcome</h2>
            <p className="text-sm mb-6" style={{ color:"#64748b" }}>We look forward to meeting you. All information is transmitted securely per HIPAA standards.</p>
            <form onSubmit={e=>e.preventDefault()} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[["First Name","text","first"],["Last Name","text","last"]].map(([label,type,key]) => (
                  <div key={key as string}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:"#64748b" }}>{label as string}</label>
                    <input type={type as string} value={form[key as keyof typeof form]} onChange={e=>setForm(p=>({...p,[key as string]:e.target.value}))}
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                      style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", color:"white" }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["Phone","tel","phone"],["Email","email","email"]].map(([label,type,key]) => (
                  <div key={key as string}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:"#64748b" }}>{label as string}</label>
                    <input type={type as string} value={form[key as keyof typeof form]} onChange={e=>setForm(p=>({...p,[key as string]:e.target.value}))}
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                      style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", color:"white" }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:"#64748b" }}>Preferred Day</label>
                <select value={form.day} onChange={e=>setForm(p=>({...p,day:e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", color:"#94a3b8" }}>
                  <option value="">Select a day</option>
                  {["Monday","Tuesday","Thursday"].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:"#64748b" }}>Reason for Visit</label>
                <select value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", color:"#94a3b8" }}>
                  <option value="">Select reason</option>
                  {["Crown / Same-Day CEREC","Dental Implant Consultation","Bridge or Partial","Complete Dentures","Full-Mouth Rehabilitation","Second Opinion","New Patient Exam"].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-widest" style={{ background:T, color:"white", border:"none", cursor:"pointer" }}>
                Request Appointment
              </button>
            </form>
            <div className="flex items-center gap-2 text-xs mt-3" style={{ color:"#475569" }}>
              <Lock size={12} color={T} /> All forms are HIPAA-compliant and securely encrypted.
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Contact</h3>
              <p className="text-sm flex items-start gap-2" style={{ color:"#64748b" }}><MapPin size={14} color={T} style={{ flexShrink:0, marginTop:2 }} />19635 Mack Avenue, Grosse Pointe Woods, MI 48236</p>
              <a href="tel:3138828711" className="text-sm font-bold mt-2 flex items-center gap-2" style={{ color:T, textDecoration:"none" }}><Phone size={14} /> (313) 882-8711</a>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Office Hours</h3>
              <div className="space-y-1">
                {[["Monday","7:30 AM – 4:00 PM"],["Tuesday","7:30 AM – 4:00 PM"],["Wednesday","8:30 AM – 12:30 PM"],["Thursday","7:30 AM – 4:00 PM"],["Fri – Sun","Closed"]].map(([d,t]) => (
                  <div key={d} className="flex justify-between text-sm" style={{ color:"#64748b" }}>
                    <span>{d}</span><span className="text-white font-medium">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Payment</h3>
              <p className="text-sm" style={{ color:"#64748b" }}>Visa, MasterCard, American Express</p>
              <p className="text-sm mt-1" style={{ color:"#64748b" }}>CareCredit® financing available</p>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between gap-4 pt-10 mt-10" style={{ borderTop:"1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color:"#475569" }}>© 2025 Stewart Dental Group. All rights reserved.</p>
          <Link to="/dental-web-design" className="text-xs" style={{ color:T, textDecoration:"none" }}>Site by Matt Michels Web Design</Link>
        </div>
      </section>
    </div>
  );
}
