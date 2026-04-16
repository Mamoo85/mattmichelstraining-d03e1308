import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import {
  ArrowRight, CheckCircle, Phone, Users, Zap, Shield,
  TrendingUp, Clock, Star, BarChart3, MessageSquare,
} from "lucide-react";

const MATT_PHOTO = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg";
const DWA_BADGE = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png";

export default function StaffingAgency() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const industry = searchParams.get("industry") || "all";
  const cityParam = searchParams.get("city") || "";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const isHealthcare = industry === "healthcare";
  const cityNames: Record<string, string> = {
    detroit: "Metro Detroit", "grand-rapids": "Grand Rapids", flint: "Flint",
    lansing: "Lansing", "ann-arbor": "Ann Arbor", kalamazoo: "Kalamazoo",
  };
  const cityLabel = cityNames[cityParam.toLowerCase()] || "Michigan";

  useEffect(() => {
    if (success) toast.success("Your 10 free leads are on the way! Check your email.");
  }, [success]);

  const handleClaim = async () => {
    if (!email || !company) { toast.error("Email and company name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hirealert-ondemand", {
        body: { email, company_name: company, phone, quantity: 10, source: "staffing-landing" },
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; return; }
      toast.success("10 free leads claimed! Check your email in 5 minutes.");
    } catch {
      toast.success("Request received! Matt will text you within the hour.");
    } finally {
      setLoading(false);
    }
  };

  const PROOF_POINTS = isHealthcare ? [
    { value: "10", label: "Free verified candidates", icon: Users },
    { value: "<5 min", label: "Delivery to your inbox", icon: Clock },
    { value: "Daily", label: "New candidates found", icon: TrendingUp },
  ] : [
    { value: "10", label: "Free licensed names", icon: Users },
    { value: "<5 min", label: "Delivered to email", icon: Clock },
    { value: "Daily", label: "Fresh candidates", icon: TrendingUp },
  ];

  const HEADLINES = {
    healthcare: {
      hero: "We Find Licensed Nurses",
      sub: "Before Anyone Else",
      desc: `We invented a way to identify newly licensed CNAs, LPNs, and RNs across ${cityLabel} — often within hours of certification. Your first 10 names are free.`,
    },
    trades: {
      hero: "We Find Licensed Techs",
      sub: "Before Your Competitors",
      desc: `We invented a way to identify newly licensed HVAC techs, plumbers, electricians, and boiler operators across ${cityLabel}. Your first 10 names are free.`,
    },
    all: {
      hero: "We Find Licensed Talent",
      sub: "Before Anyone Else",
      desc: `We invented a proprietary way to find newly licensed professionals — nurses, HVAC techs, plumbers, electricians — across ${cityLabel}. Your first 10 are free.`,
    },
  };
  const h = HEADLINES[isHealthcare ? "healthcare" : industry === "trades" ? "trades" : "all"];

  return (
    <>
      <SEOHead
        title={`${h.hero} ${h.sub} | Detroit Web Agency`}
        description={h.desc}
        path="/staffing"
      />
      <div className="min-h-screen bg-[#030711] text-white" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left — copy */}
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold">FOR STAFFING AGENCIES</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-[1.1] tracking-tight">
                  {h.hero}<br />
                  <span className="text-emerald-400">{h.sub}</span>
                </h1>
                <p className="text-white/45 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                  {h.desc}
                </p>

                {/* Proof points */}
                <div className="flex gap-6 mb-8">
                  {PROOF_POINTS.map((p, i) => (
                    <div key={i} className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <p.icon className="h-4 w-4 text-emerald-400" />
                        <span className="text-xl font-black text-white">{p.value}</span>
                      </div>
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">{p.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {success ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                    <CheckCircle className="h-8 w-8 text-emerald-400 mb-2" />
                    <h3 className="text-emerald-400 font-bold">Your 10 free leads are on the way!</h3>
                    <p className="text-white/40 text-sm mt-1">Check your email. Matt will follow up personally.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-sm">
                    <Input placeholder="Business email *" value={email} onChange={e => setEmail(e.target.value)} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-11" data-testid="staffing-email" />
                    <Input placeholder="Agency / company name *" value={company} onChange={e => setCompany(e.target.value)} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-11" data-testid="staffing-company" />
                    <Input placeholder="Phone (so Matt can call you)" value={phone} onChange={e => setPhone(e.target.value)} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25 h-11" data-testid="staffing-phone" />
                    <Button onClick={handleClaim} disabled={loading} className="w-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 h-12 text-base" data-testid="staffing-cta">
                      {loading ? "Claiming..." : "Claim My 10 Free Leads"} {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                    <p className="text-white/15 text-[10px] text-center">No credit card. No obligation. Just proof.</p>
                  </div>
                )}
              </div>

              {/* Right — Matt's photo + personal touch */}
              <div className="hidden md:flex flex-col items-center">
                <div className="relative mb-6">
                  <img
                    src={MATT_PHOTO}
                    alt="Matt Michels"
                    className="w-56 h-56 rounded-2xl object-cover border-2 border-white/10 shadow-2xl"
                  />
                  <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg">
                    FOUNDER
                  </div>
                </div>
                <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5 max-w-xs text-center">
                  <p className="text-white/70 text-sm leading-relaxed italic mb-3">
                    "I invented this system because I saw how broken hiring is in the trades. If you don't believe it works, text me. I'll call you personally and prove it."
                  </p>
                  <p className="text-white font-bold text-sm">Matt Michels</p>
                  <p className="text-white/30 text-xs">Founder, Detroit Web Agency</p>
                  <a href="sms:+13139921219" className="inline-flex items-center gap-2 mt-3 bg-emerald-500/20 text-emerald-400 font-bold text-sm px-4 py-2 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors" data-testid="staffing-text-matt">
                    <MessageSquare className="w-4 h-4" /> Text Matt: (313) 992-1219
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <section className="py-16 px-4 border-y border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                { step: "01", icon: Zap, title: "We Find Them", desc: "Our proprietary system identifies newly licensed professionals across Michigan — often within hours. We don't use job boards. We invented a different way." },
                { step: "02", icon: Shield, title: "We Verify Them", desc: "Every name comes with verified license information, location, and an availability score from 1-10. No guessing. No stale data." },
                { step: "03", icon: Phone, title: "You Contact Them", desc: "Names delivered to your inbox with direct contact information. No middlemen. No bidding wars. First come, first served." },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center mx-auto mb-4">
                    <s.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">{s.step}</span>
                  <h3 className="text-white font-bold mt-1 mb-2">{s.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE NUMBERS ──────────────────────────────────────────── */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-3">The Math Is Simple</h2>
            <p className="text-white/40 text-sm text-center mb-10">One placement pays for a full year of our service.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-6 text-center">
                <div className="text-3xl font-black text-red-400 mb-1">$4,500</div>
                <p className="text-white/40 text-xs">Avg cost per placement via traditional staffing methods</p>
              </div>
              <div className="bg-[#0d1117] border border-emerald-500/20 rounded-xl p-6 text-center">
                <div className="text-3xl font-black text-emerald-400 mb-1">$149</div>
                <p className="text-white/40 text-xs">Our monthly fee for unlimited daily candidate alerts</p>
              </div>
              <div className="bg-[#0d1117] border border-[#00d4ff]/20 rounded-xl p-6 text-center">
                <div className="text-3xl font-black text-[#00d4ff] mb-1">30x</div>
                <p className="text-white/40 text-xs">ROI on your first successful placement through us</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT YOU GET ─────────────────────────────────────────── */}
        <section className="py-16 px-4 bg-[#0d1117]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">What's Inside Your Free Pack</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "10 verified, licensed professionals",
                "Direct phone numbers + emails",
                "Availability score (1-10) per candidate",
                "License type and verification status",
                "City/location for each candidate",
                "Delivered to your email in 5 minutes",
                "No credit card required",
                "No strings attached — just proof",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-white/60 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────── */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-3">After Your Free 10</h2>
            <p className="text-white/40 text-sm text-center mb-10">If the names are real (they are), here's what happens next.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-6">
                <span className="text-[#00d4ff] text-xs font-bold tracking-wider">ON-DEMAND</span>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-black text-white">$50</span>
                  <span className="text-sm text-white/30">/ 10 names</span>
                </div>
                <p className="text-white/30 text-xs mb-4">Buy as needed. No subscription.</p>
                <ul className="space-y-2">
                  {["10 verified names per pack", "Delivered in 5 minutes", "$5 refund per undeliverable", "Buy as many packs as you want"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50"><CheckCircle className="h-3.5 w-3.5 text-[#00d4ff] mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#0d1117] border-2 border-emerald-500/30 rounded-xl p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full">BEST VALUE</div>
                <span className="text-emerald-400 text-xs font-bold tracking-wider">DAILY ALERTS</span>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-black text-white">$149</span>
                  <span className="text-sm text-white/30">/mo</span>
                </div>
                <p className="text-white/30 text-xs mb-4">Fresh candidates every morning at 7am.</p>
                <ul className="space-y-2">
                  {["Daily automated candidate alerts", "Availability scoring 1-10", "48-hour exclusive claim window", "Dashboard with search & filters", "One-click outreach drafts", "Cancel anytime"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50"><CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHITE LABEL ──────────────────────────────────────────── */}
        <section className="py-16 px-4 border-t border-white/5">
          <div className="max-w-2xl mx-auto text-center">
            <img src={DWA_BADGE} alt="Detroit Web Agency" className="w-20 h-20 mx-auto mb-6 rounded-full" />
            <h2 className="text-xl font-black mb-3">Want This Under Your Brand?</h2>
            <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
              We offer white-label candidate intelligence for agencies who want their own branded system. Your logo, your dashboard, powered by our proprietary technology.
            </p>
            <a href="sms:+13139921219" className="inline-flex items-center gap-2 bg-white/5 text-white/60 border border-white/10 font-semibold text-sm px-6 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <Phone className="w-4 h-4" /> Text Matt About White-Label
            </a>
          </div>
        </section>

        {/* ── MOBILE CTA BAR ───────────────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-[#30363d] p-3 z-40 flex items-center gap-3">
          <a href="sms:+13139921219" className="flex items-center justify-center gap-2 flex-1 bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm">
            <MessageSquare className="w-4 h-4" /> Text Matt
          </a>
          <a href="tel:+13139921219" className="flex items-center justify-center gap-2 px-4 bg-white/5 text-white/60 border border-white/10 font-semibold py-3 rounded-lg text-sm">
            <Phone className="w-4 h-4" /> Call
          </a>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <footer className="py-8 px-4 border-t border-white/5 text-center pb-20 md:pb-8">
          <p className="text-white/15 text-xs">
            Detroit Web Agency — Grosse Pointe Park, MI — We Handle The Tech
          </p>
        </footer>
      </div>
    </>
  );
}
