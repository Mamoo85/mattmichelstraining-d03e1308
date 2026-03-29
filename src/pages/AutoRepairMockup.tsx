import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Wrench, Car, Gauge, Zap, Shield, Star, CheckCircle, Phone, AlertTriangle, Settings, Flame } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1600&q=80";
const BRAND = "East Side Auto & Tire";
const PHONE = "(313) 806-4952";
const RED = "#dc2626";

const services = [
  { title: "Oil Change & Fluids", desc: "Conventional, synthetic, or high-mileage. In and out in 30 minutes. No appointment needed.", Icon: Gauge },
  { title: "Brake Repair", desc: "Pads, rotors, calipers, and brake fluid flush. We don't sell you what you don't need.", Icon: AlertTriangle },
  { title: "Tires — Sales & Install", desc: "Budget and name-brand tires in stock. Mounted, balanced, and TPMS reset same day.", Icon: Car },
  { title: "Engine Diagnostics", desc: "Check engine light? We pull codes, diagnose the real problem, and give you a straight answer.", Icon: Settings },
  { title: "AC Repair", desc: "Recharge, leak check, compressor replacement. Ready before summer hits.", Icon: Flame },
  { title: "Transmission Service", desc: "Fluid change, filter service, and full transmission repair. Domestic and import.", Icon: Wrench },
];

const credentials = [
  { value: "ASE", label: "Certified Techs" },
  { value: "28+", label: "Years in Business" },
  { value: "4,000+", label: "Cars Serviced" },
  { value: "4.8", label: "Google Rating" },
];

const testimonials = [
  { text: "Brought my truck in for brakes. They showed me exactly what was worn and didn't try to sell me anything extra. Honest shop.", attr: "— D.R., Harper Woods" },
  { text: "Same-day tire swap on my commuter car. Price was fair and they had me back on the road in an hour.", attr: "— K.M., Eastpointe" },
  { text: "Check engine light on my Silverado. Other place quoted $1,200. These guys found a $40 sensor. Dealers hate them.", attr: "— T.L., Warren" },
];

const AutoRepairMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "", details: "" });
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#0f0f13" }}>
      <div style={{ background: "#1e40af", color: "white", textAlign: "center", padding: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em" }}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <Helmet>
        <title>Auto Repair Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a local auto repair shop website looks when built by M² Web Design. Professional lead-generation site for auto shops in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-auto-repair" />
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: RED, color: "white" }}>
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
          background: "rgba(15,15,19,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(220,38,38,.2)"
        }}
      >
        <span className="text-sm font-bold tracking-wide text-white">
          <span style={{ color: RED }}>🔧</span> {BRAND}
        </span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white" style={{ background: RED }}>
          <Phone size={14} /> Call Now
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Auto repair shop" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(15,15,19,.75), rgba(15,15,19,.97))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(220,38,38,.12)", color: RED, border: "1px solid rgba(220,38,38,.25)" }}>
            <Shield size={14} /> ASE Certified · No Upsells · Honest Work
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-4 text-white">
            East Side<br /><span style={{ color: RED }}>Auto & Tire</span>
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-xl mx-auto" style={{ color: "#94a3b8" }}>
            Straight answers. Fair prices. Done right the first time. Serving Eastpointe, Harper Woods & Warren since 1997.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#quote-form" className="inline-flex items-center gap-3 text-lg font-extrabold px-10 py-4 rounded-xl transition-transform hover:scale-105 text-white" style={{ background: RED, boxShadow: "0 0 30px rgba(220,38,38,.3)" }}>
              <Wrench size={20} /> Schedule Service
            </a>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-3 text-lg font-bold px-8 py-4 rounded-xl border text-white" style={{ borderColor: "rgba(220,38,38,.4)" }}>
              <Phone size={20} /> {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <RevealSection className="py-12 px-6" style={{ background: "#18181f" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Trust Strip */}
      <RevealSection className="py-10 px-6" style={{ background: "#0f0f13" }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-8 rounded-xl" style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.15)" }}>
          <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,.1)", border: "2px solid rgba(220,38,38,.3)" }}>
            <Shield size={30} style={{ color: RED }} />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-white mb-1">No Scare Tactics. No Fake Urgency.</h3>
            <p className="text-sm" style={{ color: "#94a3b8" }}>We show you what's worn, tell you what can wait, and what needs to be fixed now. You make the call. That's why people keep coming back for 28 years.</p>
          </div>
        </div>
      </RevealSection>

      {/* Services Grid */}
      <RevealSection className="py-20 px-6" style={{ background: "#18181f" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-white">What We Fix</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {services.map(s => (
              <div key={s.title} className="flex items-start gap-5 rounded-xl p-6" style={{ background: "#0f0f13", border: "1px solid #1e1e26" }}>
                <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(220,38,38,.1)" }}>
                  <s.Icon size={22} style={{ color: RED }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#0f0f13" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 text-white">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#18181f", border: "1px solid #1e1e26" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={RED} color={RED} />)}
                </div>
                <p className="italic text-sm mb-2" style={{ color: "rgba(255,255,255,.65)" }}>"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#18181f" }}>
        {["ASE Certified", "Fully Insured", "28 Years Local", "No Upsells", "Same-Day Service"].map(b => (
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "rgba(220,38,38,.08)", color: RED, border: "1px solid rgba(220,38,38,.2)" }}>
            <CheckCircle size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#0a0a0e", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Schedule Your Service</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Tell us about your vehicle and what's going on. We'll get back to you with a quote — no pressure.</p>
            {sent ? (
              <p className="text-lg" style={{ color: RED }}>🔧 Got it! We'll reach out shortly with your estimate.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "vehicle" as const, placeholder: "Year / Make / Model (e.g. 2018 Ford F-150)", type: "text" },
                ].map(f => (
                  <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-lg px-4 py-3 text-base outline-none"
                    style={{ background: "#18181f", border: "1px solid #1e1e26", color: "#f1f5f9" }}
                  />
                ))}
                <textarea required placeholder="What's going on with the car? Any warning lights?" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                  style={{ background: "#18181f", border: "1px solid #1e1e26", color: "#f1f5f9" }}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: RED }}>
                  Request a Quote
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Oil Change & Fluids", "Brakes & Rotors", "Tires — Sales & Install", "Engine Diagnostics", "AC & Heat", "Transmission Service"].map(s => (
                  <li key={s} className="flex items-center gap-2" style={{ color: "#94a3b8" }}><Wrench size={14} style={{ color: RED }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Hours</h3>
              <p className="text-sm" style={{ color: "#94a3b8" }}>Mon–Fri 7:30am–6pm | Sat 8am–2pm</p>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg text-white" style={{ background: RED }}>
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color: "#475569" }}>© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AutoRepairMockup;
