import { useState } from "react";
import { Helmet } from "react-helmet-async";
import heroImg from "@/assets/demo-plumber-hero.jpg";

const BRAND = "[BUSINESS NAME]";
const PHONE = "(313) 555-0199";

const services = [
  {
    title: "Emergency Leak Repair",
    desc: "Burst pipe at 2 AM? We answer the phone and show up fast—every single time.",
    icon: "🚨",
  },
  {
    title: "Water Heater Installation",
    desc: "Tank or tankless, we size it right and install it the same day. No cold showers.",
    icon: "🔥",
  },
  {
    title: "Sewer & Drain Cleaning",
    desc: "Camera inspections, hydro-jetting, and root removal to keep everything flowing.",
    icon: "🔧",
  },
];

const PlumberMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#0b1929" }}>
      <Helmet>
        <title>{BRAND} Plumbing | 24/7 Emergency Plumber Grosse Pointe & Metro Detroit</title>
        <meta name="description" content="Licensed 24/7 emergency plumber serving Grosse Pointe & Metro Detroit. Leak repair, water heaters, sewer & drain cleaning. No hidden fees." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional copper piping installation" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,25,41,.78), rgba(11,25,41,.92))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-3">
            {BRAND} PLUMBING
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto">
            24/7 Emergency Service &amp; Expert Repairs in Grosse Pointe &amp; Metro Detroit.
          </p>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="inline-block text-lg md:text-xl font-extrabold px-10 py-5 rounded-xl shadow-2xl transition-transform hover:scale-105 animate-pulse"
            style={{ background: "#dc2626", color: "#fff", boxShadow: "0 0 30px rgba(220,38,38,.45)" }}
          >
            🚨 Tap to Call for Emergency Service
          </a>
          <p className="mt-4 text-sm text-white/50">{PHONE}</p>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">
            Our Services
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-xl p-8 transition-shadow hover:shadow-lg"
                style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}
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
      <section className="py-16 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-white">Why Choose Us?</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#94a3b8" }}>
            Licensed, Insured, and at your door in under an hour.&nbsp;
            <span className="font-semibold text-white">No hidden fees.</span> You'll know the price before we start any work.
          </p>
        </div>
      </section>

      {/* Footer / Lead Form */}
      <footer className="px-6 py-16" style={{ background: "#081321", color: "#94a3b8" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">Contact Us</h2>

          {sent ? (
            <p className="text-center text-lg" style={{ color: "#22c55e" }}>
              ✅ Message received! We'll call you back shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Your Name", type: "text" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                { name: "address" as const, placeholder: "Service Address", type: "text" },
              ].map((f) => (
                <input
                  key={f.name}
                  required
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9" }}
                />
              ))}
              <textarea
                required
                placeholder="Describe the issue"
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-red-500/40"
                style={{ background: "#0f2035", border: "1px solid #1e3a5f", color: "#f1f5f9" }}
              />
              <button
                type="submit"
                className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "#dc2626", color: "#fff" }}
              >
                Send Request
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

export default PlumberMockup;
