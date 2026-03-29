import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Sparkles, Home, Building2, Star, CheckCircle, Phone, Shield, Clock, Heart, Leaf } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80";
const BRAND = "Shine Right Cleaning Co.";
const PHONE = "(313) 806-4952";
const TEAL = "#0d9488";
const TEAL_LIGHT = "#ccfbf1";

const services = [
  { title: "Recurring Home Cleaning", desc: "Weekly, bi-weekly, or monthly. Same team every time so you know who's in your home. We bring everything — you just enjoy it.", Icon: Home },
  { title: "Deep Cleaning", desc: "Baseboards, inside cabinets, behind appliances, grout lines. The full reset your home needs a few times a year.", Icon: Sparkles },
  { title: "Move In / Move Out", desc: "Leaving or arriving? We get every corner so you get your deposit back — or start fresh without someone else's mess.", Icon: Heart },
  { title: "Commercial Cleaning", desc: "Offices, retail, and small commercial spaces. After-hours service available so we never interrupt your business.", Icon: Building2 },
  { title: "Post-Construction Cleanup", desc: "Drywall dust, paint overspray, debris. We turn a job site into a ready-to-occupy space.", Icon: Shield },
  { title: "Green / Eco-Friendly", desc: "We offer fragrance-free, non-toxic products for families with young kids, pets, or sensitivities. Just ask.", Icon: Leaf },
];

const credentials = [
  { value: "Insured", label: "& Bonded" },
  { value: "8+", label: "Years in Business" },
  { value: "500+", label: "Happy Clients" },
  { value: "4.9", label: "Google Rating" },
];

const testimonials = [
  { text: "My house looks better than the day we moved in. They got things I didn't even know needed cleaning.", attr: "— L. Barnes, Grosse Pointe Woods" },
  { text: "Move-out clean on a rental unit. Landlord said it was the cleanest turnover they'd ever seen. Got my deposit back immediately.", attr: "— R. Chen, St. Clair Shores" },
  { text: "Bi-weekly recurring. Same two women every time, they know our home, they're trustworthy, and we never have to ask twice.", attr: "— T. & M. Adams, Eastpointe" },
];

const CleaningServiceMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b", background: "#f0fdf9" }}>
      <div style={{ background: "#1e40af", color: "white", textAlign: "center", padding: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em" }}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <Helmet>
        <title>Cleaning Service Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a cleaning service website looks when built by M² Web Design. Professional lead-generation site for cleaning companies in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-cleaning" />
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide text-white" style={{ background: TEAL }}>
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
          background: "rgba(240,253,249,.97)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(13,148,136,.15)",
          boxShadow: "0 1px 8px rgba(0,0,0,.06)"
        }}
      >
        <span className="text-sm font-bold tracking-wide" style={{ color: TEAL }}>
          <Sparkles size={14} className="inline mr-1" /> {BRAND}
        </span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white" style={{ background: TEAL }}>
          <Phone size={14} /> Get a Quote
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "85vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Clean modern home" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(13,148,136,.6), rgba(15,23,42,.88))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(255,255,255,.15)", color: "white", border: "1px solid rgba(255,255,255,.25)" }}>
            <Shield size={14} /> Insured · Bonded · Background Checked
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 text-white">
            A Cleaner Home.<br /><span style={{ color: TEAL_LIGHT }}>More Time For You.</span>
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,.8)" }}>
            Residential and commercial cleaning for Metro Detroit homes and businesses. Professional, trustworthy, and detail-obsessed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#quote-form" className="inline-flex items-center gap-3 text-base font-extrabold px-8 py-4 rounded-xl transition-transform hover:scale-105 text-white" style={{ background: TEAL }}>
              <Sparkles size={18} /> Get a Free Quote
            </a>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-3 text-base font-bold px-6 py-4 rounded-xl border-2 text-white" style={{ borderColor: "rgba(255,255,255,.35)" }}>
              <Phone size={18} /> {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <RevealSection className="py-12 px-6" style={{ background: TEAL }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,.6)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Trust Strip */}
      <RevealSection className="py-10 px-6" style={{ background: "white" }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-8 rounded-xl" style={{ background: "#f0fdf9", border: "1px solid rgba(13,148,136,.2)" }}>
          <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(13,148,136,.1)", border: "2px solid rgba(13,148,136,.3)" }}>
            <Clock size={28} style={{ color: TEAL }} />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold mb-1" style={{ color: "#0f172a" }}>On Time. Every Time.</h3>
            <p className="text-sm leading-relaxed text-slate-500">We confirm your appointment 24 hours in advance and show up in the window we give you. No waiting around, no no-shows. Your time matters.</p>
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#f8fffe" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: "#0f172a" }}>What We Clean</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {services.map(s => (
              <div key={s.title} className="flex gap-5 p-6 rounded-xl bg-white" style={{ border: "1px solid rgba(13,148,136,.12)" }}>
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(13,148,136,.1)" }}>
                  <s.Icon size={22} style={{ color: TEAL }} />
                </div>
                <div>
                  <h3 className="font-bold mb-1.5 text-slate-800">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "white" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: "#0f172a" }}>What Our Clients Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#f0fdf9", border: "1px solid rgba(13,148,136,.15)" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={TEAL} color={TEAL} />)}
                </div>
                <p className="italic text-sm text-slate-600 mb-2">"{t.text}"</p>
                <p className="text-xs text-slate-400">{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Trust Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#f0fdf9" }}>
        {["Fully Insured", "Background Checked", "Eco-Friendly Options", "Pet-Safe Products", "100% Satisfaction Guarantee"].map(b => (
          <span key={b} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full" style={{ background: "white", color: TEAL, border: "1px solid rgba(13,148,136,.2)" }}>
            <CheckCircle size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Quote Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#0f172a", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Get a Free Quote</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Tell us about your space and what you need cleaned. We'll get back to you same day with a flat-rate price — no surprises.</p>
            {sent ? (
              <p className="text-lg" style={{ color: TEAL }}>✓ Got it! We'll send your quote within a few hours.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "address" as const, placeholder: "Property Address (city is fine)", type: "text" },
                ].map(f => (
                  <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-lg px-4 py-3 text-base outline-none"
                    style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                  />
                ))}
                <textarea required placeholder="What type of cleaning? How many bedrooms/bathrooms? Anything specific?" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: TEAL }}>
                  Request My Free Quote
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Recurring Home Cleaning", "Deep Cleaning", "Move In / Move Out", "Commercial Cleaning", "Post-Construction", "Eco-Friendly Options"].map(s => (
                  <li key={s} className="flex items-center gap-2"><CheckCircle size={14} style={{ color: TEAL }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Service Area</h3>
              <p className="text-sm">Grosse Pointe · Harper Woods · St. Clair Shores · Eastpointe · Warren</p>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg text-white" style={{ background: TEAL }}>
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

export default CleaningServiceMockup;
