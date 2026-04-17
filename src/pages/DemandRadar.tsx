import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import {
  TrendingUp, Zap, Target, Factory, CheckCircle, ArrowRight,
  BarChart3, Eye, Briefcase, ShieldCheck, Bell, Download,
  Users, DollarSign, Clock, Search,
} from "lucide-react";

export default function DemandRadar() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const cityParam = searchParams.get("city") || "";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const CITY_NAMES: Record<string, string> = {
    detroit: "Metro Detroit", "grand-rapids": "Grand Rapids", lansing: "Lansing",
    "ann-arbor": "Ann Arbor", flint: "Flint", kalamazoo: "Kalamazoo",
    "traverse-city": "Traverse City", saginaw: "Saginaw / Bay City", muskegon: "Muskegon",
  };
  const cityLabel = CITY_NAMES[cityParam.toLowerCase()] || "Metro Detroit";

  useEffect(() => {
    if (success) toast.success("Welcome to Demand Radar! Check your email for your dashboard link.");
  }, [success]);

  const handleCheckout = async () => {
    if (!email) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-industry-pulse-checkout", {
        body: { email, company_name: company, phone, contact_name: company, target_industries: ["all"] },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const LIVE_STATS = [
    { value: "6", label: "Trade categories scanned", icon: Factory },
    { value: "200+", label: "Signals per month", icon: TrendingUp },
    { value: "24h", label: "Signal delivery speed", icon: Clock },
  ];

  const SIGNALS = [
    { icon: Briefcase, title: "Hiring Surge Detection", desc: "When a company posts 3+ trade jobs at once, they're expanding — not backfilling. You'll know the same day.", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { icon: Target, title: "Predicted Equipment Needs", desc: "AI analyzes each hire and predicts what tools, equipment, and supplies they'll need in 30-90 days.", color: "text-[#00d4ff]", bg: "bg-[#00d4ff]/10 border-[#00d4ff]/20" },
    { icon: ShieldCheck, title: "Cross-Referenced Intel", desc: "When a company appears in BOTH hiring data AND expansion news, you get a priority alert. These convert.", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { icon: Search, title: "Compliance Gap Signals", desc: "Expired operator credentials = instant need for equipment service contracts. We flag them first.", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  ];

  const INDUSTRIES = ["HVAC", "CNC/Machining", "Welding", "Electrical", "Boiler/Pressure", "Plumbing"];

  const WHO_ITS_FOR = [
    { title: "Supply House Reps", desc: "Know which contractors are scaling before they walk in your door. Pre-stage their orders." },
    { title: "Equipment Distributors", desc: "Target companies mid-expansion when capital is already allocated. First vendor in wins." },
    { title: "Industrial Service Cos", desc: "Find facilities with compliance gaps and expansion projects that need your contracts." },
  ];

  return (
    <>
      <SEOHead
        title={`Demand Radar | Know Who's Buying in ${cityLabel} Before They Call`}
        description={`Predictive demand intelligence for ${cityLabel} industrial supply and service companies. Hiring signals → equipment predictions → actionable leads. $99/mo.`}
        path="/demand-radar"
      />
      <div className="min-h-screen bg-[#030711] text-white" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="relative py-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00d4ff]/8 via-transparent to-transparent" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-full px-4 py-1.5 mb-8">
              <TrendingUp className="h-3.5 w-3.5 text-[#00d4ff]" />
              <span className="text-[#00d4ff] text-xs font-semibold tracking-wide">DEMAND RADAR</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-[1.1] tracking-tight">
              Know Who's Buying
              <br />
              <span className="text-[#00d4ff]">Before They Call</span>
            </h1>
            <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              We scan hiring patterns across {cityLabel}'s industrial companies every day.
              When someone's expanding, we tell you what equipment and services they'll need
              — before they start shopping.
            </p>

            {/* Live stats strip */}
            <div className="flex justify-center gap-8 mb-12">
              {LIVE_STATS.map(s => (
                <div key={s.label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <s.icon className="h-4 w-4 text-[#00d4ff]" />
                    <span className="text-2xl font-black text-white">{s.value}</span>
                  </div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>

            {success ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-400">You're In!</h3>
                <p className="text-sm text-white/60 mt-1">Check your email for your personal dashboard link. Signals start flowing immediately.</p>
              </div>
            ) : (
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-6 max-w-lg mx-auto space-y-3">
                <Input
                  placeholder="Business email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-12"
                  data-testid="dr-email"
                />
                <Input
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-12"
                  data-testid="dr-company"
                />
                <Input
                  placeholder="Phone (optional — for SMS alerts)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-12"
                  data-testid="dr-phone"
                />
                <Button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8d9] h-12 text-base"
                  data-testid="dr-checkout"
                >
                  {loading ? "Loading..." : "Start — $99/mo"}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <p className="text-[11px] text-white/20 text-center">Cancel anytime. No contracts. Signals start same day.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── SIGNAL TYPES ─────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-black mb-3">
                Four Signals. <span className="text-[#00d4ff]">Zero Guesswork.</span>
              </h2>
              <p className="text-white/40 text-sm max-w-xl mx-auto">
                Every signal comes with predicted needs, confidence score, and a recommended pitch angle.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {SIGNALS.map((s, i) => (
                <div key={i} className={`rounded-xl p-6 border ${s.bg} hover:border-opacity-60 transition-colors`}>
                  <s.icon className={`h-7 w-7 ${s.color} mb-4`} />
                  <h3 className="text-white font-bold text-base mb-2">{s.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── INDUSTRIES COVERED ───────────────────────────────────── */}
        <section className="py-16 px-4 border-y border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-xl font-black mb-6">Industries We Scan</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {INDUSTRIES.map(ind => (
                <span key={ind} className="px-4 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-white/60 text-sm font-medium">
                  {ind}
                </span>
              ))}
            </div>
            <p className="text-white/25 text-xs mt-4">Metro Detroit focus. Expanding to Southeast Michigan Q3 2026.</p>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-12">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-10">
              {[
                { icon: Eye, step: "01", title: "We Scan Daily", desc: "Our proprietary demand signal engine sweeps public hiring boards, permit data, and expansion filings every morning at 7am ET." },
                { icon: BarChart3, step: "02", title: "AI Scores Each Signal", desc: "Each hiring signal gets a 1-10 confidence score. Multiple hires + expansion news = highest priority." },
                { icon: Bell, step: "03", title: "You Act First", desc: "Email alerts + live dashboard + CSV export. Call the right company before your competitors know." },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center mx-auto mb-4">
                    <step.icon className="h-6 w-6 text-[#00d4ff]" />
                  </div>
                  <span className="text-[10px] text-[#00d4ff] font-mono font-bold">{step.step}</span>
                  <h3 className="text-white font-bold mt-1 mb-2">{step.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHO IT'S FOR ─────────────────────────────────────────── */}
        <section className="py-16 px-4 bg-[#0d1117]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">Built For</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {WHO_ITS_FOR.map((w, i) => (
                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
                  <Users className="h-5 w-5 text-[#00d4ff] mb-3" />
                  <h3 className="text-white font-bold text-sm mb-2">{w.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── EXAMPLE SIGNAL ───────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-3">What a Signal Looks Like</h2>
            <p className="text-white/40 text-sm text-center mb-8">Real example from a recent scan:</p>
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold">Third Coast Electric Inc.</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">High (8/10)</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/40">
                    <span>Royal Oak, MI</span>
                    <span>Electrical</span>
                    <span>Today</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30 flex items-center justify-center text-sm font-black shrink-0">8</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 text-[#00d4ff]" />
                <span className="text-[11px] text-white/60">Hiring 2x Journeyman Electrician, Apprentice Electrician</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["New electrical service contracts", "Power tools and hand tools", "Safety equipment (PPE)", "Vehicle maintenance/lease", "Consumable electrical supplies"].map(n => (
                  <span key={n} className="px-2 py-0.5 rounded text-[10px] border border-[#00d4ff]/20 text-[#00d4ff]/70 bg-[#00d4ff]/5">{n}</span>
                ))}
              </div>
              <p className="text-[11px] text-white/50 italic">
                As Third Coast Electric expands its team, they're gearing up for new projects and increased operational capacity.
                We can help streamline your supply chain to ensure new hires are productive from day one.
              </p>
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────── */}
        <section className="py-20 px-4" id="pricing">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-3">Choose Your Advantage</h2>
            <p className="text-white/40 text-sm text-center mb-10">All plans include daily scans, AI scoring, and cancel-anytime flexibility.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {/* BASIC */}
              <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6">
                <span className="text-white/40 text-xs font-semibold tracking-wider">BASIC</span>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-4xl font-black text-white">$99</span>
                  <span className="text-sm text-white/30">/mo</span>
                </div>
                <p className="text-white/30 text-xs mb-6">State-wide signals, no exclusivity</p>
                <ul className="space-y-2.5 mb-6">
                  {["Daily scans — 6 trade categories", "AI-predicted equipment needs", "Confidence scoring", "Live dashboard + CSV export", "Weekly email digest", "SMS alerts on high signals"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50"><CheckCircle className="h-3.5 w-3.5 text-[#00d4ff] mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Button onClick={handleCheckout} disabled={loading} className="w-full bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 h-10 text-sm font-semibold">
                  {loading ? "..." : "Get Started"}
                </Button>
              </div>

              {/* PRO — recommended */}
              <div className="bg-[#0d1117] border-2 border-[#00d4ff]/40 rounded-2xl p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4ff] text-black text-[10px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
                <span className="text-[#00d4ff] text-xs font-semibold tracking-wider">PRO</span>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-4xl font-black text-white">$199</span>
                  <span className="text-sm text-white/30">/mo</span>
                </div>
                <p className="text-white/30 text-xs mb-6">County-exclusive, 24hr head start</p>
                <ul className="space-y-2.5 mb-6">
                  {["Everything in Basic", "County territory exclusivity", "24hr head start on signals", "Company watchlist alerts", "Zapier/webhook integration", "Priority SMS (instant)", "Dedicated account manager"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50"><CheckCircle className="h-3.5 w-3.5 text-[#00d4ff] mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Button onClick={handleCheckout} disabled={loading} className="w-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8d9] h-10 text-sm" data-testid="dr-pricing-cta">
                  {loading ? "..." : "Get Pro"} {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>

              {/* ENTERPRISE */}
              <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6">
                <span className="text-amber-400 text-xs font-semibold tracking-wider">ENTERPRISE</span>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-4xl font-black text-white">$499</span>
                  <span className="text-sm text-white/30">/mo</span>
                </div>
                <p className="text-white/30 text-xs mb-6">Multi-county, API access, white-label</p>
                <ul className="space-y-2.5 mb-6">
                  {["Everything in Pro", "Multi-county territory lock", "REST API access", "White-label dashboard option", "Custom signal filters", "Account-based company intel", "Monthly strategy call", "Custom CRM integration"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50"><CheckCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href="sms:+13139921219" className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-sm font-bold hover:bg-amber-500/20 transition-colors">
                  Contact Sales
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="py-16 px-4 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8">Questions</h2>
            <div className="space-y-4">
              {[
                { q: "Where does the data come from?", a: "Our proprietary demand signal engine aggregates public hiring activity, permit filings, expansion announcements, and compliance records. Methodology is proprietary — what matters is the signals convert." },
                { q: "How accurate are the predictions?", a: "Each signal gets a 1-10 confidence score. High-confidence signals (7+) are companies with multiple indicators — hiring + expansion news + compliance gaps. These are your best leads." },
                { q: "Can I export the data?", a: "Yes. Your dashboard includes CSV export with all signal details — company, location, hiring data, predicted needs, confidence scores, and source URLs." },
                { q: "How is this different from a lead list?", a: "Lead lists are cold. Demand Radar tells you WHO is buying, WHAT they need, and WHY right now — based on real hiring activity. You're calling with a reason, not a script." },
                { q: "What if I want to cancel?", a: "Cancel anytime from your dashboard. No contracts, no cancellation fees. Your data exports are yours to keep." },
              ].map((faq, i) => (
                <div key={i} className="bg-[#0d1117] border border-[#30363d] rounded-lg p-5">
                  <h3 className="text-white font-bold text-sm mb-2">{faq.q}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <footer className="py-8 px-4 border-t border-white/5 text-center">
          <p className="text-white/20 text-xs">
            Detroit Web Agency — We Handle The Tech.
            <br />
            <a href="mailto:matt@detroitwebagent.com" className="text-[#00d4ff]/40 hover:text-[#00d4ff]">matt@detroitwebagent.com</a>
            {" · "}
            <a href="sms:+13139921219" className="text-[#00d4ff]/40 hover:text-[#00d4ff]">(313) 992-1219</a>
          </p>
        </footer>
      </div>
    </>
  );
}
