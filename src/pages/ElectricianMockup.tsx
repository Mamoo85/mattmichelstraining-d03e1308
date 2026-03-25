import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Zap, Battery, Lightbulb, Shield, Star, Award, CheckCircle, FileCheck, Phone, Car, Sun, Home, Plug, AlertTriangle } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=80";
const BRAND = "[BUSINESS NAME]";
const PHONE = "(313) 806-4952";
const YELLOW = "#facc15";

const services = [
  { title: "Panel Upgrades", desc: "Older Grosse Pointe homes need modern panels. We upgrade safely to handle today's electrical loads.", Icon: Zap },
  { title: "Generator Installation", desc: "Whole-home standby generators so you never lose power—installed and permitted correctly.", Icon: Battery },
  { title: "Smart Home & Lighting", desc: "Recessed lighting, dimmers, smart switches, and EV charger installs done right the first time.", Icon: Lightbulb },
];

const projects = [
  { title: "Panel Upgrade", Icon: Zap, desc: "100A → 200A for modern loads" },
  { title: "EV Charger", Icon: Car, desc: "Level 2 home & commercial" },
  { title: "Generator", Icon: Battery, desc: "Whole-home standby power" },
  { title: "Recessed Lighting", Icon: Sun, desc: "LED conversions & new installs" },
  { title: "Smart Home", Icon: Home, desc: "Switches, hubs, automation" },
  { title: "Outdoor Lighting", Icon: Lightbulb, desc: "Security & landscape lighting" },
];

const credentials = [
  { value: "Master", label: "Electrician" },
  { value: "20+", label: "Years in Business" },
  { value: "2,000+", label: "Jobs Completed" },
  { value: "4.9", label: "Google Rating" },
];

const testimonials = [
  { text: "Had our 1920s panel upgraded. Permitted, inspected, passed first time. These guys know their stuff.", attr: "— B.F., Grosse Pointe Farms" },
  { text: "Installed 3 EV chargers at our business. Clean, fast, code compliant. Will use again.", attr: "— Owner, East Side Auto" },
  { text: "Other electrician quoted $4,200. These guys did it for $1,800 and pulled the permit.", attr: "— J.S., Warren" },
];

const ElectricianMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  const cautionStripe = "repeating-linear-gradient(135deg, #facc15 0px, #facc15 10px, #1e1e24 10px, #1e1e24 20px)";

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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#1e1e24" }}>
      <style>{`
        @keyframes elec-crawl { 0%{background-position:0 0} 100%{background-position:28px 0} }
        @keyframes elec-arc { 0%{opacity:0;transform:scaleX(0)} 50%{opacity:1;transform:scaleX(1)} 100%{opacity:0;transform:scaleX(0)} }
        .elec-stripe-animated { animation: elec-crawl 1s linear infinite; }
      `}</style>

      <Helmet>
        <title>Electrician Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a licensed electrician website looks when built by M² Web Design. Professional lead-generation site for electrical contractors in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-electrician" />
        <meta property="og:title" content="Electrician Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional electrician website mockup by M² Web Design. Safety-first branding, permit badges, quote forms." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-electrician" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Electrician Website Demo",
          "description": "Demo electrician website built by M² Web Design for Metro Detroit contractors.",
          "url": "https://www.mattmichelstraining.com/demo-electrician",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: YELLOW, color: "#1e1e24" }}>
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
          background: "rgba(30,30,36,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(250,204,21,.15)"
        }}
      >
        <span className="text-sm font-bold tracking-wide"><span style={{ color: YELLOW }}>⚡</span> {BRAND} <span style={{ color: YELLOW }}>ELECTRIC</span></span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: YELLOW, color: "#1e1e24" }}>
          <Phone size={14} /> Call Now
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional electrical panel" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(30,30,36,.80), rgba(30,30,36,.95))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(250,204,21,.1)", color: YELLOW, border: "1px solid rgba(250,204,21,.25)" }}>
            <FileCheck size={14} /> Permit Pulled on Every Job
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-3" style={{ color: YELLOW }}>
            {BRAND}<br /><span className="text-white">ELECTRIC</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto">
            Safe, Code-Compliant Electrical Work for East Side Homes &amp; Businesses.
          </p>
          <a href="#quote-form" className="inline-flex items-center gap-3 text-lg font-extrabold px-10 py-4 rounded-xl transition-transform hover:scale-105" style={{ background: YELLOW, color: "#1e1e24", boxShadow: "0 0 30px rgba(250,204,21,.3)" }}>
            <Zap size={20} /> Get a Free Estimate
          </a>
        </div>
      </section>

      {/* Animated Caution Stripe */}
      <div className="elec-stripe-animated" style={{ height: 6, backgroundImage: cautionStripe, backgroundSize: "28px 6px", opacity: 0.5 }} />

      {/* Credentials */}
      <RevealSection className="py-12 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Permit Badge Section */}
      <RevealSection className="py-12 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-8 rounded-xl" style={{ background: "rgba(250,204,21,.05)", border: "1px solid rgba(250,204,21,.15)" }}>
          <div className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(250,204,21,.1)", border: "2px solid rgba(250,204,21,.3)" }}>
            <FileCheck size={36} style={{ color: YELLOW }} />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-white mb-1">Every Job. Every Permit. Every Time.</h3>
            <p className="text-sm" style={{ color: "#94a3b8" }}>We pull the proper permits and schedule inspections on every project. Your home's safety and your insurance coverage depend on it.</p>
          </div>
        </div>
      </RevealSection>

      {/* Common Projects Grid */}
      <RevealSection className="py-20 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: YELLOW }}>Common Projects</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map(p => (
              <div key={p.title} className="group rounded-xl p-6 text-center transition-all hover:scale-[1.02]" style={{ background: "#1e1e24", border: "1px solid #3a3a44" }}>
                <div className="w-14 h-14 rounded-lg mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(250,204,21,.1)" }}>
                  <p.Icon size={26} style={{ color: YELLOW }} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Animated Caution Stripe */}
      <div className="elec-stripe-animated" style={{ height: 6, backgroundImage: cautionStripe, backgroundSize: "28px 6px", opacity: 0.5 }} />

      {/* Licensed vs Unlicensed */}
      <RevealSection className="py-20 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: YELLOW }}>Licensed vs. Unlicensed</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl p-8" style={{ background: "rgba(250,204,21,.05)", border: "1px solid rgba(250,204,21,.2)" }}>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle size={24} style={{ color: YELLOW }} />
                <h3 className="text-lg font-bold text-white">Licensed Electrician</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: "#94a3b8" }}>
                {["Pulls proper permits", "Passes city inspection", "Insurance covers the work", "Code-compliant & safe", "Protects home resale value"].map(t => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle size={12} style={{ color: YELLOW }} />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl p-8" style={{ background: "rgba(220,38,38,.05)", border: "1px solid rgba(220,38,38,.2)" }}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} style={{ color: "#ef4444" }} />
                <h3 className="text-lg font-bold text-white">Unlicensed "Handyman"</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: "#94a3b8" }}>
                {["No permits = code violations", "Fails inspection, costs more", "Insurance won't cover damage", "Fire & shock hazard risk", "Kills resale value"].map(t => (
                  <li key={t} className="flex items-center gap-2"><AlertTriangle size={12} style={{ color: "#ef4444" }} />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: YELLOW }}>Our Services</h2>
          <div className="space-y-6">
            {services.map(s => (
              <div key={s.title} className="group flex items-start gap-6 rounded-xl p-6 md:p-8 transition-shadow hover:shadow-lg" style={{ background: "#1e1e24", border: "1px solid #3a3a44" }}>
                <div className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: "rgba(250,204,21,.1)" }}>
                  <s.Icon size={26} style={{ color: YELLOW }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1 text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: YELLOW }}>What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#26262e", border: "1px solid #3a3a44" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={YELLOW} color={YELLOW} />)}
                </div>
                <p className="italic text-sm text-white/70 mb-2">"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#26262e" }}>
        {["Master Licensed", "Fully Insured", "Code Compliant", "Permit on File"].map(b => (
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "rgba(250,204,21,.08)", color: YELLOW, border: "1px solid rgba(250,204,21,.2)" }}>
            <Shield size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Footer / Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#16161c", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Request a Fast Quote</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Describe your project and we'll get back to you with a free estimate.</p>
            {sent ? (
              <p className="text-lg" style={{ color: YELLOW }}>⚡ Got it! We'll get back to you shortly with your estimate.</p>
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
                    style={{ background: "#1e1e24", border: "1px solid #3a3a44", color: "#f1f5f9", "--tw-ring-color": "rgba(250,204,21,.4)" } as React.CSSProperties}
                  />
                ))}
                <textarea required placeholder="Describe the electrical work needed" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                  style={{ background: "#1e1e24", border: "1px solid #3a3a44", color: "#f1f5f9", "--tw-ring-color": "rgba(250,204,21,.4)" } as React.CSSProperties}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: YELLOW, color: "#1e1e24" }}>
                  Submit Quote Request
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Panel Upgrades", "EV Chargers", "Generators", "Recessed Lighting", "Smart Home", "Outdoor Lighting"].map(s => (
                  <li key={s} className="flex items-center gap-2"><Zap size={14} style={{ color: YELLOW }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Hours</h3>
              <p className="text-sm">Mon–Fri 7am–6pm | Sat 8am–1pm</p>
              <p className="text-sm mt-1">Emergency service available</p>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg" style={{ background: YELLOW, color: "#1e1e24" }}>
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

export default ElectricianMockup;
