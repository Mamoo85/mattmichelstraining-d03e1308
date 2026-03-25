import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Zap, Battery, Lightbulb, Shield, Star, Award, CheckCircle, FileCheck, Phone } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=80";
const BRAND = "[BUSINESS NAME]";
const PHONE = "(313) 806-4952";

const services = [
  { title: "Panel Upgrades", desc: "Older Grosse Pointe homes need modern panels. We upgrade safely to handle today's electrical loads.", Icon: Zap },
  { title: "Generator Installation", desc: "Whole-home standby generators so you never lose power—installed and permitted correctly.", Icon: Battery },
  { title: "Smart Home & Lighting", desc: "Recessed lighting, dimmers, smart switches, and EV charger installs done right the first time.", Icon: Lightbulb },
];

const credentials = [
  { value: "Master", label: "Electrician", Icon: Award },
  { value: "20+", label: "Years in Business", Icon: CheckCircle },
  { value: "2,000+", label: "Jobs Completed", Icon: Zap },
  { value: "4.9", label: "Google Rating", Icon: Star },
];

const testimonials = [
  { text: "Had our 1920s panel upgraded. Permitted, inspected, passed first time. These guys know their stuff.", attr: "— B.F., Grosse Pointe Farms" },
  { text: "Installed 3 EV chargers at our business. Clean, fast, code compliant. Will use again.", attr: "— Owner, East Side Auto" },
  { text: "Other electrician quoted $4,200. These guys did it for $1,800 and pulled the permit.", attr: "— J.S., Warren" },
];

const ElectricianMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);

  const cautionStripe = "repeating-linear-gradient(135deg, #facc15 0px, #facc15 10px, #1e1e24 10px, #1e1e24 20px)";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#1e1e24" }}>
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

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3" style={{ background: "rgba(30,30,36,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(250,204,21,.15)" }}>
        <span className="text-sm font-bold tracking-wide"><span style={{ color: "#facc15" }}>⚡</span> {BRAND} <span style={{ color: "#facc15" }}>ELECTRIC</span></span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: "#facc15", color: "#1e1e24" }}>
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
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(250,204,21,.1)", color: "#facc15", border: "1px solid rgba(250,204,21,.25)" }}>
            <FileCheck size={14} /> Permit Pulled on Every Job
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-3" style={{ color: "#facc15" }}>
            {BRAND}<br /><span className="text-white">ELECTRIC</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto">
            Safe, Code-Compliant Electrical Work for East Side Homes &amp; Businesses.
          </p>
          <a href="#quote-form" className="inline-flex items-center gap-3 text-lg font-extrabold px-10 py-4 rounded-xl transition-transform hover:scale-105" style={{ background: "#facc15", color: "#1e1e24", boxShadow: "0 0 30px rgba(250,204,21,.3)" }}>
            <Zap size={20} /> Get a Free Estimate
          </a>
        </div>
      </section>

      {/* Caution Stripe Divider */}
      <div style={{ height: 6, background: cautionStripe, opacity: 0.35 }} />

      {/* Credentials */}
      <RevealSection className="py-12 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <c.Icon size={20} className="mx-auto mb-2" style={{ color: "#facc15" }} />
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Services — Horizontal Cards */}
      <RevealSection className="py-20 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: "#facc15" }}>Our Services</h2>
          <div className="space-y-6">
            {services.map(s => (
              <div key={s.title} className="flex items-start gap-6 rounded-xl p-6 md:p-8 transition-shadow hover:shadow-lg" style={{ background: "#26262e", border: "1px solid #3a3a44" }}>
                <div className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: "rgba(250,204,21,.1)" }}>
                  <s.Icon size={26} style={{ color: "#facc15" }} />
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

      {/* Caution Stripe Divider */}
      <div style={{ height: 6, background: cautionStripe, opacity: 0.35 }} />

      {/* Trust */}
      <RevealSection className="py-16 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#facc15" }}>Why Choose Us?</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#94a3b8" }}>
            Don't trust your home's safety to a handyman.{" "}
            <span className="font-semibold text-white">Master Electrician on every job.</span>{" "}
            Fully licensed, insured, and pulling proper permits every time.
          </p>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-12 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#26262e", border: "1px solid #3a3a44" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="#facc15" color="#facc15" />)}
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
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "rgba(250,204,21,.08)", color: "#facc15", border: "1px solid rgba(250,204,21,.2)" }}>
            <Shield size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Footer / Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#16161c", color: "#94a3b8" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Request a Fast Quote</h2>
          {sent ? (
            <p className="text-center text-lg" style={{ color: "#facc15" }}>⚡ Got it! We'll get back to you shortly with your estimate.</p>
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
              <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: "#facc15", color: "#1e1e24" }}>
                Submit Quote Request
              </button>
            </form>
          )}
          <p className="text-center text-sm mt-10" style={{ color: "#475569" }}>© 2026 {BRAND}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ElectricianMockup;