import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Scale, Building2, Heart, Shield, Lock, Phone, Star } from "lucide-react";
import heroImg from "@/assets/demo-lawyer-hero.jpg";
import { RevealSection } from "@/hooks/useInView";

const NAME = "[NAME]";
const PHONE = "(586) 555-0312";
const GOLD = "#c9a84c";

const practices = [
  { title: "Estate Planning & Trusts", desc: "Wills, living trusts, powers of attorney, and probate—protect your family's future with a plan that holds up.", Icon: Scale, numeral: "I" },
  { title: "Small Business Law", desc: "Entity formation, contracts, partnership disputes, and compliance so you can focus on growing your business.", Icon: Building2, numeral: "II" },
  { title: "Family Law", desc: "Divorce, custody, and support handled with discretion, empathy, and relentless advocacy for your interests.", Icon: Heart, numeral: "III" },
];

const testimonials = [
  { text: "Handled our estate plan with incredible attention to detail. We finally have peace of mind.", initials: "R.M." },
  { text: "Got me through a very difficult custody case. Professional, compassionate, and relentless.", initials: "S.K." },
];

const LawyerMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", details: "" });
  const [sent, setSent] = useState(false);

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#d4d4d8", background: "#1c1c1f" }}>
      <Helmet>
        <title>Attorney Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a private attorney website looks when built by M² Web Design. Premium, trust-building design for law firms in Macomb & Wayne County." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-lawyer" />
        <meta property="og:title" content="Attorney Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional law firm website mockup by M² Web Design. Gold accents, confidential contact forms, practice area showcases." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-lawyer" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Attorney Website Demo",
          "description": "Demo attorney website built by M² Web Design for Metro Detroit law firms.",
          "url": "https://www.mattmichelstraining.com/demo-lawyer",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3" style={{ background: "rgba(28,28,31,.95)", backdropFilter: "blur(10px)", borderBottom: `1px solid rgba(201,168,76,.15)` }}>
        <span className="text-sm font-bold tracking-[.15em]" style={{ color: GOLD }}>{NAME} LAW</span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded" style={{ background: GOLD, color: "#1c1c1f", fontFamily: "'Inter', sans-serif" }}>
          <Phone size={12} /> {PHONE}
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "92vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional law office" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(28,28,31,.75), rgba(28,28,31,.95))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[.4em] mb-5" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>Attorney at Law</p>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-4 text-white">
            {NAME}<br />LAW FIRM
          </h1>
          <div className="w-20 h-px mx-auto my-6" style={{ background: GOLD }} />
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
            Fierce, Dedicated Legal Representation in Macomb &amp; Wayne County.
          </p>
          <a href="#contact-form" className="inline-block text-sm md:text-base font-bold px-10 py-4 rounded transition-transform hover:scale-105" style={{ background: GOLD, color: "#1c1c1f", fontFamily: "'Inter', sans-serif", letterSpacing: ".05em" }}>
            Schedule a Confidential Consultation
          </a>
        </div>
      </section>

      {/* Credentials Bar */}
      <RevealSection style={{ background: "#222225", borderTop: `1px solid rgba(201,168,76,.15)`, borderBottom: `1px solid rgba(201,168,76,.15)` }} className="py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm" style={{ fontFamily: "'Inter', sans-serif", color: "#a1a1aa" }}>
          {["20+ Years Experience", "1,000+ Cases Handled", "Macomb & Wayne County Bar"].map((c, i) => (
            <span key={c} className="flex items-center gap-3">
              {i > 0 && <span style={{ color: GOLD }}>|</span>}
              <span>{c}</span>
            </span>
          ))}
        </div>
      </RevealSection>

      {/* Gold Rule */}
      <div className="w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      {/* Practice Areas */}
      <RevealSection className="py-20 px-6" style={{ background: "#1c1c1f" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ color: GOLD }}>Practice Areas</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {practices.map(s => (
              <div key={s.title} className="rounded-xl p-8 transition-shadow hover:shadow-xl text-center" style={{ background: "#222225", border: "1px solid #333338" }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl font-bold" style={{ background: "rgba(201,168,76,.1)", color: GOLD, border: `1px solid rgba(201,168,76,.25)` }}>
                  {s.numeral}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#a1a1aa", fontFamily: "'Inter', sans-serif" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Gold Rule */}
      <div className="w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      {/* Trust Quote */}
      <RevealSection className="py-20 px-6" style={{ background: "#222225" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-px mx-auto mb-8" style={{ background: GOLD }} />
          <p className="text-xl md:text-3xl leading-relaxed italic text-white/80">
            "Big-firm experience, small-firm attention.{" "}
            <span className="not-italic font-semibold" style={{ color: GOLD }}>You talk to me, not a paralegal.</span>"
          </p>
          <div className="w-16 h-px mx-auto mt-8" style={{ background: GOLD }} />
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#1c1c1f" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: GOLD }}>Client Testimonials</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map(t => (
              <div key={t.initials} className="rounded-xl p-8" style={{ background: "#222225", border: "1px solid #333338" }}>
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={GOLD} color={GOLD} />)}
                </div>
                <p className="italic text-base text-white/70 mb-4 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>"{t.text}"</p>
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(201,168,76,.15)", color: GOLD, border: `1px solid rgba(201,168,76,.3)` }}>
                    {t.initials}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Gold Rule */}
      <div className="w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      {/* Footer / Contact Form */}
      <footer id="contact-form" className="px-6 py-16" style={{ background: "#151517", color: "#a1a1aa", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>Secure Contact</h2>
          <div className="flex items-center justify-center gap-2 text-xs mb-8" style={{ color: "#71717a" }}>
            <Lock size={12} /> All inquiries are confidential — Attorney-Client Privilege applies.
          </div>
          {sent ? (
            <p className="text-center text-lg" style={{ color: GOLD }}>✓ Thank you. We will be in touch within one business day.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              {[
                { name: "name" as const, placeholder: "Full Name", type: "text" },
                { name: "email" as const, placeholder: "Email Address", type: "email" },
                { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
              ].map(f => (
                <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                  onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                  style={{ background: "#1c1c1f", border: "1px solid #333338", color: "#f4f4f5", "--tw-ring-color": "rgba(201,168,76,.4)" } as React.CSSProperties}
                />
              ))}
              <textarea required placeholder="Briefly describe your legal matter" value={form.details}
                onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                style={{ background: "#1c1c1f", border: "1px solid #333338", color: "#f4f4f5", "--tw-ring-color": "rgba(201,168,76,.4)" } as React.CSSProperties}
              />
              <button type="submit" className="w-full font-bold text-base py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: GOLD, color: "#1c1c1f" }}>
                Submit Inquiry
              </button>
            </form>
          )}
          <p className="text-center text-xs mt-10" style={{ color: "#52525b" }}>© 2026 {NAME} Law Firm. All rights reserved. This site does not constitute legal advice.</p>
        </div>
      </footer>
    </div>
  );
};

export default LawyerMockup;
