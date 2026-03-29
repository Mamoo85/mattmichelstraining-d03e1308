import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Shield, Star, Award, CheckCircle, CloudRain, Home, Wrench, MapPin, ArrowRight, FileCheck } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80";
const BRAND = "East Side Roofing Co.";
const PHONE = "(313) 806-4952";
const ACCENT = "#2563eb";

const services = [
  { title: "Storm Damage & Insurance", desc: "We handle the entire insurance claim process for you. Most homeowners pay $0 out of pocket.", Icon: CloudRain, color: ACCENT },
  { title: "Full Roof Replacement", desc: "Tear-off and full replacement completed in a single day. All materials, cleanup, and permits included.", Icon: Home, color: "#16a34a" },
  { title: "Gutters & Fascia", desc: "Seamless gutters, fascia board repair, and downspout work done right alongside any roofing project.", Icon: Wrench, color: "#f97316" },
];

const stats = [
  { value: "300+", label: "Roofs Replaced", Icon: CheckCircle },
  { value: "$0", label: "Out-of-Pocket Insurance", Icon: Shield },
  { value: "4.9", label: "Google Rating", Icon: Star },
  { value: "20+", label: "Years Experience", Icon: Award },
];

const claimProcess = [
  { step: "1", title: "Storm Hits", desc: "Wind, hail, or tree damage to your roof." },
  { step: "2", title: "Free Inspection", desc: "We inspect and document all damage." },
  { step: "3", title: "Claim Filed", desc: "We file and manage your insurance claim." },
  { step: "4", title: "Approved", desc: "Insurance approves the work and coverage." },
  { step: "5", title: "Installed", desc: "New roof installed, usually in one day." },
];

const roofTypes = [
  { name: "Asphalt Shingles", desc: "Most popular. Affordable and durable." },
  { name: "Metal Roofing", desc: "50+ year lifespan. Energy efficient." },
  { name: "Flat / Commercial", desc: "TPO, EPDM, and modified bitumen." },
  { name: "Cedar Shake", desc: "Classic look. Natural insulation." },
];

const materials = ["GAF", "Owens Corning", "CertainTeed", "Tamko", "Atlas", "IKO"];

const testimonials = [
  { text: "Storm took out half our shingles. They handled the entire insurance claim. We paid nothing.", attr: "— D.R., St. Clair Shores" },
  { text: "New roof in one day. Crew was professional, fast, and cleaned up everything.", attr: "— T.M., Harper Woods" },
  { text: "Got 3 quotes. These were the only ones who walked me through every single step.", attr: "— L.K., Grosse Pointe" },
];

const RoofingMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#0b1929" }}>
      <div style={{background:"#1e40af",color:"white",textAlign:"center",padding:"8px",fontSize:"11px",fontWeight:"700",letterSpacing:"0.1em"}}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>
      <style>{`
        @keyframes roof-shingle { 0%{background-position:0 0} 100%{background-position:40px 40px} }
        .roof-pattern { background-image: repeating-linear-gradient(45deg, rgba(37,99,235,.04) 0px, rgba(37,99,235,.04) 2px, transparent 2px, transparent 20px); animation: roof-shingle 4s linear infinite; }
      `}</style>

      <Helmet>
        <title>Roofing Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a roofing contractor website looks when built by M² Web Design. Professional lead-gen site for roofers in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-roofing" />
        <meta property="og:title" content="Roofing Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional roofing website mockup by M² Web Design. Insurance claim handling, trust badges, quote forms." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-roofing" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Roofing Website Demo",
          "description": "Demo roofing website built by M² Web Design for Metro Detroit contractors.",
          "url": "https://www.mattmichelstraining.com/demo-roofing",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: ACCENT, color: "#fff" }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 transition-transform duration-300"
        style={{
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(11,25,41,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(37,99,235,.15)"
        }}
      >
        <span className="text-sm font-bold text-white tracking-wide">{BRAND} <span style={{ color: ACCENT }}>ROOFING</span></span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: ACCENT, color: "#fff" }}>
          <Phone size={14} /> Free Estimate
        </a>
      </header>

      {/* Hero with shingle pattern */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "92vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional roofing project" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,25,41,.78), rgba(11,25,41,.94))" }} />
          <div className="absolute inset-0 roof-pattern" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(37,99,235,.15)", color: "#93c5fd", border: "1px solid rgba(37,99,235,.3)" }}>
            <CheckCircle size={14} /> Free Estimates — No Obligation
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {BRAND}<br /><span style={{ color: ACCENT }}>ROOFING</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto">
            Residential &amp; Commercial Roofing in Metro Detroit.
          </p>
          <a
            href="#quote-form"
            className="inline-flex items-center gap-3 text-lg md:text-xl font-extrabold px-10 py-5 rounded-xl transition-transform hover:scale-105"
            style={{ background: ACCENT, color: "#fff", boxShadow: "0 0 40px rgba(37,99,235,.4), 0 0 80px rgba(37,99,235,.15)" }}
          >
            <Phone size={22} /> Get a Free Estimate
          </a>
          <p className="mt-4 text-sm text-white/40">{PHONE}</p>
        </div>
      </section>

      {/* Stats */}
      <RevealSection className="py-12 px-6" style={{ background: "#0f2035", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <s.Icon size={20} className="mx-auto mb-2" style={{ color: ACCENT }} />
              <div className="text-2xl md:text-3xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* $0 Out of Pocket Callout */}
      <RevealSection className="py-12 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-8 rounded-xl" style={{ background: "rgba(37,99,235,.08)", border: "1px solid rgba(37,99,235,.2)" }}>
          <div className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(37,99,235,.15)", border: "2px solid rgba(37,99,235,.3)" }}>
            <Shield size={36} style={{ color: ACCENT }} />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white mb-1">$0 Out of Pocket for Most Homeowners</h3>
            <p className="text-sm" style={{ color: "#94a3b8" }}>We handle your entire insurance claim from start to finish. If your roof qualifies, you pay nothing but your deductible.</p>
          </div>
        </div>
      </RevealSection>

      {/* Trust Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#0f2035" }}>
        {["Licensed", "Insured", "GAF Certified", "Free Estimates"].map(b => (
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.08)" }}>
            <Shield size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Insurance Claim Process */}
      <RevealSection className="py-20 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white">Insurance Claim Process</h2>
          <p className="text-center text-sm mb-12" style={{ color: "#94a3b8" }}>We handle everything — you just pick your shingle color.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {claimProcess.map((p, i) => (
              <div key={p.title} className="relative text-center p-5 rounded-xl" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-extrabold" style={{ background: ACCENT, color: "#fff" }}>{p.step}</div>
                <h3 className="text-sm font-bold text-white mb-1">{p.title}</h3>
                <p className="text-[11px]" style={{ color: "#94a3b8" }}>{p.desc}</p>
                {i < 4 && <ArrowRight size={14} className="hidden md:block absolute right-[-10px] top-1/2 -translate-y-1/2 z-10" style={{ color: "#94a3b8" }} />}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-white">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map(s => (
              <div key={s.title} className="group rounded-xl overflow-hidden transition-shadow hover:shadow-xl" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="h-1.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: s.color }} />
                <div className="p-8">
                  <s.Icon size={28} className="mb-4" style={{ color: s.color }} />
                  <h3 className="text-xl font-bold mb-2 text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Roof Types */}
      <RevealSection className="py-20 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">Roof Types We Install</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {roofTypes.map(r => (
              <div key={r.name} className="rounded-xl p-6 text-center" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <Home size={24} className="mx-auto mb-3" style={{ color: ACCENT }} />
                <h3 className="text-sm font-bold text-white mb-1">{r.name}</h3>
                <p className="text-[11px]" style={{ color: "#94a3b8" }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Materials Strip */}
      <div className="py-6 px-6" style={{ background: "#0f2035", borderTop: "1px solid rgba(255,255,255,.04)", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <p className="text-center text-xs mb-4" style={{ color: "#94a3b8" }}>Materials We Trust</p>
        <div className="flex flex-wrap justify-center gap-6">
          {materials.map(m => (
            <span key={m} className="text-xs font-bold uppercase tracking-[.15em]" style={{ color: "rgba(255,255,255,.2)" }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={ACCENT} color={ACCENT} />)}
                </div>
                <p className="italic text-sm text-white/70 mb-2">"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Footer / Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#081321", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Request a Free Estimate</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Tell us about your roof and we'll schedule a free inspection.</p>
            {sent ? (
              <p className="text-lg" style={{ color: "#22c55e" }}>✅ Got it! We'll be in touch shortly with your estimate.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "address" as const, placeholder: "Property Address", type: "text" },
                ].map(f => (
                  <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                    style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9", "--tw-ring-color": "rgba(37,99,235,.4)" } as React.CSSProperties}
                  />
                ))}
                <textarea required placeholder="Describe the roofing work needed" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                  style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9", "--tw-ring-color": "rgba(37,99,235,.4)" } as React.CSSProperties}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: ACCENT, color: "#fff" }}>
                  Submit Estimate Request
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Storm Damage Repair", "Full Replacements", "Insurance Claims", "Gutters & Fascia", "Flat Roofs", "Emergency Tarping"].map(s => (
                  <li key={s} className="flex items-center gap-2"><CheckCircle size={14} style={{ color: ACCENT }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Hours</h3>
              <p className="text-sm">Mon–Sat 7am–6pm</p>
              <p className="text-sm mt-1">Emergency tarping: 24/7</p>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg" style={{ background: ACCENT, color: "#fff" }}>
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color: "#475569" }}>© 2026 {BRAND}. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default RoofingMockup;
