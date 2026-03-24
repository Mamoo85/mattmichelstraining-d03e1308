import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Phone, Droplets, Flame, Wrench, Shield, Star, Clock, Award, CheckCircle } from "lucide-react";
import heroImg from "@/assets/demo-plumber-hero.jpg";
import { RevealSection } from "@/hooks/useInView";

const BRAND = "[BUSINESS NAME]";
const PHONE = "(313) 555-0199";

const services = [
  { title: "Emergency Leak Repair", desc: "Burst pipe at 2 AM? We answer the phone and show up fast—every single time.", Icon: Droplets, color: "#dc2626" },
  { title: "Water Heater Installation", desc: "Tank or tankless, we size it right and install it the same day. No cold showers.", Icon: Flame, color: "#f97316" },
  { title: "Sewer & Drain Cleaning", desc: "Camera inspections, hydro-jetting, and root removal to keep everything flowing.", Icon: Wrench, color: "#3b82f6" },
];

const stats = [
  { value: "500+", label: "Jobs Completed", Icon: CheckCircle },
  { value: "38 min", label: "Avg Response Time", Icon: Clock },
  { value: "4.9", label: "Google Rating", Icon: Star },
  { value: "15+", label: "Years Licensed", Icon: Award },
];

const badges = ["Licensed", "Fully Insured", "BBB Accredited", "5-Star Google"];

const PlumberMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#0b1929" }}>
      <Helmet>
        <title>{BRAND} Plumbing | 24/7 Emergency Plumber Grosse Pointe & Metro Detroit</title>
        <meta name="description" content="Licensed 24/7 emergency plumber serving Grosse Pointe & Metro Detroit. Leak repair, water heaters, sewer & drain cleaning. No hidden fees." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3" style={{ background: "rgba(11,25,41,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <span className="text-sm font-bold text-white tracking-wide">{BRAND} <span style={{ color: "#dc2626" }}>PLUMBING</span></span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: "#dc2626", color: "#fff" }}>
          <Phone size={14} /> {PHONE}
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "92vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional copper piping installation" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,25,41,.78), rgba(11,25,41,.94))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(220,38,38,.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,.3)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#dc2626" }} /> 24/7 Emergency Service
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {BRAND}<br /><span style={{ color: "#dc2626" }}>PLUMBING</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto">
            Licensed. Fast. No Hidden Fees.<br className="hidden md:block" /> Grosse Pointe &amp; Metro Detroit.
          </p>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-3 text-lg md:text-xl font-extrabold px-10 py-5 rounded-xl transition-transform hover:scale-105"
            style={{ background: "#dc2626", color: "#fff", boxShadow: "0 0 40px rgba(220,38,38,.4), 0 0 80px rgba(220,38,38,.15)" }}
          >
            <Phone size={22} /> Tap to Call Now
          </a>
          <p className="mt-4 text-sm text-white/40">{PHONE}</p>
        </div>
      </section>

      {/* Stats */}
      <RevealSection className="py-12 px-6" style={{ background: "#0f2035", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <s.Icon size={20} className="mx-auto mb-2" style={{ color: "#dc2626" }} />
              <div className="text-2xl md:text-3xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Trust Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#0b1929" }}>
        {badges.map(b => (
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.08)" }}>
            <Shield size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-white">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map(s => (
              <div key={s.title} className="rounded-xl overflow-hidden transition-shadow hover:shadow-xl" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="h-1.5" style={{ background: s.color }} />
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

      {/* Before/After Placeholder */}
      <RevealSection className="py-16 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-8">Recent Work</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {["Emergency pipe repair — Grosse Pointe Woods", "Full water heater replacement — St. Clair Shores"].map((label) => (
              <div key={label} className="rounded-xl overflow-hidden" style={{ background: "#0f2035", border: "1px solid #1e3a5f" }}>
                <div className="grid grid-cols-2">
                  <div className="aspect-[4/3] flex items-center justify-center text-sm font-bold" style={{ background: "#162d4a", color: "#475569" }}>BEFORE</div>
                  <div className="aspect-[4/3] flex items-center justify-center text-sm font-bold" style={{ background: "#1a3854", color: "#475569" }}>AFTER</div>
                </div>
                <p className="text-xs text-center py-3" style={{ color: "#64748b" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Trust Quote */}
      <RevealSection className="py-16 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-white">Why Choose Us?</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#94a3b8" }}>
            Licensed, Insured, and at your door in under an hour.{" "}
            <span className="font-semibold text-white">No hidden fees.</span> You'll know the price before we start any work.
          </p>
        </div>
      </RevealSection>

      {/* Social Proof */}
      <RevealSection className="py-12 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="#facc15" color="#facc15" />)}
          </div>
          <p className="italic text-base text-white/70 mb-2">"Called at midnight with a burst pipe. They were at my house in 30 minutes. Couldn't believe it."</p>
          <p className="text-sm" style={{ color: "#475569" }}>— Homeowner, Grosse Pointe Park</p>
        </div>
      </RevealSection>

      {/* Footer / Lead Form */}
      <footer className="px-6 py-16" style={{ background: "#081321", color: "#94a3b8" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Contact Us</h2>
          {sent ? (
            <p className="text-center text-lg" style={{ color: "#22c55e" }}>✅ Message received! We'll call you back shortly.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Your Name", type: "text" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                { name: "address" as const, placeholder: "Service Address", type: "text" },
              ].map(f => (
                <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                  onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9" }}
                />
              ))}
              <textarea required placeholder="Describe the issue" value={form.details}
                onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-red-500/40"
                style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9" }}
              />
              <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: "#dc2626", color: "#fff" }}>
                Send Request
              </button>
            </form>
          )}
          <p className="text-center text-sm mt-10" style={{ color: "#475569" }}>© 2026 {BRAND}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PlumberMockup;
