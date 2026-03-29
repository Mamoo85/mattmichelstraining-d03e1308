import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Home, MapPin, TrendingUp, Star, CheckCircle, Phone, Award, DollarSign, Key, Search } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80";
const BRAND = "Sarah Kovacs Real Estate";
const PHONE = "(313) 806-4952";
const NAVY = "#1e3a5f";
const GOLD = "#b8972a";

const services = [
  { title: "Buying a Home", desc: "I find homes that fit your life, not just your budget. I know every neighborhood — from Grosse Pointe to Ferndale — and I'll never rush you into the wrong move.", Icon: Key },
  { title: "Selling Your Home", desc: "Professional photography, targeted digital ads, and an MLS strategy that gets your home in front of the right buyers fast. Homes I list sell faster than average.", Icon: DollarSign },
  { title: "Investment Properties", desc: "Looking for a rental or flip? I'll run the numbers with you, identify undervalued listings, and help you build a portfolio that actually cash-flows.", Icon: TrendingUp },
  { title: "First-Time Buyers", desc: "Nervous? That's normal. I walk you through every step — pre-approval, offer letters, inspections, closing — in plain English, no surprises.", Icon: Home },
];

const credentials = [
  { value: "12+", label: "Years in Metro Detroit" },
  { value: "340+", label: "Homes Closed" },
  { value: "$47M+", label: "Sales Volume" },
  { value: "4.9", label: "Google Rating" },
];

const testimonials = [
  { text: "Sarah sold our Grosse Pointe home in 8 days for $15k over asking. She knows this market better than anyone.", attr: "— M. & J. Torres, Grosse Pointe Park" },
  { text: "We looked at 12 houses. She never once pushed us. When we found the right one she moved fast and we won a multiple-offer situation.", attr: "— K. Washington, Ferndale" },
  { text: "First-time buyer here. Sarah explained everything in a way that made sense. Closed without any drama whatsoever.", attr: "— A. Patel, Royal Oak" },
];

const neighborhoods = [
  "Grosse Pointe", "Harper Woods", "St. Clair Shores", "Eastpointe",
  "Royal Oak", "Ferndale", "Berkley", "Huntington Woods",
];

const RealEstateMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", details: "" });
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b", background: "#f8fafc" }}>
      <div style={{ background: "#1e40af", color: "white", textAlign: "center", padding: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em" }}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <Helmet>
        <title>Real Estate Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a real estate agent website looks when built by M² Web Design. Professional lead-generation site for Metro Detroit realtors." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-real-estate" />
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide text-white" style={{ background: NAVY }}>
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
          background: "rgba(255,255,255,.97)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(30,58,95,.1)",
          boxShadow: "0 1px 8px rgba(0,0,0,.08)"
        }}
      >
        <span className="text-sm font-bold tracking-wide" style={{ color: NAVY }}>
          <span style={{ color: GOLD }}>⌂</span> {BRAND}
        </span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white" style={{ background: NAVY }}>
          <Phone size={14} /> Call Sarah
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "88vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Metro Detroit home" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(30,58,95,.7), rgba(30,58,95,.92))" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full text-white" style={{ background: "rgba(184,151,42,.2)", border: "1px solid rgba(184,151,42,.4)" }}>
            <MapPin size={14} style={{ color: GOLD }} /> Metro Detroit's Trusted Real Estate Agent
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 text-white">
            Buy. Sell. <span style={{ color: GOLD }}>Win.</span><br />
            <span className="text-3xl md:text-4xl font-semibold opacity-80">In Metro Detroit.</span>
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,.75)" }}>
            12 years of local market knowledge. Direct access to me — not a team, not a voicemail. Real estate the way it should be done.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#contact-form" className="inline-flex items-center gap-3 text-base font-extrabold px-8 py-4 rounded-xl transition-transform hover:scale-105 text-white" style={{ background: GOLD }}>
              <Search size={18} /> Get a Free Home Valuation
            </a>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-3 text-base font-bold px-6 py-4 rounded-xl border-2 text-white" style={{ borderColor: "rgba(255,255,255,.4)" }}>
              <Phone size={18} /> {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <RevealSection className="py-14 px-6" style={{ background: NAVY }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,.55)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* About Sarah */}
      <RevealSection className="py-20 px-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-10 items-center">
          <div className="flex-shrink-0 w-40 h-40 rounded-2xl overflow-hidden" style={{ background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="text-5xl font-black text-white">SK</span>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3 px-3 py-1 rounded-full" style={{ background: "rgba(30,58,95,.08)", color: NAVY }}>
              <Award size={12} /> Grosse Pointe Resident · Licensed Since 2013
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: NAVY }}>I live here. I work here. I know this market.</h2>
            <p className="text-sm leading-relaxed text-slate-600 mb-3">
              I grew up on the East Side and have spent 12 years helping Metro Detroit families buy and sell homes. When you call me, you reach me — not a buyer's agent, not an assistant. I handle your transaction start to finish.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Certified Negotiation Expert", "Top 5% Detroit Area Agents", "Zillow Premier Agent", "Google 4.9 Stars"].map(t => (
                <span key={t} className="text-[10px] px-2 py-1 rounded-md font-semibold" style={{ background: "rgba(30,58,95,.08)", color: NAVY }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "white" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: NAVY }}>How I Can Help</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {services.map(s => (
              <div key={s.title} className="flex gap-5 p-6 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(30,58,95,.08)" }}>
                  <s.Icon size={22} style={{ color: NAVY }} />
                </div>
                <div>
                  <h3 className="font-bold mb-1.5" style={{ color: NAVY }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Neighborhoods */}
      <RevealSection className="py-14 px-6" style={{ background: "#f1f5f9" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-lg font-bold mb-6" style={{ color: NAVY }}>Neighborhoods I Know Best</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {neighborhoods.map(n => (
              <span key={n} className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full" style={{ background: "white", border: `1px solid rgba(30,58,95,.15)`, color: NAVY }}>
                <MapPin size={11} /> {n}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "white" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: NAVY }}>What Clients Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={GOLD} color={GOLD} />)}
                </div>
                <p className="italic text-sm text-slate-600 mb-2">"{t.text}"</p>
                <p className="text-xs text-slate-400">{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Contact Form */}
      <footer id="contact-form" className="px-6 py-16" style={{ background: NAVY, color: "rgba(255,255,255,.7)" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Let's Talk.</h2>
            <p className="text-sm mb-6">Buying, selling, or just curious what your home is worth? Reach out — no commitment, no pressure, just an honest conversation.</p>
            {sent ? (
              <p className="text-lg" style={{ color: GOLD }}>⌂ Got it! I'll reach out within the hour.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "email" as const, placeholder: "Email Address", type: "email" },
                ].map(f => (
                  <input key={f.name} required={f.name !== "email"} type={f.type} placeholder={f.placeholder} value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-lg px-4 py-3 text-base outline-none"
                    style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "white" }}
                  />
                ))}
                <textarea required placeholder="What are you looking to do? Buy, sell, or get a home valuation?" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                  style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "white" }}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: GOLD, color: NAVY }}>
                  Get in Touch
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Buyer Representation", "Listing & Selling", "Investment Properties", "First-Time Buyers", "Relocation Services", "Free Home Valuation"].map(s => (
                  <li key={s} className="flex items-center gap-2"><CheckCircle size={14} style={{ color: GOLD }} /> {s}</li>
                ))}
              </ul>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg" style={{ background: GOLD, color: NAVY }}>
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.3)" }}>© {new Date().getFullYear()} {BRAND} · Licensed in Michigan</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.2)" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default RealEstateMockup;
