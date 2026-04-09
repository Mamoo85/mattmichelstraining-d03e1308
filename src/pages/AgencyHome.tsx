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
        {services.map((s) => (
          <Link key={s.title} to={s.link} className="group relative rounded-xl p-7 transition-all duration-300 hover:-translate-y-1" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(6,182,212,0.08), 0 8px 32px rgba(0,0,0,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <s.icon className="h-8 w-8 mb-5" style={{ color: "#22d3ee" }} />
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
    <footer style={{ borderTop: "1px solid rgba(148,163,184,0.06)", background: "#080810" }} className="py-10">
      <div className="container max-w-5xl mx-auto px-4 text-center">
        <p className="text-xs font-medium" style={{ color: "#475569" }}>
          © {new Date().getFullYear()} Detroit Web Agency · Grosse Pointe, MI
        </p>
      </div>
    </footer>

    {/* Global overlays */}
    <ExitIntentModal />
    <StickyMobileCTA />
  </div>
);

export default AgencyHome;
