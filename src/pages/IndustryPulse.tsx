import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/shared/SEOHead";
import {
  TrendingUp, Zap, Target, Shield, Factory,
  CheckCircle, ArrowRight, BarChart3, Eye,
} from "lucide-react";

export default function IndustryPulse() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (success) toast.success("Welcome to Industry Pulse Intelligence! Check your email for dashboard access.");
  }, [success]);

  const handleCheckout = async () => {
    if (!email) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-industry-pulse-checkout", {
        body: { email, company_name: company, phone, contact_name: company },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const signals = [
    { icon: Shield, title: "MIOSHA Compliance Gaps", desc: "Expired or expiring boiler operator licenses flagged before your competitors notice." },
    { icon: Factory, title: "Municipal Bond Funding", desc: "New facility bonds that signal upcoming boiler, HVAC, and mechanical work." },
    { icon: TrendingUp, title: "Expansion Hiring Patterns", desc: "Companies hiring boiler engineers, HVAC techs, welders — they need YOUR services next." },
    { icon: Target, title: "Cross-Referenced Intel", desc: "When multiple signals point to the same company, you get a HIGH-PRIORITY alert." },
  ];

  return (
    <>
      <SEOHead
        title="Industry Pulse Intelligence | Detroit Web Agency"
        description="Predictive sales signals for industrial service companies. Know which companies need your services before they start looking."
      />
      <div className="min-h-screen bg-[#030711] text-white">
        {/* Hero */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-[#00d4ff]" />
              <span className="text-[#00d4ff] text-xs font-semibold tracking-wide">PREDICTIVE SALES INTELLIGENCE</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Know Which Companies Need You
              <span className="text-[#00d4ff]"> Before They Start Looking</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
              Daily scans of MIOSHA compliance databases, municipal bond filings, and hiring patterns across Metro Detroit.
              Get actionable signals that tell you exactly who needs your industrial services — and when to call.
            </p>

            {success ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-400">You're In!</h3>
                <p className="text-sm text-white/60 mt-1">Check your email for your personal dashboard link. Signals start flowing immediately.</p>
              </div>
            ) : (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6 max-w-lg mx-auto space-y-3">
                <Input
                  placeholder="Business email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#0f1f35] border-[#1e3a5f] text-white placeholder:text-white/30"
                />
                <Input
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-[#0f1f35] border-[#1e3a5f] text-white placeholder:text-white/30"
                />
                <Input
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#0f1f35] border-[#1e3a5f] text-white placeholder:text-white/30"
                />
                <Button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8d9] h-12 text-base"
                >
                  {loading ? "Loading..." : "Start Getting Signals — $299/mo"}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <p className="text-[11px] text-white/30 text-center">Cancel anytime. No contracts. Signals start same day.</p>
              </div>
            )}
          </div>
        </section>

        {/* Signal Types */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">
              Four Signal Types. <span className="text-[#00d4ff]">Zero Guesswork.</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {signals.map((s, i) => (
                <div key={i} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6 hover:border-[#00d4ff]/30 transition-colors">
                  <s.icon className="h-8 w-8 text-[#00d4ff] mb-3" />
                  <h3 className="text-white font-bold text-base mb-2">{s.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 bg-[#0a1628]/50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-black mb-10">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Eye, title: "We Scan Daily", desc: "MIOSHA databases, bond filings, job postings — 16+ data sources scanned every morning." },
                { icon: BarChart3, title: "AI Scores & Ranks", desc: "Each signal gets a 1-10 confidence score. Cross-referenced signals = highest priority." },
                { icon: Zap, title: "You Act First", desc: "Get email alerts + a live dashboard. Call the right company before your competitors know they exist." },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center mx-auto mb-4">
                    <step.icon className="h-6 w-6 text-[#00d4ff]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-16 px-4">
          <div className="max-w-md mx-auto bg-[#0a1628] border border-[#00d4ff]/20 rounded-2xl p-8 text-center">
            <p className="text-[#00d4ff] text-xs font-semibold tracking-wider mb-2">INDUSTRY PULSE INTELLIGENCE</p>
            <p className="text-5xl font-black text-white mb-1">$299<span className="text-lg text-white/40">/mo</span></p>
            <p className="text-white/40 text-sm mb-6">First 60 days: pilot pricing. Lock in this rate.</p>
            <ul className="text-left space-y-3 mb-8">
              {[
                "Daily predictive signals dashboard",
                "Weekly email digest with top opportunities",
                "MIOSHA compliance gap monitoring",
                "Municipal bond + expansion tracking",
                "Cross-referenced high-priority alerts",
                "Cancel anytime — no contracts",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 text-[#00d4ff] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8d9] h-12"
            >
              {loading ? "Loading..." : "Get Started"}
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/5 text-center">
          <p className="text-white/30 text-xs">
            Detroit Web Agency — We Handle The Tech.
            <br />
            <a href="mailto:matt@detroitwebagent.com" className="text-[#00d4ff]/50 hover:text-[#00d4ff]">matt@detroitwebagent.com</a>
          </p>
        </footer>
      </div>
    </>
  );
}
