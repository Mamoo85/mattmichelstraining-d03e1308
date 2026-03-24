import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Leaf, TreePine, Shovel, Sun, Snowflake, Phone, Star, Shield, MapPin, Users, CheckCircle } from "lucide-react";
import heroImg from "@/assets/demo-landscape-hero.jpg";
import { RevealSection } from "@/hooks/useInView";

const BRAND = "[BUSINESS NAME]";
const PHONE = "(555) 123-4567";

const seasons = [
  {
    key: "spring",
    label: "Spring",
    Icon: Sun,
    services: ["Spring Cleanup & Mulching", "Garden Bed Prep", "Lawn Aeration & Overseeding", "Irrigation Startup"],
  },
  {
    key: "summer",
    label: "Summer",
    Icon: Leaf,
    services: ["Weekly Mowing & Edging", "Hedge Trimming", "Fertilization Programs", "Landscape Design"],
  },
  {
    key: "fall",
    label: "Fall",
    Icon: TreePine,
    services: ["Leaf Removal", "Gutter Cleaning", "Fall Plantings", "Winterization Prep"],
  },
  {
    key: "winter",
    label: "Winter",
    Icon: Snowflake,
    services: ["Snow Plowing", "De-Icing & Salting", "Hardscape Planning", "Spring Booking Discounts"],
  },
];

const stats = [
  { value: "12", label: "Communities Served", Icon: MapPin },
  { value: "800+", label: "Properties Maintained", Icon: CheckCircle },
  { value: "4.8", label: "Google Rating", Icon: Star },
  { value: "10+", label: "Years Trusted", Icon: Users },
];

const LandscapeMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);
  const [activeSeason, setActiveSeason] = useState("spring");

  const GREEN = "#16a34a";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b", background: "#fff" }}>
      <Helmet>
        <title>Landscaping Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a landscaping company website looks when built by M² Web Design. Professional lead-generation site for lawn care & hardscaping contractors in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-landscaping" />
        <meta property="og:title" content="Landscaping Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional landscaper website mockup by M² Web Design. Seasonal services, quote forms, trust badges." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-landscaping" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Landscaping Website Demo",
          "description": "Demo landscaping website built by M² Web Design for Metro Detroit contractors.",
          "url": "https://www.mattmichelstraining.com/demo-landscaping",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3" style={{ background: "rgba(255,255,255,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f0" }}>
        <span className="text-sm font-bold tracking-wide" style={{ color: "#166534" }}>🌿 {BRAND}</span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white" style={{ background: GREEN }}>
          <Phone size={14} /> Free Quote
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "88vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Freshly landscaped lawn" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(22,101,52,.55), rgba(15,23,42,.85))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {BRAND}<br /><span style={{ color: "#4ade80" }}>LANDSCAPING</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-8">
            Professional, Reliable Lawn Care &amp; Hardscaping in Metro Detroit.
          </p>
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-3 text-lg font-bold px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105 text-white" style={{ background: GREEN }}>
            <Phone size={20} /> Call for a Free Quote
          </a>
        </div>
      </section>

      {/* Stats */}
      <RevealSection className="py-12 px-6" style={{ background: "#f0fdf4" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <s.Icon size={20} className="mx-auto mb-2" style={{ color: GREEN }} />
              <div className="text-2xl md:text-3xl font-extrabold" style={{ color: "#166534" }}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Seasonal Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: "#166534" }}>Services by Season</h2>
          <p className="text-center text-sm mb-10" style={{ color: "#64748b" }}>We keep your property looking great year-round.</p>

          {/* Season Tabs */}
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            {seasons.map(s => (
              <button key={s.key} onClick={() => setActiveSeason(s.key)}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
                style={{
                  background: activeSeason === s.key ? GREEN : "#fff",
                  color: activeSeason === s.key ? "#fff" : "#475569",
                  border: `1px solid ${activeSeason === s.key ? GREEN : "#e2e8f0"}`,
                }}>
                <s.Icon size={16} /> {s.label}
              </button>
            ))}
          </div>

          {/* Service List */}
          {seasons.filter(s => s.key === activeSeason).map(s => (
            <div key={s.key} className="grid md:grid-cols-2 gap-4">
              {s.services.map(svc => (
                <div key={svc} className="flex items-center gap-3 rounded-xl px-6 py-4" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                  <CheckCircle size={18} style={{ color: GREEN }} />
                  <span className="font-medium">{svc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Hardscaping Section */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ color: "#166534" }}>Custom Hardscaping</h2>
          <p className="text-center text-base mb-10" style={{ color: "#64748b" }}>Patios, retaining walls, and fire pits built to outlast the Michigan winters.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Paver Patios", "Retaining Walls", "Fire Pits", "Walkways"].map(item => (
              <div key={item} className="aspect-square rounded-xl flex items-center justify-center text-center p-4" style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}>
                <div>
                  <Shovel size={24} className="mx-auto mb-2" style={{ color: GREEN }} />
                  <span className="text-sm font-semibold" style={{ color: "#166534" }}>{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Trust + Social Proof */}
      <RevealSection className="py-16 px-6" style={{ background: "#f0fdf4" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#166534" }}>Why Choose Us?</h2>
          <p className="text-lg leading-relaxed mb-8" style={{ color: "#475569" }}>
            You're tired of contractors who don't answer the phone or leave jobs half-finished.
            We are locally owned, fully insured, and treat your property like it's our own.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {["Locally Owned", "Fully Insured", "Free Estimates", "Satisfaction Guaranteed"].map(b => (
              <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>
                <Shield size={12} /> {b}
              </span>
            ))}
          </div>
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="#16a34a" color="#16a34a" />)}
          </div>
          <p className="italic text-base mb-1" style={{ color: "#475569" }}>"Best landscaping crew in the area. Our yard has never looked this good."</p>
          <p className="text-sm" style={{ color: "#94a3b8" }}>— Homeowner, Royal Oak</p>
        </div>
      </RevealSection>

      {/* Footer / Lead Form */}
      <footer className="px-6 py-16" style={{ background: "#0f172a", color: "#cbd5e1" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Request a Quote</h2>
          {sent ? (
            <p className="text-center text-lg" style={{ color: "#22c55e" }}>✅ Thanks! We'll be in touch shortly.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Your Name", type: "text" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                { name: "address" as const, placeholder: "Property Address", type: "text" },
              ].map(f => (
                <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                  onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none"
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                />
              ))}
              <textarea required placeholder="What do you need done?" value={form.details}
                onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
              />
              <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90 text-white" style={{ background: GREEN }}>
                Send Request
              </button>
            </form>
          )}
          <p className="text-center text-sm mt-10" style={{ color: "#64748b" }}>© 2026 {BRAND}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandscapeMockup;
