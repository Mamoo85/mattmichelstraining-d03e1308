import { useState } from "react";
import { Helmet } from "react-helmet-async";
import heroImg from "@/assets/demo-landscape-hero.jpg";

const BRAND = "[BUSINESS NAME]";
const PHONE = "(555) 123-4567";

const services = [
  {
    title: "Weekly Maintenance",
    desc: "Mowing, edging, and trimming. We show up on time, every time.",
    icon: "🌿",
  },
  {
    title: "Spring & Fall Cleanups",
    desc: "Leaf removal, gutter cleaning, and seasonal prep to keep your property flawless.",
    icon: "🍂",
  },
  {
    title: "Custom Hardscaping",
    desc: "Patios, retaining walls, and fire pits built to outlast the Michigan winters.",
    icon: "🧱",
  },
];

const LandscapeMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b", background: "#fff" }}>
      <Helmet>
        <title>{BRAND} Landscaping | Metro Detroit Lawn Care & Hardscaping</title>
        <meta name="description" content="Professional, reliable lawn care and hardscaping for Metro Detroit homes. Weekly maintenance, cleanups, patios & more." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: "85vh" }}
      >
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Freshly landscaped lawn" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(15,23,42,.65), rgba(15,23,42,.80))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
            {BRAND} LANDSCAPING
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-8">
            Professional, Reliable Lawn Care &amp; Hardscaping in Metro Detroit.
          </p>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="inline-block text-lg font-bold px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105"
            style={{ background: "#22c55e", color: "#fff" }}
          >
            Call for a Free Quote: {PHONE}
          </a>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: "#166534" }}>
            Our Services
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow"
                style={{ background: "#fff", border: "1px solid #e2e8f0" }}
              >
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: "#166534" }}>{s.title}</h3>
                <p style={{ color: "#475569" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#166534" }}>Why Choose Us?</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#475569" }}>
            You're tired of contractors who don't answer the phone or leave jobs half-finished.
            We are locally owned, fully insured, and treat your property like it's our own.
          </p>
        </div>
      </section>

      {/* Footer / Lead Form */}
      <footer className="px-6 py-16" style={{ background: "#0f172a", color: "#cbd5e1" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Request a Quote</h2>

          {sent ? (
            <p className="text-center text-lg" style={{ color: "#22c55e" }}>
              ✅ Thanks! We'll be in touch shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Your Name", type: "text" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                { name: "address" as const, placeholder: "Property Address", type: "text" },
              ].map((f) => (
                <input
                  key={f.name}
                  required
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none"
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                />
              ))}
              <textarea
                required
                placeholder="What do you need done?"
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
              />
              <button
                type="submit"
                className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "#22c55e", color: "#fff" }}
              >
                Send Request
              </button>
            </form>
          )}

          <p className="text-center text-sm mt-10" style={{ color: "#64748b" }}>
            © 2026 {BRAND}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandscapeMockup;
