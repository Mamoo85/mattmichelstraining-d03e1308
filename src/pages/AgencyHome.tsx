import { Link } from "react-router-dom";
import { Globe, PhoneForwarded, ShieldCheck, Search, Monitor, Wrench, ArrowRight, CheckCircle, Zap, BarChart3, Clock, Phone } from "lucide-react";
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
  { icon: Globe, title: "Web Design", desc: "Custom websites built to convert visitors into paying customers.", link: "/web-design-services" },
  { icon: PhoneForwarded, title: "24/7 Call Routing Engine", desc: "Never miss a call. Our automated voice system answers, qualifies, and books leads around the clock.", link: "/ai-phone-answering" },
  { icon: ShieldCheck, title: "SEO Guard", desc: "Weekly monitoring so Google never loses track of your business.", link: "/seo-guard" },
  { icon: Search, title: "Free Site Diagnostic", desc: "Our automated scanner reveals exactly what's costing you leads.", link: "/ai-website-audit" },
  { icon: Monitor, title: "Review Command Center", desc: "Monitor reviews, respond instantly, build 5-star social proof.", link: "/ai-reputation-dashboard" },
  { icon: Wrench, title: "Computer Repair", desc: "Local Grosse Pointe hardware repair & remote tech support.", link: "/computer-repair" },
];

const stats = [
  { value: "64+", label: "Automation Products", icon: Zap },
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

const AgencyHome = () => (
  <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
    {/* 1. Hero */}
    <section id="agency-hero" className="relative overflow-hidden pt-28 pb-20 md:pt-40 md:pb-32">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0a0f 100%)" }} />
      {/* Dot grid pattern */}
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(6,182,212,0.08) 0%, transparent 70%)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />

      <div className="relative container max-w-5xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] mb-8" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee" }}>
          Detroit Web Agency
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6" style={{ color: "#f8fafc" }}>
          Your Website Should Be
          <br className="hidden sm:block" />
          <span style={{ color: "#22d3ee" }}> Your Best Salesperson.</span>
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "#94a3b8" }}>
          We build automated websites and lead systems for Michigan contractors. You get booked jobs — we handle the tech.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg transition-all duration-300" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)" }}>
            <Link to="/ai-website-audit">
              Get a Free Site Diagnostic <ArrowRight className="ml-2 h-4 w-4" />
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
            {["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626"].map((color, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white" style={{ borderColor: "#0a0a0f", background: color }}>
                {["MR", "JK", "AB", "TS", "KL"][i]}
              </div>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1 mb-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="w-3 h-3" fill="#facc15" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
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
          <Link key={s.title} to={s.link} className="group relative rounded-xl p-7 transition-all duration-300 hover:-translate-y-1" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(6,182,212,0.08), 0 8px 32px rgba(0,0,0,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
          >
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

    {/* 13. Final CTA */}
    <section className="container max-w-3xl mx-auto px-4 py-20 text-center">
      <h2 className="text-3xl md:text-4xl font-black mb-5 tracking-tight" style={{ color: "#f1f5f9" }}>
        Ready to Stop Losing Leads?
      </h2>
      <p className="mb-10" style={{ color: "#64748b" }}>
        Get a free automated audit of your website in under 60 seconds. No signup required.
      </p>
      <Button asChild size="lg" className="px-12 py-6 text-base font-bold rounded-lg transition-all duration-300" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)" }}>
        <Link to="/ai-website-audit">
          Get Your Free Diagnostic <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </section>

    {/* 14. Uptime Bar */}
    <UptimeBar />

    {/* 15. Footer */}
    <footer style={{ borderTop: "1px solid rgba(148,163,184,0.06)", background: "#080810" }} className="py-14">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <p className="text-sm font-black mb-2 tracking-tight" style={{ color: "#f1f5f9" }}>Detroit Web Agency</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "#475569" }}>
              Automated websites &amp; lead systems for Michigan businesses. Built in Grosse Pointe. Deployed everywhere.
            </p>
            <div className="flex items-center gap-3">
              {/* LinkedIn */}
              <a href="https://www.linkedin.com/in/mattmichels" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#22d3ee" }} aria-label="LinkedIn">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              {/* Facebook */}
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#22d3ee" }} aria-label="Facebook">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "#475569" }}>Services</p>
            <ul className="space-y-2">
              {[
                { label: "Web Design", to: "/web-design-services" },
                { label: "Free Site Diagnostic", to: "/ai-website-audit" },
                { label: "Review Monitor", to: "/ai-reputation-dashboard" },
                { label: "24/7 Call Routing", to: "/ai-phone-answering" },
                { label: "Computer Repair", to: "/computer-repair" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-xs transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "#475569" }}>Contact</p>
            <ul className="space-y-2.5">
              <li>
                <a href="tel:+13138064952" className="text-xs flex items-center gap-2 transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: "#22d3ee" }} /> (313) 806-4952
                </a>
              </li>
              <li>
                <a href="mailto:matt@mattmichelstraining.com" className="text-xs flex items-center gap-2 transition-colors hover:text-cyan-400" style={{ color: "#64748b" }}>
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  matt@mattmichelstraining.com
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

    {/* Global overlays */}
    <ExitIntentModal />
    <StickyMobileCTA />
  </div>
);

export default AgencyHome;
