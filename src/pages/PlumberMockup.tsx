import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Droplets, Flame, Wrench, Shield, Star, Clock, Award, CheckCircle, MapPin, ArrowRight } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80";
const BRAND = "Metro Pro Plumbing";
const PHONE = "(313) 806-4952";
const RED = "#dc2626";

const services = [
  { title: "Emergency Leak Repair", desc: "Burst pipe at 2 AM? We answer the phone and show up fast—every single time.", Icon: Droplets, color: RED },
  { title: "Water Heater Installation", desc: "Tank or tankless, we size it right and install it the same day. No cold showers.", Icon: Flame, color: "#f97316" },
  { title: "Sewer & Drain Cleaning", desc: "Camera inspections, hydro-jetting, and root removal to keep everything flowing.", Icon: Wrench, color: "#3b82f6" },
];

const stats = [
  { value: 500, suffix: "+", label: "Jobs Completed", Icon: CheckCircle },
  { value: 38, suffix: " min", label: "Avg Response Time", Icon: Clock },
  { value: 4.9, suffix: "", label: "Google Rating", Icon: Star },
  { value: 15, suffix: "+", label: "Years Licensed", Icon: Award },
];

const badges = ["Licensed", "Fully Insured", "BBB Accredited", "5-Star Google"];

const testimonials = [
  { text: "Called at 2am with a burst pipe under the kitchen. Tech was at my door in 28 minutes. Unbelievable.", attr: "— R.T., Grosse Pointe Woods" },
  { text: "Fixed what two other plumbers couldn't figure out. Honest pricing, no upsell.", attr: "— D.H., St. Clair Shores" },
  { text: "Water heater died on a Friday afternoon. New one installed same day.", attr: "— K.M., Harper Woods" },
];

const process = [
  { step: "1", title: "Call Us", desc: "24/7 live answer. No phone trees." },
  { step: "2", title: "Fast Dispatch", desc: "Avg 38 min response time." },
  { step: "3", title: "Fix It Right", desc: "Licensed tech, honest price." },
  { step: "4", title: "Guaranteed", desc: "Work backed by full warranty." },
];

const areas = ["Grosse Pointe", "St. Clair Shores", "Harper Woods", "Warren", "Eastpointe", "Roseville", "Clinton Twp", "Sterling Heights", "Royal Oak", "Ferndale"];

/* Animated counter hook */
function useCounter(end: number, duration = 2000, visible = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start * 10) / 10);
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, visible]);
  return val;
}

function CounterStat({ value, suffix, label, Icon, visible }: { value: number; suffix: string; label: string; Icon: any; visible: boolean }) {
  const count = useCounter(value, 1800, visible);
  const display = Number.isInteger(value) ? Math.floor(count) : count.toFixed(1);
  return (
    <div className="text-center">
      <Icon size={20} className="mx-auto mb-2" style={{ color: RED }} />
      <div className="text-2xl md:text-3xl font-extrabold text-white">{display}{suffix}</div>
      <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

const PlumberMockup = () => {
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: "#0b1929" }}>
      <div style={{background:"#1e40af",color:"white",textAlign:"center",padding:"8px",fontSize:"11px",fontWeight:"700",letterSpacing:"0.1em"}}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>
      <style>{`
        @keyframes plumber-drip { 0%,100%{transform:scaleY(0);opacity:0} 50%{transform:scaleY(1);opacity:.6} }
        @keyframes plumber-pulse { 0%{box-shadow:0 0 0 0 rgba(220,38,38,.5)} 70%{box-shadow:0 0 0 12px rgba(220,38,38,0)} 100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} }
      `}</style>

      <Helmet>
        <title>Emergency Plumber Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a 24/7 emergency plumber website looks when built by M² Web Design. Professional lead-generation site for plumbing contractors in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-plumber" />
        <meta property="og:title" content="Emergency Plumber Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional plumber website mockup by M² Web Design. Click-to-call, emergency badges, lead capture forms." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-plumber" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "Plumber Website Demo",
          "description": "Demo plumber website built by M² Web Design for Metro Detroit contractors.",
          "url": "https://www.mattmichelstraining.com/demo-plumber",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: RED, color: "#fff" }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Emergency Banner */}
      <div className="fixed top-0 left-0 right-0 z-[55] text-center py-1.5 text-xs font-bold uppercase tracking-widest" style={{ background: RED, color: "#fff" }}>
        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: "#fff", animation: "plumber-pulse 1.5s infinite" }} />
        PIPE BURST? CALL NOW — {PHONE}
      </div>

      {/* Sticky Header */}
      <header
        className="fixed left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 transition-transform duration-300"
        style={{
          top: 28,
          transform: headerVisible ? "translateY(0)" : "translateY(-150%)",
          background: "rgba(11,25,41,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,.08)"
        }}
      >
        <span className="text-sm font-bold text-white tracking-wide">{BRAND} <span style={{ color: RED }}>PLUMBING</span></span>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: RED, color: "#fff" }}>
          <Phone size={14} /> {PHONE}
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "92vh", paddingTop: "4.5rem" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional copper piping installation" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,25,41,.78), rgba(11,25,41,.94))" }} />
        </div>
        {/* Drip animation */}
        <div className="absolute top-0 left-1/4 w-1 h-16 origin-top z-[1]" style={{ background: "linear-gradient(to bottom, transparent, rgba(59,130,246,.5))", animation: "plumber-drip 3s ease-in-out infinite" }} />
        <div className="absolute top-0 right-1/3 w-1 h-12 origin-top z-[1]" style={{ background: "linear-gradient(to bottom, transparent, rgba(59,130,246,.4))", animation: "plumber-drip 3s ease-in-out infinite 1s" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-4 py-2 rounded-full" style={{ background: "rgba(220,38,38,.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,.3)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: RED, animation: "plumber-pulse 1.5s infinite" }} /> 24/7 Emergency Service
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {BRAND}<br /><span style={{ color: RED }}>PLUMBING</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto">
            Licensed. Fast. No Hidden Fees.<br className="hidden md:block" /> Grosse Pointe &amp; Metro Detroit.
          </p>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-3 text-lg md:text-xl font-extrabold px-10 py-5 rounded-xl transition-transform hover:scale-105"
            style={{ background: RED, color: "#fff", boxShadow: "0 0 40px rgba(220,38,38,.4), 0 0 80px rgba(220,38,38,.15)" }}
          >
            <Phone size={22} /> Tap to Call Now
          </a>
          <p className="mt-4 text-sm text-white/40">{PHONE}</p>
        </div>
      </section>

      {/* Stats with animated counters */}
      <RevealSection className="py-12 px-6" style={{ background: "#0f2035", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div ref={statsRef} className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => <CounterStat key={s.label} {...s} visible={statsVisible} />)}
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

      {/* Our Process */}
      <RevealSection className="py-20 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white">How It Works</h2>
          <p className="text-center text-sm mb-12" style={{ color: "#94a3b8" }}>From call to fix — fast and transparent.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {process.map((p, i) => (
              <div key={p.title} className="relative text-center p-6 rounded-xl" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-extrabold" style={{ background: RED, color: "#fff" }}>{p.step}</div>
                <h3 className="text-base font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{p.desc}</p>
                {i < 3 && <ArrowRight size={16} className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 z-10" style={{ color: "#94a3b8" }} />}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Services */}
      <RevealSection className="py-20 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-white">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map(s => (
              <div key={s.title} className="group rounded-xl overflow-hidden transition-shadow hover:shadow-xl" style={{ background: "#162d4a", border: "1px solid #1e3a5f" }}>
                <div className="h-1.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: s.color }} />
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

      {/* Before/After */}
      <RevealSection className="py-16 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-8">Recent Work</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {["Emergency pipe repair — Grosse Pointe Woods", "Full water heater replacement — St. Clair Shores"].map((label) => (
              <div key={label} className="rounded-xl overflow-hidden" style={{ background: "#0b1929", border: "1px solid #1e3a5f" }}>
                <div className="grid grid-cols-2 relative">
                  <div className="relative">
                    <img src="https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80" alt="Before repair" className="w-full object-cover" style={{ aspectRatio: "4/3" }} />
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: "rgba(220,38,38,.85)", color: "#fff" }}>BEFORE</span>
                  </div>
                  <div className="relative">
                    <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" alt="After repair" className="w-full object-cover" style={{ aspectRatio: "4/3" }} />
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: "rgba(34,197,94,.85)", color: "#fff" }}>AFTER</span>
                  </div>
                </div>
                <p className="text-xs text-center py-3" style={{ color: "#64748b" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#0b1929" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: "#0f2035", border: "1px solid #1e3a5f" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={RED} color={RED} />)}
                </div>
                <p className="italic text-sm text-white/70 mb-2">"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Service Area */}
      <RevealSection className="py-16 px-6" style={{ background: "#0f2035" }}>
        <div className="max-w-4xl mx-auto text-center">
          <MapPin size={28} className="mx-auto mb-4" style={{ color: RED }} />
          <h2 className="text-2xl font-bold text-white mb-3">Service Area</h2>
          <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>Proudly serving the east side and greater Metro Detroit.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {areas.map(a => (
              <span key={a} className="px-4 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(220,38,38,.1)", color: "#fca5a5", border: "1px solid rgba(220,38,38,.2)" }}>{a}</span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Footer / Lead Form */}
      <footer id="quote-form" className="px-6 py-16" style={{ background: "#081321", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Request Service</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Fill out the form and we'll call you back — usually within 15 minutes.</p>
            {sent ? (
              <p className="text-lg" style={{ color: "#22c55e" }}>✅ Message received! We'll call you back shortly.</p>
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
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: RED, color: "#fff" }}>
                  Send Request
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                {["Emergency Repairs", "Water Heaters", "Drain Cleaning", "Sewer Lines", "Bathroom Remodels"].map(s => (
                  <li key={s} className="flex items-center gap-2"><CheckCircle size={14} style={{ color: RED }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Hours</h3>
              <p className="text-sm">Emergency: <span className="text-white font-semibold">24/7/365</span></p>
              <p className="text-sm mt-1">Office: Mon–Fri 7am–6pm | Sat 8am–2pm</p>
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg" style={{ background: RED, color: "#fff" }}>
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color: "#475569" }}>© 2026 {BRAND}. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PlumberMockup;
