import { useState } from "react";
import { Helmet } from "react-helmet-async";
import heroImg from "@/assets/demo-lawyer-hero.jpg";

const NAME = "[NAME]";
const PHONE = "(586) 555-0312";

const practices = [
  {
    title: "Estate Planning & Trusts",
    desc: "Wills, living trusts, powers of attorney, and probate—protect your family's future with a plan that holds up.",
    icon: "📜",
  },
  {
    title: "Small Business Law",
    desc: "Entity formation, contracts, partnership disputes, and compliance so you can focus on growing your business.",
    icon: "🏛️",
  },
  {
    title: "Family Law",
    desc: "Divorce, custody, and support handled with discretion, empathy, and relentless advocacy for your interests.",
    icon: "⚖️",
  },
];

const LawyerMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", details: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#d4d4d8", background: "#1c1c1f" }}>
      <Helmet>
        <title>{NAME} Law Firm | Attorney in Macomb & Wayne County</title>
        <meta name="description" content="Dedicated legal representation in Macomb & Wayne County. Estate planning, small business law, and family law. Schedule a confidential consultation." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional law office" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(28,28,31,.75), rgba(28,28,31,.93))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-[.35em] mb-4" style={{ color: "#c9a84c" }}>Attorney at Law</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-4 text-white" style={{ fontFamily: "'Georgia', serif" }}>
            {NAME} LAW FIRM
          </h1>
          <p className="text-lg md:text-xl text-white/65 mb-10 max-w-xl mx-auto" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            Fierce, Dedicated Legal Representation in Macomb &amp; Wayne County.
          </p>
          <a
            href="#contact-form"
            className="inline-block text-base md:text-lg font-bold px-10 py-4 rounded-lg shadow-2xl transition-transform hover:scale-105"
            style={{ background: "#c9a84c", color: "#1c1c1f", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: ".02em" }}
          >
            Schedule a Confidential Consultation
          </a>
        </div>
      </section>

      {/* Practice Areas */}
      <section className="py-20 px-6" style={{ background: "#222225" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: "#c9a84c", fontFamily: "'Georgia', serif" }}>
            Practice Areas
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {practices.map((s) => (
              <div
                key={s.title}
                className="rounded-xl p-8 transition-shadow hover:shadow-lg"
                style={{ background: "#1c1c1f", border: "1px solid #333338" }}
              >
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-white" style={{ fontFamily: "'Georgia', serif" }}>{s.title}</h3>
                <p style={{ color: "#a1a1aa", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "0.95rem", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-6" style={{ background: "#1c1c1f" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-px mx-auto mb-6" style={{ background: "#c9a84c" }} />
          <p className="text-xl md:text-2xl leading-relaxed italic text-white/80" style={{ fontFamily: "'Georgia', serif" }}>
            "Big-firm experience, small-firm attention.&nbsp;
            <span className="not-italic font-semibold" style={{ color: "#c9a84c" }}>You talk to me, not a paralegal.</span>"
          </p>
          <div className="w-16 h-px mx-auto mt-6" style={{ background: "#c9a84c" }} />
        </div>
      </section>

      {/* Footer / Contact Form */}
      <footer id="contact-form" className="px-6 py-16" style={{ background: "#151517", color: "#a1a1aa", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>Secure Contact</h2>
          <p className="text-center text-sm mb-8" style={{ color: "#71717a" }}>All inquiries are confidential.</p>

          {sent ? (
            <p className="text-center text-lg" style={{ color: "#c9a84c" }}>
              ✓ Thank you. We will be in touch within one business day.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Full Name", type: "text" },
                { name: "email" as const, placeholder: "Email Address", type: "email" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
              ].map((f) => (
                <input
                  key={f.name}
                  required
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                  style={{ background: "#1c1c1f", border: "1px solid #333338", color: "#f4f4f5", "--tw-ring-color": "rgba(201,168,76,.4)" } as React.CSSProperties}
                />
              ))}
              <textarea
                required
                placeholder="Briefly describe your legal matter"
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                style={{ background: "#1c1c1f", border: "1px solid #333338", color: "#f4f4f5", "--tw-ring-color": "rgba(201,168,76,.4)" } as React.CSSProperties}
              />
              <button
                type="submit"
                className="w-full font-bold text-base py-3 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "#c9a84c", color: "#1c1c1f" }}
              >
                Submit Inquiry
              </button>
            </form>
          )}

          <p className="text-center text-xs mt-10" style={{ color: "#52525b" }}>
            © 2026 {NAME} Law Firm. All rights reserved. This site does not constitute legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LawyerMockup;
