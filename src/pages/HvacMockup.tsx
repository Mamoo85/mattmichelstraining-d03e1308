import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Wind, Flame, Thermometer, Shield, Star, Clock, Award, CheckCircle, MapPin, ArrowRight, Snowflake, Zap } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=80";
const BRAND = "Michigan Comfort HVAC";
const PHONE = "(313) 806-4952";
const BLUE = "#0284c7";

const services = [
  {
    title: "Furnace Repair & Installation",
    desc: "Emergency heat restoration and high-efficiency furnace installs. Most jobs same day.",
    Icon: Flame,
    color: BLUE,
  },
  {
    title: "Central A/C",
    desc: "Full system replacement, seasonal tune-ups, and refrigerant service. Cool by tonight.",
    Icon: Snowflake,
    color: "#38bdf8",
  },
  {
    title: "Indoor Air Quality",
    desc: "HEPA filtration, UV sanitizers, whole-home humidifiers. Breathe easier all winter.",
    Icon: Wind,
    color: "#0ea5e9",
  },
];

const stats = [
  { value: 1200, suffix: "+", label: "Systems Installed", Icon: CheckCircle },
  { value: 24, suffix: "/7", label: "Emergency Service", Icon: Clock },
  { value: 4.9, suffix: "", label: "Google Rating", Icon: Star },
  { value: 30, suffix: "+", label: "Years Experience", Icon: Award },
];

const badges = ["Licensed & Insured", "24/7 Emergency", "Free Estimates", "Financing Available"];

const testimonials = [
  {
    text: "Furnace died on the coldest night in January. Tech was here in under an hour. Fixed same night.",
    attr: "— K.L., St. Clair Shores",
  },
  {
    text: "New A/C installed in one day. Quieter and way more efficient than what we had.",
    attr: "— P.M., Grosse Pointe Park",
  },
  {
    text: "They quoted us $800 less than the other guys and pulled the permit correctly.",
    attr: "— T.B., Warren",
  },
];

const process = [
  { step: "1", title: "Call Us", desc: "Live answer 24/7." },
  { step: "2", title: "Diagnose Fast", desc: "Same-day diagnostics." },
  { step: "3", title: "Upfront Quote", desc: "No hidden fees." },
  { step: "4", title: "Done Right", desc: "Licensed & insured." },
];

const areas = [
  "Grosse Pointe",
  "St. Clair Shores",
  "Harper Woods",
  "Warren",
  "Eastpointe",
  "Roseville",
  "Clinton Twp",
  "Sterling Heights",
  "Royal Oak",
  "Ferndale",
];

const brands = ["Carrier", "Trane", "Lennox", "Rheem", "Honeywell", "Ecobee"];

/* Animated counter hook */
function useCounter(end: number, duration = 2000, visible = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) {
        setVal(end);
        clearInterval(id);
      } else {
        setVal(Math.floor(start * 10) / 10);
      }
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, visible]);
  return val;
}

function CounterStat({
  value,
  suffix,
  label,
  Icon,
  visible,
}: {
  value: number;
  suffix: string;
  label: string;
  Icon: React.ComponentType<{ size: number | string; className?: string; style?: React.CSSProperties }>;
  visible: boolean;
}) {
  const count = useCounter(value, 1800, visible);
  const display = Number.isInteger(value) ? Math.floor(count) : count.toFixed(1);
  return (
    <div className="text-center">
      <Icon size={20} className="mx-auto mb-2" style={{ color: BLUE }} />
      <div className="text-2xl md:text-3xl font-extrabold text-white">
        {display}
        {suffix}
      </div>
      <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

const HvacMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", details: "" });
  const [sent, setSent] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderVisible(y < 80 || y < lastY);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStatsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#071a2b" }}>
      <div style={{background:"#1e40af",color:"white",textAlign:"center",padding:"8px",fontSize:"11px",fontWeight:"700",letterSpacing:"0.1em"}}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <style>{`
        @keyframes hvac-pulse { 0%{box-shadow:0 0 0 0 rgba(2,132,199,.5)} 70%{box-shadow:0 0 0 12px rgba(2,132,199,0)} 100%{box-shadow:0 0 0 0 rgba(2,132,199,0)} }
        @keyframes hvac-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes hvac-spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <Helmet>
        <title>HVAC Website Demo | M2 Web Design Detroit</title>
        <meta
          name="description"
          content="See how a professional HVAC company website looks when built by M2 Web Design. Heating, cooling & air quality lead-generation site for Metro Detroit contractors."
        />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-hvac" />
        <meta property="og:title" content="HVAC Website Demo | M2 Web Design Detroit" />
        <meta
          property="og:description"
          content="Professional HVAC website mockup by M2 Web Design. Click-to-call, 24/7 emergency badges, lead capture forms."
        />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-hvac" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "HVAC Website Demo",
            description: "Demo HVAC website built by M2 Web Design for Metro Detroit contractors.",
            url: "https://www.mattmichelstraining.com/demo-hvac",
            provider: {
              "@type": "ProfessionalService",
              name: "M2 Web Design",
              url: "https://www.mattmichelstraining.com/detroit-web-design",
            },
          })}
        </script>
      </Helmet>

      {/* Demo Badge */}
      <div
        className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide"
        style={{ background: BLUE, color: "#fff" }}
      >
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">
          Matt Michels Web Design
        </Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Emergency Banner */}
      <div
        className="fixed left-0 right-0 z-[55] text-center py-1.5 text-xs font-bold uppercase tracking-widest"
        style={{ top: 27, background: BLUE, color: "#fff" }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full mr-2"
          style={{ background: "#fff", animation: "hvac-pulse 1.5s infinite" }}
        />
        NO HEAT OR A/C? CALL NOW — {PHONE}
      </div>

      {/* Sticky Header */}
      <header
        className="fixed left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 transition-transform duration-300"
        style={{
          top: 28,
          transform: headerVisible ? "translateY(0)" : "translateY(-150%)",
          background: "rgba(7,26,43,.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(2,132,199,.15)",
        }}
      >
        <span className="text-sm font-bold text-white tracking-wide">
          {BRAND}
        </span>
        <a
          href={`tel:${PHONE.replace(/\D/g, "")}`}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg"
          style={{ background: BLUE, color: "#fff" }}
        >
          <Phone size={14} /> {PHONE}
        </a>
      </header>

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: "92vh", paddingTop: "4.5rem" }}
      >
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="HVAC technician servicing a system" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(7,26,43,.80), rgba(7,26,43,.95))" }}
          />
        </div>

        {/* Floating snowflake accents */}
        <div
          className="absolute top-1/4 left-[10%] z-[1] opacity-20"
          style={{ animation: "hvac-float 4s ease-in-out infinite" }}
        >
          <Snowflake size={32} color={BLUE} />
        </div>
        <div
          className="absolute top-1/3 right-[8%] z-[1] opacity-15"
          style={{ animation: "hvac-float 5s ease-in-out infinite 1.5s" }}
        >
          <Snowflake size={24} color={BLUE} />
        </div>
        <div
          className="absolute bottom-1/3 left-[6%] z-[1] opacity-10"
          style={{ animation: "hvac-float 6s ease-in-out infinite 0.8s" }}
        >
          <Thermometer size={28} color="#38bdf8" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full"
            style={{
              background: "rgba(2,132,199,.15)",
              color: "#7dd3fc",
              border: "1px solid rgba(2,132,199,.3)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: BLUE, animation: "hvac-pulse 1.5s infinite" }}
            />{" "}
            24/7 Emergency HVAC Service
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {BRAND}
          </h1>
          <p className="text-lg md:text-xl mb-3 font-semibold" style={{ color: "#7dd3fc" }}>
            Detroit's HVAC Experts — Heating, Cooling &amp; Air Quality
          </p>
          <p className="text-base text-white/60 mb-10 max-w-xl mx-auto">
            Licensed. Fast. Upfront Pricing. Grosse Pointe &amp; Metro Detroit.
          </p>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-3 text-lg md:text-xl font-extrabold px-10 py-5 rounded-xl transition-transform hover:scale-105"
            style={{
              background: BLUE,
              color: "#fff",
              boxShadow: "0 0 40px rgba(2,132,199,.4), 0 0 80px rgba(2,132,199,.15)",
            }}
          >
            <Phone size={22} /> Tap to Call Now
          </a>
          <p className="mt-4 text-sm text-white/40">{PHONE}</p>
        </div>
      </section>

      {/* Stats with animated counters */}
      <RevealSection
        className="py-12 px-6"
        style={{ background: "#0c2236", borderTop: "1px solid rgba(255,255,255,.06)" }}
      >
        <div ref={statsRef} className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <CounterStat key={s.label} {...s} visible={statsVisible} />
          ))}
        </div>
      </RevealSection>

      {/* Trust Badges */}
      <div className="flex flex-wrap justify-center gap-3 py-8 px-6" style={{ background: "#071a2b" }}>
        {badges.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <Shield size={12} /> {b}
          </span>
        ))}
      </div>

      {/* Financing Banner */}
      <div
        className="py-5 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(2,132,199,.15), rgba(14,165,233,.08))",
          borderTop: "1px solid rgba(2,132,199,.2)",
          borderBottom: "1px solid rgba(2,132,199,.2)",
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <Zap size={18} style={{ color: BLUE }} />
          <span className="text-sm font-bold text-white">0% APR Financing Available on Select Systems</span>
          <Zap size={18} style={{ color: BLUE }} />
        </div>
        <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
          Ask about our flexible payment options — get comfortable today, pay over time.
        </p>
      </div>

      {/* Our Process */}
      <RevealSection className="py-20 px-6" style={{ background: "#0c2236" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white">How It Works</h2>
          <p className="text-center text-sm mb-12" style={{ color: "#94a3b8" }}>
            From call to comfort — fast, simple, transparent.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {process.map((p, i) => (
              <div
                key={p.title}
                className="relative text-center p-6 rounded-xl"
                style={{ background: "#102d45", border: "1px solid #1a3d59" }}
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-extrabold"
                  style={{ background: BLUE, color: "#fff" }}
                >
                  {p.step}
                </div>
                <h3 className="text-base font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  {p.desc}
                </p>
                {i < 3 && (
                  <ArrowRight
                    size={16}
                    className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 z-10"
                    style={{ color: "#94a3b8" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#071a2b" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-white">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="group rounded-xl overflow-hidden transition-shadow hover:shadow-xl"
                style={{ background: "#102d45", border: "1px solid #1a3d59" }}
              >
                <div
                  className="h-1.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                  style={{ background: s.color }}
                />
                <div className="p-8">
                  <s.Icon size={28} className="mb-4" style={{ color: s.color }} />
                  <h3 className="text-xl font-bold mb-2 text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Brands / Equipment */}
      <div
        className="py-6 px-6"
        style={{
          background: "#0c2236",
          borderTop: "1px solid rgba(255,255,255,.04)",
          borderBottom: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <p className="text-center text-xs mb-4" style={{ color: "#94a3b8" }}>
          Brands We Service &amp; Install
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          {brands.map((b) => (
            <span
              key={b}
              className="text-xs font-bold uppercase tracking-[.15em]"
              style={{ color: "rgba(255,255,255,.25)" }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#071a2b" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.attr}
                className="rounded-xl p-6"
                style={{ background: "#0c2236", border: "1px solid #1a3d59" }}
              >
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={BLUE} color={BLUE} />
                  ))}
                </div>
                <p className="italic text-sm text-white/70 mb-2">"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>
                  {t.attr}
                </p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Service Area */}
      <RevealSection className="py-16 px-6" style={{ background: "#0c2236" }}>
        <div className="max-w-4xl mx-auto text-center">
          <MapPin size={28} className="mx-auto mb-4" style={{ color: BLUE }} />
          <h2 className="text-2xl font-bold text-white mb-3">Service Area</h2>
          <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>
            Proudly serving the east side and greater Metro Detroit.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {areas.map((a) => (
              <span
                key={a}
                className="px-4 py-2 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(2,132,199,.1)",
                  color: "#7dd3fc",
                  border: "1px solid rgba(2,132,199,.2)",
                }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Footer / Lead Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#040e18", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Request Service</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>
              Fill out the form and we'll call you back — usually within 15 minutes.
            </p>
            {sent ? (
              <p className="text-lg" style={{ color: "#22c55e" }}>
                ✅ Message received! We'll call you back shortly.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                className="space-y-4"
              >
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
                    className="w-full rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                    style={{
                      background: "#0c2236",
                      border: "1px solid #1a3d59",
                      color: "#f1f5f9",
                      "--tw-ring-color": "rgba(2,132,199,.4)",
                    } as React.CSSProperties}
                  />
                ))}
                <textarea
                  required
                  placeholder="Describe the issue (heating, cooling, etc.)"
                  value={form.details}
                  onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2"
                  style={{
                    background: "#0c2236",
                    border: "1px solid #1a3d59",
                    color: "#f1f5f9",
                    "--tw-ring-color": "rgba(2,132,199,.4)",
                  } as React.CSSProperties}
                />
                <button
                  type="submit"
                  className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: BLUE, color: "#fff" }}
                >
                  Send Request
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                {[
                  "Furnace Repair",
                  "Furnace Installation",
                  "Central A/C",
                  "Indoor Air Quality",
                  "Annual Tune-Ups",
                  "Emergency Service",
                ].map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <CheckCircle size={14} style={{ color: BLUE }} /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Hours</h3>
              <p className="text-sm">
                Emergency: <span className="text-white font-semibold">24/7/365</span>
              </p>
              <p className="text-sm mt-1">Office: Mon–Fri 7am–6pm | Sat 8am–2pm</p>
            </div>
            <a
              href={`tel:${PHONE.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg"
              style={{ background: BLUE, color: "#fff" }}
            >
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div
          className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10"
          style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}
        >
          <p className="text-xs" style={{ color: "#475569" }}>
            © 2026 {BRAND}. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Site by{" "}
            <Link
              to="/detroit-web-design"
              className="underline underline-offset-2 hover:text-white transition-colors"
            >
              Matt Michels Web Design
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HvacMockup;
