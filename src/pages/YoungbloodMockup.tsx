import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Droplets, Wind, Cpu, Eye, Shield, Wrench,
  ChevronRight, Phone, Mail, MapPin, Menu, X,
  CheckCircle2, Package, Cog, Factory, ArrowRight,
} from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const solutions = [
  { icon: Wind, title: "Pneumatics", text: "Custom manifolds and electro-pneumatic panels featuring Emerson and SMC technology.", color: "#0ea5e9" },
  { icon: Droplets, title: "Hydraulics", text: "Mobile and industrial power units designed by H&P Technologies' core engineering team.", color: "#0ea5e9" },
  { icon: Cpu, title: "Robotics", text: "Certified Universal Robots integrator specializing in machine tending and end-of-arm tooling.", color: "#f97316" },
  { icon: Eye, title: "Sensing", text: "Advanced vision and safety systems powered by SICK Sensor Intelligence.", color: "#0ea5e9" },
];

const tier1Partners = [
  { name: "SICK", subtitle: "Sensor Intelligence" },
  { name: "EATON", subtitle: "Fluid Power" },
  { name: "EMERSON", subtitle: "Pneumatics" },
  { name: "UNIVERSAL ROBOTS", subtitle: "Cobots" },
];

const manufacturers = [
  "ABB", "Yaskawa", "Parker", "Bosch Rexroth", "SMC", "Festo",
  "Schunk", "Robotiq", "IAI", "Thomson", "Kollmorgen", "Norgren",
  "HydraForce", "Graco", "MTS", "Murr Elektronik",
];

const industries = [
  "Automotive", "Aerospace & Defense", "Food & Packaging", "Medical",
  "Steel & Heavy Industry", "Factory Automation", "Consumer Goods",
  "Mobile Equipment", "Robotics Integration",
];

const locations = [
  { city: "Warren, MI", role: "Corporate HQ & Engineering Center" },
  { city: "Grand Rapids, MI", role: "Western Michigan Hub" },
  { city: "Indianapolis, IN", role: "Central Indiana Regional Office" },
  { city: "Dayton, OH", role: "Ohio Valley Automation Lab" },
];

const stats = [
  { value: "1964", label: "Established" },
  { value: "4", label: "Regional Offices" },
  { value: "99.2%", label: "Uptime Achieved" },
  { value: "60+", label: "Manufacturer Lines" },
];

const glassCard = "bg-slate-900/40 backdrop-blur-md border border-white/10";

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const YoungbloodMockup = () => {
  const [menuOpen, setMenuOpen] = useState(false);
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
    <div className="min-h-screen text-[#f1f5f9] antialiased" style={{ background: "#0a0f1a", fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>Youngblood Automation Redesign Concept | M² Web Design Detroit</title>
        <meta name="description" content="See how an industrial automation distributor website looks when redesigned by M² Web Design. Enterprise-grade demo for Youngblood Automation." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-youngblood" />
        <meta property="og:title" content="Youngblood Automation Redesign | M² Web Design Detroit" />
        <meta property="og:description" content="Enterprise automation website redesign concept by M² Web Design. Precision engineering meets modern web design." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-youngblood" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ── Inline keyframes ── */}
      <style>{`
        @keyframes yb-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes yb-spin-slow { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes yb-spin-rev  { 0%{transform:rotate(360deg)} 100%{transform:rotate(0)} }
        @keyframes yb-pulse-ring { 0%{transform:scale(1);opacity:.25} 100%{transform:scale(1.6);opacity:0} }
        .yb-heading { font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
      `}</style>

      {/* ── Demo Banner ── */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background: "#0ea5e9", color: "#0a0f1a" }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* ── Alt Design Switcher ── */}
      <div className="fixed bottom-5 left-4 z-[60] hidden lg:block">
        <div className="rounded-xl overflow-hidden text-xs" style={{ background: "rgba(10,15,26,.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.1)", minWidth: 210 }}>
          <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,.07)" }}>
            <p className="font-bold uppercase tracking-widest text-[10px]" style={{ color: "#0ea5e9" }}>See Other Designs</p>
          </div>
          <div className="p-2 space-y-1">
            {[
              { to: "/demo-youngblood", label: "Dark / Blue — Current", active: true },
              { to: "/demo-youngblood-alt1", label: "Steel & Fire (White/Red)" },
              { to: "/demo-youngblood-alt2", label: "Precision Grid (Cyber)" },
            ].map(d => (
              <Link
                key={d.to}
                to={d.to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full"
                style={{ background: d.active ? "rgba(249,115,22,.15)" : "transparent", color: d.active ? "#f97316" : "rgba(255,255,255,.5)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.active ? "#f97316" : "rgba(255,255,255,.2)" }} />
                {d.label}
              </Link>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,.07)" }}>
            <a href="tel:3138064952" className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.3)" }}>Matt — (313) 806-4952</a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  1. STICKY HEADER                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      <header
        className="fixed inset-x-0 top-8 z-50 transition-transform duration-300"
        style={{
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(10,15,26,.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex flex-col leading-none">
            <span className="yb-heading text-base tracking-[0.2em] uppercase text-white">
              YOUNGBLOOD <span className="text-[#0ea5e9]">|</span> AUTOMATION
            </span>
            <span className="text-[9px] tracking-[0.15em] uppercase text-[#94a3b8]">A Division of H&P Technologies</span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
            {["Solutions", "Partners", "Engineering", "Locations", "About"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-white transition-colors">{l}</a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a href="#" className="px-4 py-2 text-xs font-semibold uppercase tracking-widest border rounded text-[#94a3b8] hover:text-white hover:border-white/30 transition-colors" style={{ borderColor: "rgba(255,255,255,.15)" }}>
              Legacy Partner Portal
            </a>
            <a href="tel:5867550200" className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-widest border rounded text-[#94a3b8] hover:text-white hover:border-white/30 transition-colors" style={{ borderColor: "rgba(255,255,255,.15)" }}>
              <Phone size={14} /> (586) 755-0200
            </a>
            <a href="#contact" className="px-5 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors" style={{ background: "#f97316", color: "#0a0f1a" }}>
              Request a Quote
            </a>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden text-white p-2">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden px-6 pb-6 space-y-4" style={{ background: "rgba(10,15,26,.97)" }}>
            {["Solutions", "Partners", "Engineering", "Locations", "About", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block text-sm font-semibold uppercase tracking-widest text-[#94a3b8] hover:text-white">{l}</a>
            ))}
            <a href="#" onClick={() => setMenuOpen(false)} className="block text-sm font-semibold uppercase tracking-widest text-[#94a3b8] hover:text-white border border-white/15 rounded px-4 py-2 w-fit">Legacy Partner Portal</a>
            <a href="tel:5867550200" className="block text-sm font-semibold text-[#0ea5e9]">(586) 755-0200</a>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  2. HERO                                                    */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80"
            alt="Modern factory floor"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0a0f1a]/80" />
        </div>
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: "radial-gradient(circle, rgba(14,165,233,.08) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider mb-8" style={{ background: "rgba(14,165,233,.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,.2)" }}>
              <Factory size={14} /> Established 1964 · Warren, MI
            </div>

            <h1 className="yb-heading text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-4 text-white">
              Precision Motion.<br />
              Infinite Scale.<br />
              <span style={{ color: "#0ea5e9" }}>Total Automation.</span>
            </h1>

            <p className="text-base sm:text-lg mb-8 max-w-xl" style={{ color: "#94a3b8" }}>
              Engineered Solutions for Motion Control, Fluid Power, and Robotic Integration.
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8 text-sm text-[#94a3b8]">
              {["Stocking Distributor", "Application Engineering", "Custom Manufacturing"].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#0ea5e9]" />{t}</span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#solutions" className="px-8 py-4 text-sm font-bold uppercase tracking-widest rounded text-center transition-colors" style={{ background: "#f97316", color: "#0a0f1a" }}>
                Explore Our Solutions
              </a>
              <a href="#contact" className="px-8 py-4 text-sm font-bold uppercase tracking-widest rounded text-center transition-colors border" style={{ borderColor: "#0ea5e9", color: "#0ea5e9" }}>
                Talk to an Engineer
              </a>
            </div>
          </div>

          {/* Right — Concentric Circles */}
          <div className="hidden lg:flex items-center justify-center relative" style={{ height: 420 }}>
            {[280, 200, 120].map((size, i) => (
              <div
                key={size}
                className="absolute rounded-full"
                style={{
                  width: size, height: size,
                  border: `1px solid rgba(14,165,233,${0.12 + i * 0.08})`,
                  animation: `${i % 2 === 0 ? "yb-spin-slow" : "yb-spin-rev"} ${60 - i * 15}s linear infinite`,
                }}
              />
            ))}
            <div className="absolute w-3 h-3 rounded-full" style={{ background: "#0ea5e9", boxShadow: "0 0 20px #0ea5e9" }} />
            <div className="absolute w-20 h-20 rounded-full" style={{ animation: "yb-pulse-ring 3s ease-out infinite", border: "1px solid rgba(14,165,233,.3)" }} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  3. SOLUTION CATEGORIES                                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="solutions" className="relative py-28 px-6 overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1565515152650-612b3e2441af?auto=format&fit=crop&q=80"
            alt="Robotic arm"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0a0f1a]/90" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>What We Do</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-16 text-white">Engineered Solutions</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {solutions.map((s) => (
              <div key={s.title} className={`group relative rounded-xl p-8 transition-all duration-300 overflow-hidden ${glassCard}`}>
                <div className="absolute top-0 inset-x-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: s.color }} />
                <s.icon size={36} strokeWidth={1.5} className="mb-5" style={{ color: s.color }} />
                <h3 className="yb-heading text-xl mb-2 text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "#94a3b8" }}>{s.text}</p>
                <a href="#contact" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest group-hover:gap-2 transition-all" style={{ color: "#0ea5e9" }}>
                  Explore <ChevronRight size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  4. TIER 1 PARTNERS                                         */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="partners" className="py-20 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>Strategic Alliances</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-12 text-white">Tier 1 Partners</h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {tier1Partners.map((p) => (
              <div key={p.name} className={`rounded-xl p-6 text-center ${glassCard}`}>
                <div className="yb-heading text-2xl mb-1 text-white">{p.name}</div>
                <div className="text-xs uppercase tracking-widest" style={{ color: "#0ea5e9" }}>{p.subtitle}</div>
              </div>
            ))}
          </div>

          {/* Remaining manufacturers marquee */}
          <p className="text-center text-sm mb-6" style={{ color: "#94a3b8" }}>
            Plus <span className="font-bold text-[#0ea5e9]">60+</span> additional manufacturer lines
          </p>
          <div className="relative overflow-hidden group">
            <div className="flex whitespace-nowrap group-hover:[animation-play-state:paused]" style={{ animation: "yb-marquee 40s linear infinite" }}>
              {[...manufacturers, ...manufacturers].map((m, i) => (
                <span key={`${m}-${i}`} className="mx-8 text-xs font-semibold uppercase tracking-[0.2em] shrink-0" style={{ color: "rgba(255,255,255,.2)" }}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  4b. ENGINEERING SHOWCASE (Real Images)                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>From Our Floor</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-16 text-white">Built In-House</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { src: "/images/engineered-cell.jpg", title: "Custom Engineered Solutions", text: "Turnkey robotic cells and safety enclosures designed, built, and commissioned by our integration team." },
              { src: "/images/hydraulics-actual.jpg", title: "Hydraulics & Lubrication", text: "Mobile and industrial hydraulic power units engineered by H&P Technologies' core team." },
              { src: "/images/robotic-arm-actual.jpg", title: "Robotics & Vision", text: "Certified Universal Robots integrator — machine tending, end-of-arm tooling, and SICK vision systems." },
            ].map((item) => (
              <div key={item.title} className={`rounded-xl overflow-hidden group ${glassCard}`}>
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={item.src} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                </div>
                <div className="p-6">
                  <h3 className="yb-heading text-lg text-white mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  5. VALUE PROPOSITION                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>Why Youngblood</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-16 text-white">Not Just a Parts House</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Package, title: "Stocking Distributor", text: "Thousands of SKUs ready to ship from our Warren, MI warehouse. No waiting on overseas lead times for critical components." },
              { icon: Cog, title: "Application Engineering", text: "Our engineers spec, size, and validate every solution. We don't just sell parts — we solve problems alongside your team." },
              { icon: Factory, title: "Custom Manufacturing", text: "In-house manifold machining, panel building, and sub-assembly. From prototype to production-ready, under one roof." },
            ].map((v) => (
              <div key={v.title} className={`text-center p-8 rounded-xl ${glassCard}`}>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5" style={{ background: "rgba(14,165,233,.1)" }}>
                  <v.icon size={28} style={{ color: "#0ea5e9" }} />
                </div>
                <h3 className="yb-heading text-xl mb-3 text-white">{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  6. INDUSTRIES SERVED                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="engineering" className="py-20 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#0ea5e9" }}>Industries</p>
          <h2 className="yb-heading text-4xl sm:text-5xl mb-10 text-white">Built for Every Floor</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((ind) => (
              <span key={ind} className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:text-white ${glassCard}`} style={{ color: "#94a3b8" }}>
                {ind}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  7. REGIONAL FOOTPRINT                                      */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="locations" className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>Our Reach</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-16 text-white">Regional Powerhouse</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {locations.map((loc) => (
              <div key={loc.city} className={`rounded-xl p-6 text-center ${glassCard}`}>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-4" style={{ background: "rgba(14,165,233,.1)" }}>
                  <MapPin size={20} style={{ color: "#0ea5e9" }} />
                </div>
                <h3 className="yb-heading text-lg text-white mb-1">{loc.city}</h3>
                <p className="text-xs uppercase tracking-widest" style={{ color: "#94a3b8" }}>{loc.role}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  8. CASE STUDY TEASER                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection className="py-28 px-6 bg-slate-900/40">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#f97316" }}>Case Study</p>
          <blockquote className="yb-heading text-2xl sm:text-3xl lg:text-4xl leading-snug mb-12 text-white">
            "Youngblood replaced three separate vendor relationships with a single integrated pneumatic and hydraulic package — cutting our procurement cycle in half."
          </blockquote>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className={`p-5 rounded-xl ${glassCard}`}>
                <div className="yb-heading text-3xl mb-1" style={{ color: "#0ea5e9" }}>{s.value}</div>
                <div className="text-xs uppercase tracking-widest" style={{ color: "#94a3b8" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  9. CONTACT SECTION                                         */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="contact" className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#f97316" }}>Request a Quote</p>
            <h2 className="yb-heading text-3xl sm:text-4xl mb-3 text-white">Talk to an Application Engineer</h2>
            <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>Describe your application below and our engineering team will respond within one business day with sizing recommendations and pricing.</p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Your Name</label>
                  <input placeholder="John Smith" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Company</label>
                  <input placeholder="Acme Manufacturing" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Phone</label>
                  <input placeholder="(586) 555-0100" type="tel" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Email</label>
                  <input placeholder="you@company.com" type="email" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Product Category</label>
                <select className="w-full rounded px-4 py-3 text-sm text-white/80 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors">
                  <option value="" style={{ background: "#0a0f1a" }}>Select a product line…</option>
                  {["Pneumatics — Manifolds & Valves", "Pneumatics — Electro-Pneumatic Panels", "Hydraulics — Industrial Power Units", "Hydraulics — Mobile Systems", "Robotics — Universal Robots Cobot", "Robotics — End-of-Arm Tooling (EOAT)", "Sensing — Safety Systems (SICK)", "Sensing — Vision Systems", "Motion Control — Linear Actuators", "Motion Control — Servo Drives", "Custom Manifold Machining", "Panel Building & Sub-Assembly", "Not Sure — Need Engineering Guidance"].map(opt => (
                    <option key={opt} value={opt} style={{ background: "#0a0f1a" }}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Estimated Quantity</label>
                  <select className="w-full rounded px-4 py-3 text-sm text-white/80 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors">
                    <option style={{ background: "#0a0f1a" }}>1–5 units</option>
                    <option style={{ background: "#0a0f1a" }}>6–25 units</option>
                    <option style={{ background: "#0a0f1a" }}>26–100 units</option>
                    <option style={{ background: "#0a0f1a" }}>100+ / Production Volume</option>
                    <option style={{ background: "#0a0f1a" }}>Ongoing / Stocking Agreement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Timeline / Urgency</label>
                  <select className="w-full rounded px-4 py-3 text-sm text-white/80 focus:outline-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors">
                    <option style={{ background: "#0a0f1a" }}>Immediate — Line Down</option>
                    <option style={{ background: "#0a0f1a" }}>Within 1 Week</option>
                    <option style={{ background: "#0a0f1a" }}>2–4 Weeks</option>
                    <option style={{ background: "#0a0f1a" }}>1–3 Months (New Project)</option>
                    <option style={{ background: "#0a0f1a" }}>Exploring / Budgeting</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#64748b" }}>Application Description</label>
                <textarea placeholder="Describe your application, existing equipment, operating conditions, pressure/flow requirements, or any specs we should know…" rows={4} className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none resize-none bg-white/[0.04] border border-white/10 focus:border-[#0ea5e9]/40 transition-colors" />
              </div>
              <button type="submit" className="w-full sm:w-auto px-10 py-4 text-sm font-bold uppercase tracking-widest rounded transition-opacity hover:opacity-90" style={{ background: "#f97316", color: "#0a0f1a" }}>
                Submit RFQ
              </button>
            </form>
          </div>

          <div className="flex flex-col justify-center gap-8">
            <div>
              <h3 className="yb-heading text-xl mb-4 text-white">Youngblood Automation</h3>
              <div className="space-y-3 text-sm" style={{ color: "#94a3b8" }}>
                <p className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "#0ea5e9" }} /> 23751 Amber Ave<br />Warren, MI 48089</p>
                <p className="flex items-center gap-3"><Phone size={16} style={{ color: "#0ea5e9" }} /> <a href="tel:5867550200" className="hover:text-white transition-colors">(586) 755-0200</a></p>
                <p className="flex items-center gap-3"><Mail size={16} style={{ color: "#0ea5e9" }} /> <a href="mailto:sales@youngbloodautomation.com" className="hover:text-white transition-colors">sales@youngbloodautomation.com</a></p>
              </div>
            </div>
            <div className={`p-6 rounded-xl ${glassCard}`}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "#f97316" }}>Legacy Portal</p>
              <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>Access 10,000+ parts, download 3D CAD models, and manage your account.</p>
              <a href="#" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest hover:gap-3 transition-all" style={{ color: "#0ea5e9" }}>
                Enter Portal <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  10. FOOTER                                                 */}
      {/* ════════════════════════════════════════════════════════════ */}
      <footer className="py-16 px-6" style={{ background: "#070b14", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <span className="yb-heading text-sm tracking-[0.2em] uppercase text-white">YOUNGBLOOD <span style={{ color: "#0ea5e9" }}>|</span> AUTOMATION</span>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "#94a3b8" }}>A Division of H&P Technologies. Established 1964. Advanced fluid power, pneumatics, motion control, and robotic integration.</p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] mb-4 text-white">Solutions</h4>
            <ul className="space-y-2 text-xs" style={{ color: "#94a3b8" }}>
              {["Pneumatics", "Hydraulics", "Robotics", "Sensing"].map((s) => (
                <li key={s}><a href="#solutions" className="hover:text-white transition-colors">{s}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] mb-4 text-white">Resources</h4>
            <ul className="space-y-2 text-xs" style={{ color: "#94a3b8" }}>
              {["3D CAD Library", "Product Catalog", "Application Notes", "Training Videos", "Careers"].map((s) => (
                <li key={s}><a href="#" className="hover:text-white transition-colors">{s}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] mb-4 text-white">Contact</h4>
            <div className="space-y-2 text-xs" style={{ color: "#94a3b8" }}>
              <p>23751 Amber Ave, Warren, MI 48089</p>
              <p>(586) 755-0200</p>
              <p>sales@youngbloodautomation.com</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.2)" }}>&copy; 2026 Youngblood Automation, a division of H&P Technologies. Established 1964. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Redesign concept by{" "}
            <Link to="/manufacturing-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default YoungbloodMockup;
