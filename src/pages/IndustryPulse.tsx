import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import {
  TrendingUp, Zap, Target, Shield, Factory,
  CheckCircle, ArrowRight, BarChart3, Eye,
} from "lucide-react";

type Tier = "snapshot" | "weekly" | "enterprise";
type SupplierType = "plumbing" | "hvac" | "electrical" | "industrial" | "roofing" | "";

const SUPPLIER_TYPES: { value: SupplierType; label: string; example: string }[] = [
  { value: "plumbing", label: "Plumbing Supply", example: "Ferguson, Hajoca, Winsupply" },
  { value: "hvac", label: "HVAC / Mechanical", example: "Watsco, Johnstone, Carrier dist." },
  { value: "electrical", label: "Electrical Supply", example: "Graybar, Rexel, Anixter" },
  { value: "industrial", label: "Industrial / MRO", example: "Grainger, Fastenal, MSC" },
  { value: "roofing", label: "Roofing / Building", example: "ABC Supply, Beacon, SRS" },
];

const TIERS: { id: Tier; price: string; cadence: string; name: string; tagline: string; features: string[]; cta: string; highlight?: boolean }[] = [
  {
    id: "snapshot",
    price: "$99",
    cadence: "one-time",
    name: "Snapshot",
    tagline: "Current signals delivered once.",
    features: [
      "PDF report of all current Metro Detroit contractor signals",
      "CSV export ready for your sales CRM",
      "Permit surge activity + hiring expansion patterns",
      "No subscription — pay once, use forever",
    ],
    cta: "Get the Snapshot",
  },
  {
    id: "weekly",
    price: "$199",
    cadence: "/mo",
    name: "Weekly Digest",
    tagline: "Fresh contractor signals every Monday.",
    features: [
      "Weekly email: top 10 growing contractors in your vertical",
      "Live dashboard with decision-maker contacts",
      "Cross-referenced HIGH-PRIORITY alerts (3+ signals = same company)",
      "Cancel anytime — no contracts",
    ],
    cta: "Start Weekly Digest",
    highlight: true,
  },
  {
    id: "enterprise",
    price: "$499",
    cadence: "/mo",
    name: "Enterprise",
    tagline: "Daily signals + statewide coverage.",
    features: [
      "Daily updates across all of Michigan",
      "API access to pipe signals into your sales tools",
      "Priority cross-referenced alerts with owner contact info",
      "Dedicated onboarding call with Matt",
    ],
    cta: "Go Enterprise",
  },
];

export default function IndustryPulse() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [supplierType, setSupplierType] = useState<SupplierType>("");
  const [loading, setLoading] = useState<Tier | null>(null);

  useEffect(() => {
    if (success) toast.success("Welcome to Growth Radar! Check your email for dashboard access.");
  }, [success]);

  const handleCheckout = async (tier: Tier) => {
    if (!email) { toast.error("Email is required"); return; }
    if (!supplierType) { toast.error("Please select your supply vertical so we send you the right signals"); return; }
    setLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-industry-pulse-checkout", {
        body: { email, company_name: company, phone, contact_name: company, tier, supplier_type: supplierType },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setLoading(null);
    }
  };

  const signals = [
    { icon: Shield, title: "Permit Surge Activity", desc: "Contractors pulling 3+ commercial permits in 30 days are buying more supplies. You get their name and contact before anyone else calls." },
    { icon: Factory, title: "Expansion Hiring Patterns", desc: "When a contractor posts jobs for additional techs, their supply volume is about to jump. That's your opening." },
    { icon: TrendingUp, title: "New Business Registrations", desc: "New HVAC/plumbing/electrical companies just registered with Michigan SOS. No distributor relationship yet — perfect timing." },
    { icon: Target, title: "Triple-Confirmed Accounts", desc: "When the same company shows up in permits + hiring + SOS registrations, confidence score hits 9–10. These are your highest-priority calls." },
  ];

  return (
    <>
      <SEOHead
        title="Growth Radar — Contractor Growth Intelligence for Suppliers | Detroit Web Agency"
        description="Know which Michigan contractors are growing before they call your competitors. Permit surges, hiring signals, and expansion intel for plumbing, HVAC, and electrical supply houses."
      />
      <div className="min-h-screen bg-[#030711] text-white">
        {/* Hero */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-[#00d4ff]" />
              <span className="text-[#00d4ff] text-xs font-semibold tracking-wide">GROWTH RADAR — CONTRACTOR GROWTH INTELLIGENCE</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Know Which Contractors Are About to Buy
              <span className="text-[#00d4ff]"> From Your Competitors</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
              Daily scans of Metro Detroit permit filings, hiring patterns, and expansion signals.
              Built for plumbing wholesalers, HVAC distributors, and electrical supply houses who want to win accounts before the competition gets the call.
            </p>

            {success ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-400">You're In!</h3>
                <p className="text-sm text-white/60 mt-1">Check your email for your dashboard link. Signals start flowing immediately.</p>
              </div>
            ) : (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6 max-w-lg mx-auto space-y-3">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider text-left">Your supply vertical *</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SUPPLIER_TYPES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSupplierType(s.value)}
                      className={`px-3 py-2 text-xs font-bold border rounded transition-colors text-left ${supplierType === s.value ? "bg-[#00d4ff] text-black border-[#00d4ff]" : "bg-[#0f1f35] border-[#1e3a5f] text-white/70 hover:border-[#00d4ff]/50"}`}
                    >
                      {s.label}
                      <span className="block text-[9px] font-normal mt-0.5 opacity-60">{s.example}</span>
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Business email *"
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
                <p className="text-[11px] text-white/40 text-center">Pick your tier below — signals filtered to your vertical ↓</p>
              </div>
            )}
          </div>
        </section>

        {/* Signal Types */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-4">
              Four Signal Types. <span className="text-[#00d4ff]">All Filtered to Your Vertical.</span>
            </h2>
            <p className="text-center text-white/40 text-sm mb-10">A plumbing wholesaler only sees plumbing contractor signals. An HVAC distributor only sees HVAC. No noise.</p>
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
            <h2 className="text-2xl font-black mb-10">How It Works for Distributors</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Eye, title: "We Scan Daily", desc: "BSEED permit filings, H-2B visa applications, new company registrations — 16+ sources scanned every morning." },
                { icon: BarChart3, title: "AI Scores & Routes", desc: "Each signal scored 1–10. Filtered to your supply vertical. Cross-referenced signals get priority." },
                { icon: Zap, title: "Your Rep Calls First", desc: "Signal lands in your inbox before the contractor hits your competitor's website. Win the account before the bid." },
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

        {/* 3-tier Pricing */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Pick Your Tier</h2>
            <p className="text-center text-white/40 text-sm mb-10">All tiers include the same signal quality. Choose your cadence.</p>
            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`bg-[#0a1628] rounded-2xl p-8 flex flex-col ${
                    tier.highlight
                      ? "border-2 border-[#00d4ff] shadow-[0_0_40px_rgba(0,212,255,0.15)]"
                      : "border border-[#1e3a5f]"
                  }`}
                >
                  {tier.highlight && (
                    <div className="self-start bg-[#00d4ff] text-black text-[10px] font-black tracking-wider px-2 py-1 rounded mb-3">MOST POPULAR</div>
                  )}
                  <p className="text-[#00d4ff] text-xs font-semibold tracking-wider mb-1">{tier.name.toUpperCase()}</p>
                  <p className="text-4xl font-black text-white mb-1">
                    {tier.price}<span className="text-lg text-white/40">{tier.cadence}</span>
                  </p>
                  <p className="text-white/50 text-sm mb-6">{tier.tagline}</p>
                  <ul className="text-left space-y-2 mb-8 flex-1">
                    {tier.features.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <CheckCircle className="h-4 w-4 text-[#00d4ff] mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleCheckout(tier.id)}
                    disabled={loading !== null}
                    className={`w-full h-11 font-bold ${
                      tier.highlight
                        ? "bg-[#00d4ff] text-black hover:bg-[#00b8d9]"
                        : "bg-[#1e3a5f] text-white hover:bg-[#2a4a75] border border-[#00d4ff]/20"
                    }`}
                  >
                    {loading === tier.id ? "Loading..." : tier.cta}
                    {loading !== tier.id && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FCRA / B2B Disclaimer — required for all market intelligence products */}
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
            <h3 className="text-amber-400 text-sm font-bold tracking-wider mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> B2B INTELLIGENCE DISCLOSURE
            </h3>
            <ul className="text-white/60 text-xs space-y-2 leading-relaxed">
              <li>
                <strong className="text-white/80">B2B market intelligence — not a consumer report.</strong> Growth Radar is a business-to-business sales intelligence tool. It is <strong>not</strong> a consumer report under the Fair Credit Reporting Act (FCRA).
              </li>
              <li>
                <strong className="text-white/80">Not for FCRA-regulated decisions.</strong> Do not use Growth Radar signals to make decisions about employment, credit, insurance, housing, or any other purpose covered by the FCRA.
              </li>
              <li>
                <strong className="text-white/80">Public-source data.</strong> Signals are derived from publicly available sources (MIOSHA license database, municipal bond filings, public job postings, news releases). Accuracy is not guaranteed — independently verify before commercial action.
              </li>
              <li>
                <strong className="text-white/80">Subscriber responsibility.</strong> You are responsible for compliance with TCPA, CAN-SPAM, and all applicable laws when contacting companies surfaced in signals.
              </li>
            </ul>
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
