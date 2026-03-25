import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Droplets, Wind, Activity, Eye, Shield, Wrench,
  ChevronRight, Phone, Mail, MapPin, Menu, X,
  CheckCircle2, Package, Cog, Factory, ArrowRight,
} from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const solutions = [
  { icon: Droplets, title: "Hydraulics & Lubrication", text: "High-pressure fluid power systems designed for maximum uptime and durability in demanding environments.", color: "#0ea5e9" },
  { icon: Wind, title: "Pneumatics & Conveyance", text: "Efficient air-driven automation, vacuum handling, and conveyance components for every throughput requirement.", color: "#0ea5e9" },
  { icon: Activity, title: "Motion Control", text: "Precision servos, VFDs, linear actuators, and highly accurate multi-axis positioning systems.", color: "#0ea5e9" },
  { icon: Eye, title: "Robotics & Vision", text: "Cobots, industrial robots, machine vision, and barcode inspection for automated assembly and quality control.", color: "#0ea5e9" },
  { icon: Shield, title: "Safety, Sensing & Vision", text: "Light curtains, safety PLCs, photoelectric sensors, and 2D/3D vision systems for operator protection.", color: "#0ea5e9" },
  { icon: Wrench, title: "Custom Engineered Solutions", text: "From concept to commissioning — turnkey panels, manifolds, and integrated motion sub-assemblies.", color: "#f97316" },
];

const manufacturers = [
  "ABB", "SICK", "Universal Robots", "Yaskawa", "Eaton", "Parker",
  "Bosch Rexroth", "Emerson", "SMC", "Festo", "Schunk", "Robotiq",
  "IAI", "Thomson", "Kollmorgen", "Norgren", "HydraForce", "Graco",
  "MTS", "Murr Elektronik",
];

const industries = [
  "Automotive", "Aerospace & Defense", "Food & Packaging", "Medical",
  "Steel & Heavy Industry", "Factory Automation", "Consumer Goods",
  "Mobile Equipment", "Robotics Integration",
];

const stats = [
  { value: "12", label: "Weeks Avg Lead Time" },
  { value: "3", label: "Integrated Systems" },
  { value: "99.2%", label: "Uptime Achieved" },
  { value: "Warren", label: "Michigan HQ" },
];

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

      {/* ── Inline keyframes ── */}
      <style>{`
        @keyframes yb-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes yb-spin-slow { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes yb-spin-rev  { 0%{transform:rotate(360deg)} 100%{transform:rotate(0)} }
        @keyframes yb-pulse-ring { 0%{transform:scale(1);opacity:.25} 100%{transform:scale(1.6);opacity:0} }
        .yb-heading { font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
      `}</style>

      {/* ── Demo Badge ── */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: "#f97316", color: "#0a0f1a" }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  1. STICKY HEADER                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      <header
        className="fixed inset-x-0 top-0 z-50 transition-transform duration-300"
        style={{
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(10,15,26,.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          {/* Logo */}
          <div className="flex flex-col leading-none">
            <span className="yb-heading text-base tracking-[0.2em] uppercase text-white">
              YOUNGBLOOD <span className="text-[#0ea5e9]">|</span> AUTOMATION
            </span>
            <span className="text-[9px] tracking-[0.15em] uppercase text-[#94a3b8]">A Division of H&P Technologies</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
            {["Solutions", "Manufacturers", "Engineering", "Resources", "About"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-white transition-colors">{l}</a>
            ))}
          </nav>

          {/* CTA cluster */}
          <div className="hidden lg:flex items-center gap-3">
            <a href="tel:5867550200" className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-widest border rounded text-[#94a3b8] hover:text-white hover:border-white/30 transition-colors" style={{ borderColor: "rgba(255,255,255,.15)" }}>
              <Phone size={14} /> (586) 755-0200
            </a>
            <a href="#contact" className="px-5 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors" style={{ background: "#f97316", color: "#0a0f1a" }}>
              Request a Quote
            </a>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden text-white p-2">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden px-6 pb-6 space-y-4" style={{ background: "rgba(10,15,26,.97)" }}>
            {["Solutions", "Manufacturers", "Engineering", "Resources", "About", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block text-sm font-semibold uppercase tracking-widest text-[#94a3b8] hover:text-white">{l}</a>
            ))}
            <a href="tel:5867550200" className="block text-sm font-semibold text-[#0ea5e9]">(586) 755-0200</a>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  2. HERO                                                    */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: "radial-gradient(circle, rgba(14,165,233,.08) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider mb-8" style={{ background: "rgba(14,165,233,.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,.2)" }}>
              <Factory size={14} /> 50+ Years · Warren, MI
            </div>

            <h1 className="yb-heading text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-6 text-white">
              Precision Motion.<br />
              Infinite Scale.<br />
              <span style={{ color: "#0ea5e9" }}>Total Automation.</span>
            </h1>

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
      <RevealSection id="solutions" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center" style={{ color: "#0ea5e9" }}>What We Do</p>
          <h2 className="yb-heading text-4xl sm:text-5xl text-center mb-16 text-white">Engineered Solutions</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {solutions.map((s) => (
              <div key={s.title} className="group relative rounded-xl p-8 transition-all duration-300 overflow-hidden" style={{ background: "#111827", border: "1px solid rgba(255,255,255,.06)" }}>
                {/* Top-border accent on hover */}
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
      {/*  4. MANUFACTURER MARQUEE                                    */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="manufacturers" className="py-16 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,.04)", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <p className="text-center text-sm mb-8" style={{ color: "#94a3b8" }}>
          Authorized distributor for <span className="font-bold text-[#0ea5e9]">60+</span> industry-leading manufacturers
        </p>
        <div className="relative group">
          <div className="flex whitespace-nowrap group-hover:[animation-play-state:paused]" style={{ animation: "yb-marquee 40s linear infinite" }}>
            {[...manufacturers, ...manufacturers].map((m, i) => (
              <span key={`${m}-${i}`} className="mx-8 text-xs font-semibold uppercase tracking-[0.2em] shrink-0" style={{ color: "rgba(255,255,255,.2)" }}>{m}</span>
            ))}
          </div>
        </div>
      </section>

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
              <div key={v.title} className="text-center p-8 rounded-xl" style={{ background: "#111827", border: "1px solid rgba(255,255,255,.06)" }}>
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
              <span key={ind} className="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors hover:text-white" style={{ background: "#111827", color: "#94a3b8", border: "1px solid rgba(255,255,255,.08)" }}>
                {ind}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  7. CASE STUDY TEASER                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection className="py-28 px-6" style={{ background: "#111827" }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#f97316" }}>Case Study</p>
          <blockquote className="yb-heading text-2xl sm:text-3xl lg:text-4xl leading-snug mb-12 text-white">
            "Youngblood replaced three separate vendor relationships with a single integrated pneumatic and hydraulic package — cutting our procurement cycle in half."
          </blockquote>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="p-5 rounded-xl" style={{ background: "rgba(10,15,26,.6)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div className="yb-heading text-3xl mb-1" style={{ color: "#0ea5e9" }}>{s.value}</div>
                <div className="text-xs uppercase tracking-widest" style={{ color: "#94a3b8" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  8. CONTACT SECTION                                         */}
      {/* ════════════════════════════════════════════════════════════ */}
      <RevealSection id="contact" className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16">
          {/* Form */}
          <div>
            <h2 className="yb-heading text-3xl sm:text-4xl mb-3 text-white">Contact Engineering</h2>
            <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>Tell us about your application and our team will follow up within one business day.</p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input placeholder="Your Name" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }} />
                <input placeholder="Company" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <input placeholder="Phone" type="tel" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }} />
                <input placeholder="Email" type="email" className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }} />
              </div>
              <textarea placeholder="Describe your application or requirements…" rows={5} className="w-full rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none resize-none transition-colors" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }} />
              <button type="submit" className="w-full sm:w-auto px-10 py-4 text-sm font-bold uppercase tracking-widest rounded transition-colors" style={{ background: "#f97316", color: "#0a0f1a" }}>
                Submit Inquiry
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col justify-center gap-8">
            <div>
              <h3 className="yb-heading text-xl mb-4 text-white">Youngblood Automation</h3>
              <div className="space-y-3 text-sm" style={{ color: "#94a3b8" }}>
                <p className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "#0ea5e9" }} /> 23751 Amber Ave<br />Warren, MI 48089</p>
                <p className="flex items-center gap-3"><Phone size={16} style={{ color: "#0ea5e9" }} /> <a href="tel:5867550200" className="hover:text-white transition-colors">(586) 755-0200</a></p>
                <p className="flex items-center gap-3"><Mail size={16} style={{ color: "#0ea5e9" }} /> <a href="mailto:sales@youngbloodautomation.com" className="hover:text-white transition-colors">sales@youngbloodautomation.com</a></p>
              </div>
            </div>
            <div className="p-6 rounded-xl" style={{ background: "#111827", border: "1px solid rgba(255,255,255,.06)" }}>
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
      {/*  9. FOOTER                                                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      <footer className="py-16 px-6" style={{ background: "#070b14", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1 */}
          <div>
            <span className="yb-heading text-sm tracking-[0.2em] uppercase text-white">YOUNGBLOOD <span style={{ color: "#0ea5e9" }}>|</span> AUTOMATION</span>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "#94a3b8" }}>A Division of H&P Technologies. Advanced fluid power, pneumatics, motion control, and robotic integration since 1972.</p>
          </div>
          {/* Col 2 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] mb-4 text-white">Solutions</h4>
            <ul className="space-y-2 text-xs" style={{ color: "#94a3b8" }}>
              {["Hydraulics & Lubrication", "Pneumatics & Conveyance", "Motion Control", "Robotics & Vision", "Safety & Sensing"].map((s) => (
                <li key={s}><a href="#solutions" className="hover:text-white transition-colors">{s}</a></li>
              ))}
            </ul>
          </div>
          {/* Col 3 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] mb-4 text-white">Resources</h4>
            <ul className="space-y-2 text-xs" style={{ color: "#94a3b8" }}>
              {["3D CAD Library", "Product Catalog", "Application Notes", "Training Videos", "Careers"].map((s) => (
                <li key={s}><a href="#" className="hover:text-white transition-colors">{s}</a></li>
              ))}
            </ul>
          </div>
          {/* Col 4 */}
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
          <p className="text-xs" style={{ color: "rgba(255,255,255,.2)" }}>&copy; 2026 Youngblood Automation, a division of H&P Technologies. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.15)" }}>
            Redesign concept by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default YoungbloodMockup;
