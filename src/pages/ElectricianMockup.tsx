import { useState } from "react";
import { Helmet } from "react-helmet-async";
import heroImg from "@/assets/demo-electrician-hero.jpg";

const BRAND = "[BUSINESS NAME]";
const PHONE = "(313) 555-0247";

const services = [
  {
    title: "Panel Upgrades",
    desc: "Older Grosse Pointe homes need modern panels. We upgrade safely to handle today's electrical loads.",
    icon: "⚡",
  },
  {
    title: "Generator Installation",
    desc: "Whole-home standby generators so you never lose power—installed and permitted correctly.",
    icon: "🔋",
  },
  {
    title: "Smart Home & Lighting",
    desc: "Recessed lighting, dimmers, smart switches, and EV charger installs done right the first time.",
    icon: "💡",
  },
];

const ElectricianMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#1e1e24" }}>
      <Helmet>
        <title>{BRAND} Electric | Licensed Electrician Grosse Pointe & East Side Detroit</title>
        <meta name="description" content="Master electrician serving Grosse Pointe & East Side Detroit. Panel upgrades, generators, smart home wiring. Safe, code-compliant work." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "88vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional electrical panel" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(30,30,36,.80), rgba(30,30,36,.93))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-3" style={{ color: "#facc15" }}>
            {BRAND} ELECTRIC
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto">
            Safe, Code-Compliant Electrical Work for East Side Homes &amp; Businesses.
          </p>
          <a
            href="#quote-form"
            className="inline-block text-lg font-extrabold px-10 py-4 rounded-xl shadow-2xl transition-transform hover:scale-105"
            style={{ background: "#facc15", color: "#1e1e24", boxShadow: "0 0 24px rgba(250,204,21,.35)" }}
          >
            ⚡ Get a Free Estimate
          </a>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-6" style={{ background: "#26262e" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: "#facc15" }}>
            Our Services
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-xl p-8 transition-shadow hover:shadow-lg"
                style={{ background: "#1e1e24", border: "1px solid #3a3a44" }}
              >
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-white">{s.title}</h3>
                <p style={{ color: "#94a3b8" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-6" style={{ background: "#1e1e24" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#facc15" }}>Why Choose Us?</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#94a3b8" }}>
            Don't trust your home's safety to a handyman.&nbsp;
            <span className="font-semibold text-white">Master Electrician on every job.</span> Fully licensed, insured, and pulling proper permits every time.
          </p>
        </div>
      </section>

      {/* Footer / Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#16161c", color: "#94a3b8" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Request a Fast Quote</h2>

          {sent ? (
            <p className="text-center text-lg" style={{ color: "#facc15" }}>
              ⚡ Got it! We'll get back to you shortly with your estimate.
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
                  className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                  style={{ background: "#1e1e24", border: "1px solid #3a3a44", color: "#f1f5f9", "--tw-ring-color": "rgba(250,204,21,.4)" } as React.CSSProperties}
                />
              ))}
              <textarea
                required
                placeholder="Describe the electrical work needed"
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                style={{ background: "#1e1e24", border: "1px solid #3a3a44", color: "#f1f5f9", "--tw-ring-color": "rgba(250,204,21,.4)" } as React.CSSProperties}
              />
              <button
                type="submit"
                className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "#facc15", color: "#1e1e24" }}
              >
                Submit Quote Request
              </button>
            </form>
          )}

          <p className="text-center text-sm mt-10" style={{ color: "#475569" }}>
            © 2026 {BRAND}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ElectricianMockup;
