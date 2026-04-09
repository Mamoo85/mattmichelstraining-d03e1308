import { Link } from "react-router-dom";
import { Globe, PhoneForwarded, ShieldCheck, Search, Monitor, Wrench, ArrowRight, CheckCircle, Zap, BarChart3, Clock, Phone, Star, Code, Palette, Smartphone } from "lucide-react";
import dwaLogo from "@/assets/dwa-matrix-logo.png";
import { Button } from "@/components/ui/button";
import MissedRevenueCalculator from "@/components/agency/MissedRevenueCalculator";
import HowItWorks from "@/components/agency/HowItWorks";
import TerminalAnimation from "@/components/agency/TerminalAnimation";
import BeforeAfterSlider from "@/components/agency/BeforeAfterSlider";
import CaseStudyAuditTrail from "@/components/agency/CaseStudyAuditTrail";
import BareMetalDNA from "@/components/agency/BareMetalDNA";
import LocalFootprintMap from "@/components/agency/LocalFootprintMap";
import LocalGuaranteeBlock from "@/components/agency/LocalGuaranteeBlock";
import AgencyFAQ from "@/components/agency/AgencyFAQ";
import UptimeBar from "@/components/agency/UptimeBar";
import ExitIntentModal from "@/components/agency/ExitIntentModal";
import StickyMobileCTA from "@/components/agency/StickyMobileCTA";

const services = [
  { icon: Globe, title: "Custom Web Design", desc: "High-performance websites engineered to convert visitors into paying customers. Our #1 service.", link: "/web-design-services", featured: true },
  { icon: Code, title: "Web Development", desc: "Clean code, fast load times, mobile-first. Built with modern frameworks that scale.", link: "/web-design-services", featured: true },
  { icon: PhoneForwarded, title: "24/7 Call Routing Engine", desc: "Never miss a call. Automated voice system answers, qualifies, and books leads.", link: "/ai-phone-answering" },
  { icon: ShieldCheck, title: "SEO Guard", desc: "Weekly monitoring so Google never loses track of your business.", link: "/seo-guard" },
  { icon: Search, title: "Free Site Diagnostic", desc: "Our automated scanner reveals exactly what's costing you leads.", link: "/ai-website-audit" },
  { icon: Monitor, title: "Review Command Center", desc: "Monitor reviews, respond instantly, build 5-star social proof.", link: "/ai-reputation-dashboard" },
];

const stats = [
  { value: "100+", label: "Websites Built", icon: Globe },
  { value: "$0", label: "Site Diagnostic", icon: Search },
  { value: "24/7", label: "Call Engine", icon: Clock },
  { value: "7-Day", label: "Free Trials", icon: BarChart3 },
];

const trustItems = [
  "Endorsed by local Michigan businesses",
  "Built with modern server-side rendering",
  "Enterprise-grade security & uptime",
  "GDPR & CCPA compliant infrastructure",
];

const SOCIAL_PROOF_AVATARS = [
  { initials: "MR", color: "#2563eb" },
  { initials: "JK", color: "#16a34a" },
  { initials: "AB", color: "#d97706" },
  { initials: "TS", color: "#9333ea" },
  { initials: "KL", color: "#dc2626" },
];

const webDesignFeatures = [
  { icon: Palette, title: "Custom Design", desc: "No templates. Every pixel is crafted for your brand and industry." },
  { icon: Smartphone, title: "Mobile-First", desc: "60% of your leads are on phones. We build for that reality." },
  { icon: Zap, title: "Lightning Fast", desc: "Sub-2-second load times. Google rewards speed with rankings." },
  { icon: BarChart3, title: "Conversion-Optimized", desc: "Strategic CTAs, trust signals, and lead capture built in." },
];

const AgencyHome = () => (
  <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
    {/* 1. Hero — Web Design Forward */}
    <section id="agency-hero" className="relative overflow-hidden pt-28 pb-20 md:pt-40 md:pb-32">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0a0f 100%)" }} />
      {/* Matrix-style falling code background */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(6,182,212,0.1) 0%, transparent 70%)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)", filter: "blur(80px)" }} />

      <div className="relative container max-w-5xl mx-auto px-4 text-center">
        {/* DWA Matrix Logo */}
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 rounded-full" style={{ background: "rgba(6,182,212,0.15)", transform: "scale(1.5)", filter: "blur(60px)" }} />
          <img
            src={dwaLogo}
            alt="Detroit Web Agency"
            width={1024}
            height={1024}
            fetchPriority="high"
            decoding="sync"
            className="relative w-48 md:w-60 h-auto object-contain drop-shadow-[0_0_40px_rgba(34,211,238,0.3)]"
          />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-4 uppercase" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>
          Websites That{" "}
          <span style={{ color: "#22d3ee", textShadow: "0 0 40px rgba(6,182,212,0.4)" }}>Convert.</span>
        </h1>
        <p className="text-xl sm:text-2xl font-semibold mb-4 tracking-wide" style={{ color: "#94a3b8" }}>
          Detroit's Premier Web Design Agency.
        </p>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "#64748b" }}>
          Custom-built websites and automated lead systems for Michigan contractors and businesses. We design, develop, and deploy — you get booked jobs.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg transition-all duration-300 uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)" }}>
            <Link to="/web-design-services">
              Start Your Website Project <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-10 py-6 text-base font-semibold rounded-lg transition-all duration-300 hover:bg-white/5" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.25)", color: "#e2e8f0" }}>
            <a href="tel:+13138064952">
              <Phone className="mr-2 h-4 w-4" /> Call (313) 806-4952
            </a>
          </Button>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <div className="flex -space-x-2">
            {SOCIAL_PROOF_AVATARS.map((a) => (
              <div key={a.initials} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white" style={{ borderColor: "#0a0a0f", background: a.color }}>
                {a.initials}
              </div>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-0.5 mb-0.5">
              {SOCIAL_PROOF_AVATARS.map((a) => (
                <Star key={a.initials} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
              Trusted by <span style={{ color: "#e2e8f0" }} className="font-bold">50+ Michigan businesses</span>
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* 2. Trust Bar + Stats */}
    <section style={{ borderTop: "1px solid rgba(148,163,184,0.08)", borderBottom: "1px solid rgba(148,163,184,0.08)", background: "rgba(6,182,212,0.02)" }}>
      <div className="container max-w-5xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {trustItems.map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#22d3ee" }} />
            <span className="text-xs font-medium tracking-wide" style={{ color: "#64748b" }}>{item}</span>
          </div>
        ))}
      </div>
    </section>

    <section style={{ background: "#0d1117", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <div className="container max-w-4xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <s.icon className="h-5 w-5 mx-auto mb-3" style={{ color: "#22d3ee", opacity: 0.6 }} />
            <div className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: "#f1f5f9" }}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2" style={{ color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>

    {/* Web Design Feature Block */}
    <section className="py-20" style={{ background: "#0a0a0f" }}>
      <div className="container max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>Our Core Service</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
            Web Design That Drives Revenue
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: "#64748b" }}>
            Your website is your 24/7 sales rep. We build ones that actually close.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {webDesignFeatures.map((f) => (
            <div key={f.title} className="rounded-xl p-6 text-center" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)" }}>
                <f.icon className="h-5 w-5" style={{ color: "#22d3ee" }} />
              </div>
              <h3 className="text-sm font-bold mb-2" style={{ color: "#e2e8f0" }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}>
            <Link to="/web-design-services">
              View Web Design Packages <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>

    {/* 3. THE PROBLEM — Missed Revenue Calculator */}
    <MissedRevenueCalculator />

    {/* 4. THE SOLUTION — Services Grid */}
    <section className="container max-w-5xl mx-auto px-4 py-20">
      <h2 className="text-3xl md:text-4xl font-black text-center mb-3 tracking-tight" style={{ color: "#f1f5f9" }}>
        What We Build & Automate
      </h2>
      <p className="text-center mb-14 max-w-xl mx-auto" style={{ color: "#64748b" }}>
        Every service is designed to run on autopilot. You get the results — we handle the tech.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((s, i) => (
          <Link key={s.title} to={s.link} className={`group relative rounded-xl p-7 transition-all duration-300 hover:-translate-y-1 ${s.featured ? '' : ''}`}
            style={{
              background: s.featured ? "rgba(6,182,212,0.06)" : "rgba(15,23,42,0.6)",
              border: s.featured ? "1px solid rgba(6,182,212,0.25)" : "1px solid rgba(148,163,184,0.08)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(6,182,212,0.08), 0 8px 32px rgba(0,0,0,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = s.featured ? "rgba(6,182,212,0.25)" : "rgba(148,163,184,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {s.featured && (
              <div className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}>
                Core
              </div>
            )}
            <div className="flex items-start justify-between mb-5">
              <div className="p-2 rounded-lg" style={{ background: "rgba(6,182,212,0.08)" }}>
                <s.icon className="h-6 w-6" style={{ color: "#22d3ee" }} />
              </div>
              <span className="font-mono text-2xl font-black" style={{ color: "rgba(34,211,238,0.12)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#e2e8f0" }}>{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
          </Link>
        ))}
      </div>
    </section>

    {/* 5. How It Works */}
    <HowItWorks />

    {/* 6. Terminal Animation */}
    <TerminalAnimation />

    {/* 7. Before/After Slider */}
    <BeforeAfterSlider />

    {/* 8. Case Study Audit Trail */}
    <CaseStudyAuditTrail />

    {/* 9. Our DNA + Why Us */}
    <BareMetalDNA />

    <section className="py-20">
      <div className="container max-w-4xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-12 tracking-tight" style={{ color: "#f1f5f9" }}>
          Why Michigan Businesses Choose Us
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            "Websites that generate leads, not just look pretty",
            "64+ automation products — all running while you sleep",
            "Local to Grosse Pointe — we know Michigan business",
            "No contracts. No BS. Cancel anytime.",
            "Automated prospecting finds YOUR customers",
            "From $19/mo — cheaper than your coffee habit",
          ].map((item) => (
            <div key={item} className="flex items-start gap-4 p-4 rounded-lg" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(148,163,184,0.06)" }}>
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#22d3ee" }} />
              <span className="text-sm font-medium leading-relaxed" style={{ color: "#cbd5e1" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 10. Local Footprint Map */}
    <LocalFootprintMap />

    {/* 11. Local Guarantee Block */}
    <LocalGuaranteeBlock />

    {/* 12. FAQ */}
    <AgencyFAQ />

    {/* 13. Client Testimonials */}
    <section className="py-20" style={{ background: "#0d1117" }}>
      <div className="container max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>Client Intel &amp; Proven Results</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: "#f1f5f9" }}>What Michigan Businesses Say</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { quote: "Detroit Web Agency built a lead system that figures out booked jobs. They code the work — I show up and close.", name: "Jim T.", role: "Senior Forms Contractor", verified: true },
            { quote: "The website they built us pays for itself every single month. Best investment we've made.", name: "Tom L.", role: "Michigan Business Owner", verified: true },
            { quote: "Zero gimmicks, just results. The most reliable and effective web team we've worked with.", name: "Rand S.", role: "Grosse Pointe Contractor", verified: true },
          ].map((t) => (
             <div key={t.name} className="relative rounded-xl p-6 flex flex-col overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))", border: "1px solid rgba(6,182,212,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(148,163,184,0.06)" }}>
               <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent)" }} />
               <div className="text-4xl font-serif mb-3" style={{ color: "rgba(34,211,238,0.25)", lineHeight: 1 }}>"</div>
               <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: "#94a3b8" }}>{t.quote}</p>
               <div>
                 <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{t.name}</p>
                 <p className="text-xs" style={{ color: "#475569" }}>{t.role}</p>
                 {t.verified && <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}>[VERIFIED INTEL]</span>}
               </div>
             </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#334155" }}>Total Secured Clients: 50+ · Satisfaction Rating: 100%</span>
        </div>
      </div>
    </section>

    {/* 14. Secure Development Lifecycle */}
    <section className="py-20 relative overflow-hidden" style={{ background: "#080810" }}>
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="container max-w-5xl mx-auto px-4 relative">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>The Secure Development Lifecycle</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>How We Build Your Website</h2>
          <p className="text-sm" style={{ color: "#475569" }}>OUR METHODOLOGY: Precision, Security, and Scalability.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: "01", label: "Consult & Strategize", desc: "Map your digital architecture and identify every leak in your lead pipeline." },
            { step: "02", label: "Design & Code", desc: "Custom layouts, brand-perfect visuals, mobile-first — built to convert from day one." },
            { step: "03", label: "Automate & Optimize", desc: "SEO, speed optimization, and lead capture systems running 24/7." },
            { step: "04", label: "Launch & Support", desc: "Hand-off with monitoring, uptime guarantees, and ongoing support." },
          ].map((s, i) => (
            <div key={s.step} className="relative">
              {i < 3 && <div className="hidden lg:block absolute top-8 left-full w-full h-px z-10" style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.3), transparent)" }} />}
              <div className="rounded-xl p-6 h-full" style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.1)" }}>
                <div className="font-mono text-3xl font-black mb-4" style={{ color: "rgba(34,211,238,0.25)" }}>{s.step}</div>
                <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: "#22d3ee" }}>{s.label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 15. Final CTA — Web Design Focus */}
    <section className="relative overflow-hidden py-28" style={{ background: "#0a0a0f" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 80%, rgba(6,182,212,0.1) 0%, transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(6,182,212,0.04) 0%, transparent 50%)" }} />
      <div className="container max-w-3xl mx-auto px-4 text-center relative">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "#22d3ee" }}>Start Your Web Design Project</p>
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 uppercase leading-[1.05]" style={{ color: "#f8fafc", letterSpacing: "-0.02em", textShadow: "0 0 80px rgba(6,182,212,0.15)" }}>
          Ready for a Website<br />That Actually Works?
        </h2>
        <p className="text-lg mb-12" style={{ color: "#64748b" }}>
          Direct Line: (313) 806-4952 · Grosse Pointe Park, MI
        </p>
        <Button asChild size="lg" className="px-14 py-7 text-lg font-bold rounded-lg transition-all duration-300 uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 60px rgba(6,182,212,0.4), 0 0 120px rgba(6,182,212,0.15), 0 4px 24px rgba(0,0,0,0.5)" }}>
          <Link to="/web-design-services">
            Get Your Custom Website Quote <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </section>

    {/* Uptime Bar */}
    <UptimeBar />

    {/* Footer */}
    <footer style={{ borderTop: "1px solid rgba(148,163,184,0.06)", background: "#080810" }} className="py-14">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          <div>
            <p className="text-sm font-black mb-2 tracking-tight" style={{ color: "#f1f5f9" }}>Detroit Web Agency</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "#475569" }}>
              Custom websites &amp; automated lead systems for Michigan businesses. Built in Grosse Pointe. Deployed everywhere.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/in/mattmichels" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#22d3ee" }} aria-label="LinkedIn">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#22d3ee" }} aria-label="Facebook">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "#475569" }}>Services</p>
            <ul className="space-y-2">
              {services.map(s => (
                <li key={s.title}>
                  <Link to={s.link} className="text-xs transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>{s.title}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "#475569" }}>Contact</p>
            <ul className="space-y-2.5">
              <li>
                <a href="tel:+13138064952" className="text-xs flex items-center gap-2 transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: "#22d3ee" }} /> (313) 806-4952
                </a>
              </li>
              <li>
                <a href="mailto:matt@detroitwebagent.com" className="text-xs flex items-center gap-2 transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  matt@detroitwebagent.com
                </a>
              </li>
              <li className="text-xs" style={{ color: "#64748b" }}>Grosse Pointe Park, MI</li>
            </ul>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }} className="pt-6 text-center">
          <p className="text-xs" style={{ color: "#334155" }}>
            © {new Date().getFullYear()} Detroit Web Agency · All rights reserved
          </p>
        </div>
      </div>
    </footer>

    <ExitIntentModal />
    <StickyMobileCTA />
  </div>
);

export default AgencyHome;
