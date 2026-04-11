import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Link } from "react-router-dom";
import { Phone, ArrowRight, CheckCircle, Star, AlertTriangle, PhoneOff, SearchX, Clock, Globe, ShieldCheck, MessageSquare, Zap, BarChart3, Search, Monitor, Users } from "lucide-react";
import dwaLogo from "@/assets/dwa-logo-clean.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/* ── Pain-point Problem Cards ── */
const painPoints = [
  { icon: PhoneOff, title: "Missing Calls on the Job", desc: "Every unanswered call is $500–$5,000 walking straight to your competitor." },
  { icon: SearchX, title: "Invisible on Google", desc: "Homeowners search 'plumber near me' and your competitor shows up first. You lose before you even know." },
  { icon: AlertTriangle, title: "Outdated or No Website", desc: "67% of customers won't hire a contractor with a bad website. They'll pick the one that looks legit." },
  { icon: Clock, title: "No Follow-Up System", desc: "Leads go cold in 5 minutes. Without automated follow-up, you're leaving money on the table every day." },
];

/* ── Solution cards ── */
const solutions = [
  { icon: Globe, title: "Custom Website", desc: "A professional, mobile-first website that makes your phone ring. Built to rank on Google and convert visitors into calls.", price: "From $499", link: "/web-design-services" },
  { icon: MessageSquare, title: "24/7 Call Routing", desc: "Never miss another call. Our system answers, takes messages, and texts you the details — even at 2 AM.", price: "$149/mo", link: "/ai-phone-answering" },
  { icon: Zap, title: "SMS Automation", desc: "Automated texts for follow-ups, review requests, appointment reminders, and reactivation campaigns.", price: "From $19/mo", link: "/text-message-marketing" },
  { icon: ShieldCheck, title: "SEO & Google Protection", desc: "We monitor your rankings, optimize your Google Business Profile, and make sure customers find YOU first.", price: "From $49/mo", link: "/seo-guard" },
];

/* ── Services for footer ── */
const footerServices = [
  { title: "Web Design", link: "/web-design-services" },
  { title: "Call Routing", link: "/ai-phone-answering" },
  { title: "SEO Guard", link: "/seo-guard" },
  { title: "Free Site Diagnostic", link: "/ai-website-audit" },
  { title: "Review Management", link: "/ai-reputation-dashboard" },
  { title: "All Services", link: "/all-services" },
];

/* ── Testimonials ── */
const testimonials = [
  { quote: "They built our website and within 2 weeks we had 3 new jobs booked directly from Google. Best money I ever spent.", name: "Jim T.", role: "Concrete Contractor, Eastpointe", stars: 5 },
  { quote: "I was losing calls every day on the job site. Now every call gets answered and I get a text with the details. Game changer.", name: "Tom L.", role: "HVAC Contractor, Grosse Pointe", stars: 5 },
  { quote: "Zero gimmicks, just results. My phone rings more, my Google ranking went up, and I don't have to think about any of it.", name: "Rand S.", role: "Roofing Contractor, St. Clair Shores", stars: 5 },
];

/* ── Multi-step quote form ── */
const QuoteForm = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: "", phone: "", service: "" });

  if (step === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>What do you need help with?</p>
        {["New Website", "Fix My Current Site", "Get More Calls/Leads", "Not Sure — Just Want to Talk"].map((s) => (
          <button key={s} onClick={() => { setData(d => ({ ...d, service: s })); setStep(1); }}
            className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)", color: "#e2e8f0" }}
          >
            {s}
          </button>
        ))}
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>Great — what's your name?</p>
        <Input
          placeholder="Your name"
          value={data.name}
          onChange={(e) => setData(d => ({ ...d, name: e.target.value }))}
          className="bg-slate-900/60 border-slate-700 text-white"
        />
        <Button onClick={() => data.name && setStep(2)} className="w-full py-5 font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>Last step — best number to reach you?</p>
        <Input
          placeholder="(555) 123-4567"
          type="tel"
          value={data.phone}
          onChange={(e) => setData(d => ({ ...d, phone: e.target.value }))}
          className="bg-slate-900/60 border-slate-700 text-white"
        />
        <Button
          onClick={() => { if (data.phone) { setStep(3); } }}
          className="w-full py-5 font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}
        >
          Get My Custom Quote <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-[10px] text-center" style={{ color: "#475569" }}>No spam. Matt will text or call you personally within 1 business hour.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <div className="text-4xl mb-3">🎉</div>
      <p className="text-lg font-bold mb-1" style={{ color: "#f1f5f9" }}>You're all set, {data.name}!</p>
      <p className="text-sm" style={{ color: "#94a3b8" }}>Matt will reach out within 1 hour to discuss your {data.service.toLowerCase()} project.</p>
    </div>
  );
};

const AgencyHome = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#0a0a0f" }}>
      <SEOHead
        title="Detroit Web Agency — Websites & Lead Systems for Michigan Contractors"
        description="We build websites and automated lead systems for Michigan contractors. Your phone rings more. Your calendar fills up. You focus on the work."
        path="/detroit-web-design"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Detroit Web Agency",
          description: "Websites & automated lead systems for Michigan contractors.",
          url: "https://www.detroitwebagent.com",
          telephone: "+13138064952",
          email: "matt@detroitwebagent.com",
          address: { "@type": "PostalAddress", addressLocality: "Grosse Pointe Park", addressRegion: "MI" },
        }}
      />
      {/* ═══════════════════════════════════════════════
          1. HERO — Clear, contractor-focused, no jargon
          ═══════════════════════════════════════════════ */}
      <section id="agency-hero" className="relative overflow-hidden pt-24 pb-16 md:pt-36 md:pb-24">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0a0f 100%)" }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(6,182,212,0.08) 0%, transparent 70%)" }} />

        <div className="relative container max-w-4xl mx-auto px-4 text-center">
          {/* Logo — properly blended */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", transform: "scale(1.6)", filter: "blur(50px)" }} />
            <img
              src={dwaLogo}
              alt="Detroit Web Agency"
              width={400}
              height={400}
              fetchPriority="high"
              decoding="sync"
              className="relative w-52 md:w-72 lg:w-80 h-auto object-contain drop-shadow-[0_0_40px_rgba(6,182,212,0.3)]"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-5" style={{ color: "#f8fafc" }}>
            Stop Losing Jobs to Competitors<br className="hidden sm:block" />
            <span style={{ color: "#22d3ee" }}> With Better Websites.</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "#94a3b8" }}>
            We build websites and automated lead systems for Michigan contractors.
            Your phone rings more. Your calendar fills up. You focus on the work.
          </p>

          {/* Dual CTA — call or quote */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button
              onClick={() => setShowForm(true)}
              size="lg"
              className="w-full sm:w-auto px-10 py-6 text-base font-bold rounded-lg uppercase tracking-wide"
              style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)" }}
            >
              Get a Custom Quote <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto px-10 py-6 text-base font-semibold rounded-lg hover:bg-white/5" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.25)", color: "#e2e8f0" }}>
              <a href="tel:+13138064952">
                <Phone className="mr-2 h-4 w-4" /> (313) 806-4952
              </a>
            </Button>
          </div>

          {/* Inline multi-step form (appears on CTA click) */}
          {showForm && (
            <div className="max-w-sm mx-auto mt-6 rounded-xl p-6 text-left" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(34,211,238,0.15)", backdropFilter: "blur(12px)" }}>
              <QuoteForm />
            </div>
          )}

          {/* Social proof micro-strip */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
              Trusted by <span className="font-bold" style={{ color: "#e2e8f0" }}>50+ Michigan contractors</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          2. PROBLEM AGITATION — Pain point cards
          ═══════════════════════════════════════════════ */}
      <section className="py-16 px-4" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
              Sound Familiar?
            </h2>
            <p style={{ color: "#64748b" }}>These are the problems costing Michigan contractors thousands every month.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {painPoints.map((p) => (
              <div key={p.title} className="rounded-xl p-6 flex gap-4" style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.12)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.1)" }}>
                  <p.icon className="h-5 w-5" style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: "#fca5a5" }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          3. SOLUTION — Our packages as the answer
          ═══════════════════════════════════════════════ */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>The Fix</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
              Everything You Need to Get More Jobs
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: "#64748b" }}>
              We handle the tech. You handle the work. Here's exactly what we build for you.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {solutions.map((s) => (
              <Link key={s.title} to={s.link} className="group rounded-xl p-7 transition-all duration-300 hover:-translate-y-1"
                style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(6,182,212,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: "rgba(6,182,212,0.08)" }}>
                    <s.icon className="h-6 w-6" style={{ color: "#22d3ee" }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>{s.title}</h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee" }}>{s.price}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/all-services" className="text-sm font-semibold inline-flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: "#22d3ee" }}>
              View All 64+ Services <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          4. MISSED REVENUE CALCULATOR (interactive proof)
          ═══════════════════════════════════════════════ */}
      <MissedRevenueCalculator />

      {/* ═══════════════════════════════════════════════
          5. HOW IT WORKS — 3-step process
          ═══════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════
          6. TERMINAL ANIMATION (interactive proof)
          ═══════════════════════════════════════════════ */}
      <TerminalAnimation />

      {/* ═══════════════════════════════════════════════
          7. BEFORE/AFTER
          ═══════════════════════════════════════════════ */}
      <BeforeAfterSlider />

      {/* ═══════════════════════════════════════════════
          8. TESTIMONIALS — Real contractor quotes
          ═══════════════════════════════════════════════ */}
      <section className="py-20" style={{ background: "#0d1117" }}>
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>Don't Take Our Word For It</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: "#f1f5f9" }}>
              What Michigan Contractors Say
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl p-6 flex flex-col" style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))", border: "1px solid rgba(6,182,212,0.12)" }}>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: "#94a3b8" }}>"{t.quote}"</p>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{t.name}</p>
                  <p className="text-xs" style={{ color: "#475569" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Zero Gimmicks Guarantee */}
          <div className="mt-12 max-w-lg mx-auto text-center p-6 rounded-xl" style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <ShieldCheck className="h-8 w-8 mx-auto mb-3" style={{ color: "#22d3ee" }} />
            <h3 className="text-lg font-bold mb-2" style={{ color: "#f1f5f9" }}>Zero Gimmicks Guarantee</h3>
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              No contracts. No hidden fees. No upsell traps. If we don't deliver results in 30 days, you don't pay. Period.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          9. CASE STUDY + DNA
          ═══════════════════════════════════════════════ */}
      <CaseStudyAuditTrail />
      <BareMetalDNA />

      {/* ═══════════════════════════════════════════════
          10. WHY US — Quick hits
          ═══════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-center mb-10 tracking-tight" style={{ color: "#f1f5f9" }}>
            Why Contractors Choose Detroit Web Agency
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "We only work with service contractors — we know your business",
              "Websites that rank on Google and make your phone ring",
              "64+ automation tools running while you're on the job",
              "Local team in Grosse Pointe — not some overseas outfit",
              "No contracts, no BS — cancel anytime",
              "From $19/mo — costs less than your morning coffee run",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(148,163,184,0.06)" }}>
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#22d3ee" }} />
                <span className="text-sm font-medium leading-relaxed" style={{ color: "#cbd5e1" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LocalFootprintMap />
      <LocalGuaranteeBlock />
      <AgencyFAQ />

      {/* ═══════════════════════════════════════════════
          11. FINAL CATCH CTA — High-contrast closer
          ═══════════════════════════════════════════════ */}
      <section id="get-quote" className="relative overflow-hidden py-24" style={{ background: "#080810" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 80%, rgba(6,182,212,0.12) 0%, transparent 70%)" }} />
        <div className="container max-w-3xl mx-auto px-4 text-center relative">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "#f8fafc" }}>
            Ready to Get More Jobs?
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: "#94a3b8" }}>
            Call us right now or fill out the form. Matt will personally reach out within 1 hour to discuss your project.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button asChild size="lg" className="w-full sm:w-auto px-12 py-7 text-lg font-bold rounded-lg uppercase tracking-wide"
              style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 60px rgba(6,182,212,0.4), 0 4px 24px rgba(0,0,0,0.5)" }}>
              <a href="tel:+13138064952">
                <Phone className="mr-2 h-5 w-5" /> Call (313) 806-4952
              </a>
            </Button>
          </div>

          {/* Inline quote form */}
          <div className="max-w-sm mx-auto rounded-xl p-6 text-left" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <QuoteForm />
          </div>

          <p className="text-xs mt-6" style={{ color: "#475569" }}>
            Grosse Pointe Park, MI · matt@detroitwebagent.com
          </p>
        </div>
      </section>

      <UptimeBar />

      {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(148,163,184,0.06)", background: "#080810" }} className="py-14">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
            <div>
              <p className="text-sm font-black mb-2 tracking-tight" style={{ color: "#f1f5f9" }}>Detroit Web Agency</p>
              <p className="text-xs leading-relaxed mb-4" style={{ color: "#475569" }}>
                Websites & automated lead systems for Michigan contractors. Built in Grosse Pointe.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://www.linkedin.com/in/mattmichels" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", color: "#22d3ee" }} aria-label="LinkedIn">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "#475569" }}>Services</p>
              <ul className="space-y-2">
                {footerServices.map(s => (
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
                  <a href="tel:+13138064952" className="text-xs flex items-center gap-2 hover:text-cyan-400" style={{ color: "#64748b" }}>
                    <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: "#22d3ee" }} /> (313) 806-4952
                  </a>
                </li>
                <li>
                  <a href="mailto:matt@detroitwebagent.com" className="text-xs flex items-center gap-2 hover:text-cyan-400" style={{ color: "#64748b" }}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    matt@detroitwebagent.com
                  </a>
                </li>
                <li className="text-xs" style={{ color: "#64748b" }}>Grosse Pointe Park, MI</li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }} className="pt-6 text-center">
            <p className="text-xs" style={{ color: "#334155" }}>© {new Date().getFullYear()} Detroit Web Agency · All rights reserved</p>
          </div>
        </div>
      </footer>

      <ExitIntentModal />
      <StickyMobileCTA />
    </div>
  );
};

export default AgencyHome;
