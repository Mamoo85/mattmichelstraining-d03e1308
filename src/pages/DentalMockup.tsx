import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Shield, Star, Award, Clock, CheckCircle, Lock, Smile, ScanLine, Microscope, Stethoscope, User, MapPin, FileCheck } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1600&q=80";
const BRAND = "Stewart Dental Group";
const DOCTOR = "Robert Stewart, DDS, MS";
const PHONE = "(313) 882-8711";
const ADDRESS = "19635 Mack Avenue, Grosse Pointe Woods, MI 48236";
const TEAL = "#0d9488";

const services = [
  { title: "Same-Day CEREC Crowns", desc: "3D-scanned, CAD-designed, and milled in our desktop lab while you relax—no impressions, no temporaries, one appointment.", Icon: ScanLine, color: TEAL },
  { title: "Dental Implants", desc: "Titanium roots that outlast natural tooth restorations. From single teeth to full-arch rehabilitation, coordinated with top surgical specialists.", Icon: Microscope, color: "#2563eb" },
  { title: "Bridges & Partials", desc: "When implants aren't an option, precision-fit bridges and removable partials restore function and confidence.", Icon: Smile, color: "#7c3aed" },
  { title: "Complete Dentures", desc: "Custom-crafted for natural appearance and comfort. Implant-supported options available for superior stability.", Icon: Stethoscope, color: "#db2777" },
];

const stats = [
  { value: "36+", label: "Years in Practice", Icon: Award },
  { value: "14x", label: "Detroit Top Dentist", Icon: Star },
  { value: "Mayo", label: "Clinic Trained", Icon: CheckCircle },
  { value: "1", label: "Visit Crowns", Icon: Clock },
];

const technology = [
  { title: "3D Digital Scanner", desc: "Precision imaging replaces messy impressions — micron-level accuracy." },
  { title: "CAD/CAM Design", desc: "Your restoration designed on-screen in real time. You watch the process." },
  { title: "In-Office Milling", desc: "Diamond-bur milling from ceramic blocks — custom shade-matched in our furnace." },
  { title: "CEREC Since 2005", desc: "Ongoing clinical research project — data shared with dental colleagues nationwide." },
];

const credentials = [
  "Board-Certified Prosthodontist",
  "University of Michigan — DDS, 1987",
  "Mayo Clinic — MS Prosthodontics, 1990",
  "American Board of Prosthodontists — 1995",
  "Detroit Monthly Top Dentist — 14 Years",
  "Styleline Magazine Top Dentist — 10 Years",
];

const testimonials = [
  { text: "I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment. His office presents a pleasant upscale atmosphere, consistent staff, and state-of-the-art equipment.", attr: "— C.P., Grosse Pointe Farms" },
  { text: "Dr. Stewart and his team gave me back the confidence to laugh out loud again and unconsciously smile at every opportunity. The professionalism, compassion and care were nothing short of fantastic.", attr: "— M.Z., St. Clair Shores" },
  { text: "He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. And to top it all off, his shots don't hurt. He is the best dentist I have ever had.", attr: "— S.R., Detroit" },
  { text: "Superior service and staff — always accommodating. Staff has consistently been with the practice for many years, which speaks volumes. I have been a patient for 38 years!", attr: "— Patient of Record" },
];

const hours = [
  { day: "Monday", time: "7:30 AM – 4:00 PM" },
  { day: "Tuesday", time: "7:30 AM – 4:00 PM" },
  { day: "Wednesday", time: "8:30 AM – 12:30 PM" },
  { day: "Thursday", time: "7:30 AM – 4:00 PM" },
  { day: "Fri – Sun", time: "Closed" },
];

const compliance = [
  { Icon: Lock, label: "HIPAA Compliant" },
  { Icon: Shield, label: "ADA Guidelines" },
  { Icon: FileCheck, label: "Autoclave Sterilized" },
  { Icon: CheckCircle, label: "HEPA/ULPA Filtered Air" },
];

const DentalMockup = () => {
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b", background: "#fff" }}>
      <style>{`
        @keyframes tooth-shine { 0%,100%{opacity:.08;transform:translateX(-100%)} 50%{opacity:.2;transform:translateX(100%)} }
        .dental-shine { position:absolute; top:0; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(13,148,136,.15),transparent); animation: tooth-shine 4s ease-in-out infinite; pointer-events:none; }
      `}</style>

      <Helmet>
        <title>Stewart Dental Group Redesign Concept | M² Web Design Detroit</title>
        <meta name="description" content="See how Stewart Dental Group's website could look when redesigned by M² Web Design. Premium prosthodontic practice in Grosse Pointe Woods — HIPAA-compliant, modern design." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-dental" />
        <meta property="og:title" content="Stewart Dental Group Redesign | M² Web Design Detroit" />
        <meta property="og:description" content="Professional dental website redesign concept by M² Web Design. CEREC technology showcase, patient trust signals, HIPAA-aware design." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-dental" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Stewart Dental Group Redesign Concept",
          "description": "Demo dental website redesign for Stewart Dental Group by M² Web Design.",
          "url": "https://www.mattmichelstraining.com/demo-dental",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: TEAL, color: "#fff" }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/dental-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Alt Design Switcher */}
      <div className="fixed bottom-5 left-4 z-[60] hidden lg:block">
        <div className="rounded-xl overflow-hidden text-xs" style={{ background: "rgba(255,255,255,.97)", backdropFilter: "blur(12px)", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,.08)", minWidth: 210 }}>
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="font-bold uppercase tracking-widest text-[10px]" style={{ color: TEAL }}>See Other Designs</p>
          </div>
          <div className="p-2 space-y-1">
            {[
              { to: "/demo-dental", label: "Teal / Clinical — Current", active: true },
              { to: "/demo-dental-alt1", label: "Prestige (Navy & Gold)" },
              { to: "/demo-dental-alt2", label: "Nordic Wellness (Minimal)" },
            ].map(d => (
              <Link
                key={d.to}
                to={d.to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full text-left"
                style={{ background: d.active ? `rgba(13,148,136,.08)` : "transparent", color: d.active ? TEAL : "#94a3b8" }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.active ? TEAL : "#cbd5e1" }} />
                {d.label}
              </Link>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <a href="tel:3138064952" className="text-[10px] font-semibold text-slate-400">Matt — (313) 806-4952</a>
          </div>
        </div>
      </div>

      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 transition-transform duration-300"
        style={{
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(255,255,255,.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0"
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: TEAL }}>
            <Smile size={16} color="#fff" />
          </div>
          <span className="text-sm font-bold tracking-wide" style={{ color: "#0f172a" }}>
            STEWART <span style={{ color: TEAL }}>DENTAL GROUP</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#new-patients" className="hidden md:inline-block text-xs font-semibold px-4 py-2 rounded-lg" style={{ color: TEAL, border: `1px solid ${TEAL}` }}>
            New Patients
          </a>
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg" style={{ background: TEAL, color: "#fff" }}>
            <Phone size={12} /> {PHONE}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden" style={{ minHeight: "92vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Modern dental operatory" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,.82), rgba(255,255,255,.96))" }} />
        </div>
        <div className="dental-shine" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(13,148,136,.08)", color: TEAL, border: "1px solid rgba(13,148,136,.2)" }}>
            <Award size={14} /> Board-Certified Prosthodontist
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-3" style={{ color: "#0f172a" }}>
            Stewart<br /><span style={{ color: TEAL }}>Dental Group</span>
          </h1>
          <p className="text-lg md:text-xl mb-3" style={{ color: "#64748b" }}>
            Robert Stewart, DDS, MS — Prosthodontics
          </p>
          <div className="w-16 h-px mx-auto my-6" style={{ background: TEAL }} />
          <p className="text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: "#475569" }}>
            Advanced restorative dentistry with an in-office CAD/CAM laboratory. Same-day crowns, implants, and full-mouth rehabilitation — right here in Grosse Pointe Woods.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#new-patients" className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl transition-transform hover:scale-105" style={{ background: TEAL, color: "#fff", boxShadow: "0 8px 30px rgba(13,148,136,.25)" }}>
              <Smile size={18} /> Schedule Your Visit
            </a>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl" style={{ color: TEAL, border: `2px solid ${TEAL}` }}>
              <Phone size={18} /> {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <RevealSection className="py-12 px-6" style={{ background: "#f0fdfa", borderTop: "1px solid #ccfbf1" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <s.Icon size={20} className="mx-auto mb-2" style={{ color: TEAL }} />
              <div className="text-2xl md:text-3xl font-extrabold" style={{ color: "#0f172a" }}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* HIPAA / Safety Compliance */}
      <div className="py-6 px-6" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-5">
          {compliance.map(c => (
            <span key={c.label} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              <c.Icon size={14} style={{ color: TEAL }} /> {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Desktop Laboratory / Technology */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3" style={{ color: "#0f172a" }}>The Desktop Laboratory</h2>
          <p className="text-center text-base mb-14 max-w-2xl mx-auto" style={{ color: "#64748b" }}>
            We are the lab. Your crown is 3D-scanned, designed, milled, shade-matched, and bonded — all in a single visit.
          </p>
          <div className="grid md:grid-cols-4 gap-6">
            {technology.map((t, i) => (
              <div key={t.title} className="relative rounded-xl p-6 text-center transition-shadow hover:shadow-lg" style={{ background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
                <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-extrabold" style={{ background: TEAL, color: "#fff" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: "#0f172a" }}>{t.title}</h3>
                <p className="text-xs" style={{ color: "#64748b" }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: "#0f172a" }}>Our Services</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {services.map(s => (
              <div key={s.title} className="group flex items-start gap-5 rounded-xl p-6 md:p-8 transition-shadow hover:shadow-lg" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                <div className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <s.Icon size={26} style={{ color: s.color }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "#0f172a" }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Doctor Profile */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-shrink-0 w-40 h-40 rounded-full overflow-hidden" style={{ border: `3px solid ${TEAL}` }}>
            <img src="/images/dental-doctor.jpg" alt="Dr. Robert Stewart, DDS, MS" className="w-full h-full object-cover" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: "#0f172a" }}>{DOCTOR}</h2>
            <p className="text-sm mb-6" style={{ color: TEAL }}>Board-Certified Prosthodontist</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {credentials.map(c => (
                <div key={c} className="flex items-center gap-2 text-sm" style={{ color: "#475569" }}>
                  <CheckCircle size={14} style={{ color: TEAL }} /> {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Quote */}
      <RevealSection className="py-16 px-6" style={{ background: "#f0fdfa" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-px mx-auto mb-8" style={{ background: TEAL }} />
          <blockquote className="text-xl md:text-2xl italic leading-relaxed mb-4" style={{ color: "#0f172a" }}>
            "We are all about prosthetic dentistry here. We enjoy the challenge of the most complex dental problems — many patients worry their case is 'the worst.' <span className="not-italic font-bold" style={{ color: TEAL }}>We are ready for you.</span>"
          </blockquote>
          <p className="text-sm" style={{ color: "#64748b" }}>— Dr. Robert Stewart</p>
          <div className="w-16 h-px mx-auto mt-8" style={{ background: TEAL }} />
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14" style={{ color: "#0f172a" }}>Patient Testimonials</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-8" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={TEAL} color={TEAL} />)}
                </div>
                <p className="italic text-sm leading-relaxed mb-4" style={{ color: "#475569" }}>"{t.text}"</p>
                <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Patient Privacy & Safety */}
      <RevealSection className="py-16 px-6" style={{ background: "#f0fdfa" }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Lock size={24} style={{ color: TEAL }} />
            <h2 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Patient Privacy & Safety</h2>
          </div>
          <p className="text-center text-sm mb-8 max-w-2xl mx-auto" style={{ color: "#64748b" }}>
            Your health information is protected by strict HIPAA protocols. Our facility exceeds ADA infection control standards with multi-layer air filtration (HEPA + ULPA), autoclave instrument sterilization, treated water lines, and disposable barrier protection on every surface.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "HIPAA Compliant", desc: "All records encrypted & protected" },
              { label: "Autoclave Sterilized", desc: "Every instrument, every patient" },
              { label: "HEPA + ULPA Air", desc: "Medical-grade filtration in every room" },
              { label: "Treated Water Lines", desc: "Bacteria-free dental unit water" },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-5 text-center" style={{ background: "#fff", border: "1px solid #ccfbf1" }}>
                <Shield size={20} className="mx-auto mb-2" style={{ color: TEAL }} />
                <h3 className="text-xs font-bold mb-1" style={{ color: "#0f172a" }}>{item.label}</h3>
                <p className="text-[11px]" style={{ color: "#94a3b8" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* New Patient + Contact Footer */}
      <footer id="new-patients" className="py-20 px-6" style={{ background: "#0f172a", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">New Patients Welcome</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>
              We look forward to meeting you. Patient forms can be completed online or downloaded and brought to your first appointment. All information is transmitted securely per HIPAA standards.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>First Name</label>
                  <input type="text" placeholder="Jane" className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Last Name</label>
                  <input type="text" placeholder="Smith" className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Phone</label>
                  <input type="tel" placeholder="(313) 555-0100" className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Email</label>
                  <input type="email" placeholder="jane@email.com" className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Preferred Day</label>
                <select className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#94a3b8" }}>
                  <option value="">Select a day</option>
                  {["Monday", "Tuesday", "Thursday"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Reason for Visit</label>
                <select className="w-full rounded-lg px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#94a3b8" }}>
                  <option value="">Select reason</option>
                  {["Crown / Same-Day CEREC", "Dental Implant Consultation", "Bridge or Partial", "Complete Dentures", "Full-Mouth Rehabilitation", "Second Opinion", "New Patient Exam"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-90" style={{ background: TEAL, color: "#fff" }}>
                Request Appointment
              </button>
            </form>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#475569" }}>
              <Lock size={12} style={{ color: TEAL }} /> All forms are HIPAA-compliant and securely encrypted.
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Contact</h3>
              <p className="text-sm flex items-center gap-2"><MapPin size={14} style={{ color: TEAL }} /> {ADDRESS}</p>
              <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="text-sm font-bold mt-2 inline-flex items-center gap-2" style={{ color: TEAL }}>
                <Phone size={14} /> {PHONE}
              </a>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Office Hours</h3>
              <div className="space-y-1">
                {hours.map(h => (
                  <div key={h.day} className="flex justify-between text-sm">
                    <span>{h.day}</span>
                    <span className="text-white font-medium">{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Payment</h3>
              <p className="text-sm">Visa, MasterCard, American Express</p>
              <p className="text-sm mt-1">CareCredit® financing available</p>
              <p className="text-sm mt-1">Insurance claims filed for you</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color: "#475569" }}>
            © 2026 Stewart Dental Group. All rights reserved. HIPAA Notice of Privacy Practices available upon request.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Site by{" "}
            <Link to="/dental-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DentalMockup;
