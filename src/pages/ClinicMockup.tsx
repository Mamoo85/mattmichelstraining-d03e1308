import { Helmet } from "react-helmet-async";
import heroImg from "@/assets/demo-clinic-hero.jpg";

const BRAND = "[NAME]";
const GOLD = "#b8a064";
const GOLD_HOVER = "#a68d52";

const services = [
  {
    title: "IV Hydration Therapy",
    desc: "Customized vitamin & nutrient infusions administered in a private suite—because wellness should feel like a retreat, not a hospital visit.",
    icon: "💧",
  },
  {
    title: "Medical Aesthetics",
    desc: "Botox, dermal fillers, and skin rejuvenation performed by board-certified professionals. Subtle, natural results every time.",
    icon: "✨",
  },
  {
    title: "Concierge Wellness Plans",
    desc: "Comprehensive health optimization tailored to your life. Annual physicals, bloodwork, and ongoing care—on your schedule.",
    icon: "🩺",
  },
];

const ClinicMockup = () => (
  <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#3a3a3a", background: "#ffffff" }}>
    <Helmet>
      <title>{BRAND} Aesthetics & Wellness | Premium MedSpa Grosse Pointe</title>
      <meta name="description" content="Premium medical aesthetics, IV therapy, and concierge wellness in Grosse Pointe. Board-certified care in a luxurious, private setting." />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>

    {/* Hero */}
    <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "92vh" }}>
      <div className="absolute inset-0 z-0">
        <img src={heroImg} alt="Modern aesthetic clinic waiting room" className="w-full h-full object-cover" width={1536} height={1024} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,.72), rgba(255,255,255,.88))" }} />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto">
        <p className="text-xs tracking-[.35em] uppercase mb-4" style={{ color: GOLD, fontFamily: "'Inter', system-ui, sans-serif" }}>
          Grosse Pointe &amp; Metro Detroit
        </p>
        <h1 className="text-4xl md:text-6xl font-normal tracking-tight leading-tight mb-4" style={{ color: "#1a1a1a" }}>
          {BRAND}<br />
          <span className="text-3xl md:text-4xl" style={{ color: "#555" }}>AESTHETICS &amp; WELLNESS</span>
        </h1>
        <p className="text-base md:text-lg leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: "#666" }}>
          Premium, personalized care without the clinical feel. Serving Grosse Pointe and the surrounding communities.
        </p>
        <a
          href="#services"
          className="inline-block text-sm tracking-[.15em] uppercase font-semibold px-10 py-4 rounded transition-colors"
          style={{ background: GOLD, color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}
          onMouseEnter={e => (e.currentTarget.style.background = GOLD_HOVER)}
          onMouseLeave={e => (e.currentTarget.style.background = GOLD)}
        >
          View Our Services &amp; Pricing
        </a>
      </div>
    </section>

    {/* Services */}
    <section id="services" className="py-24 px-6" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-normal text-center mb-4" style={{ color: "#1a1a1a" }}>
          Our Services
        </h2>
        <div className="w-12 h-px mx-auto mb-14" style={{ background: GOLD }} />
        <div className="grid md:grid-cols-3 gap-10">
          {services.map(s => (
            <div key={s.title} className="rounded-lg p-8 text-center" style={{ background: "#fff", border: "1px solid #eee" }}>
              <div className="text-3xl mb-5">{s.icon}</div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: "#1a1a1a" }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#777" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Trust */}
    <section className="py-20 px-6" style={{ background: "#fff" }}>
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-12 h-px mx-auto mb-8" style={{ background: GOLD }} />
        <blockquote className="text-xl md:text-2xl italic leading-relaxed mb-6" style={{ color: "#2a2a2a" }}>
          "Board-Certified. Discreet. Built around your schedule, not our waiting room."
        </blockquote>
        <p className="text-sm tracking-[.2em] uppercase" style={{ color: GOLD, fontFamily: "'Inter', system-ui, sans-serif" }}>
          Our Promise
        </p>
      </div>
    </section>

    {/* Footer / Portal CTA */}
    <footer className="py-20 px-6 text-center" style={{ background: "#f5f5f0", borderTop: "1px solid #e8e8e3" }}>
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl md:text-3xl font-normal mb-4" style={{ color: "#1a1a1a" }}>
          Ready to Begin?
        </h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "#777" }}>
          Schedule your consultation or access your records through our HIPAA-compliant patient portal.
        </p>
        <button
          className="text-sm tracking-[.15em] uppercase font-semibold px-10 py-4 rounded transition-colors cursor-pointer"
          style={{ background: GOLD, color: "#fff", border: "none", fontFamily: "'Inter', system-ui, sans-serif" }}
          onMouseEnter={e => (e.currentTarget.style.background = GOLD_HOVER)}
          onMouseLeave={e => (e.currentTarget.style.background = GOLD)}
          onClick={() => alert("This would link to a HIPAA-compliant patient portal (e.g. Jane App, SimplePractice).")}
        >
          🔒 Access the Secure Patient Portal
        </button>
        <p className="text-xs mt-10" style={{ color: "#aaa" }}>
          © 2026 {BRAND} Aesthetics & Wellness. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
);

export default ClinicMockup;
