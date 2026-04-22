import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import { Factory, Target, Zap, FileText, TrendingUp, Bell, CheckCircle, ArrowRight, Award, Users } from "lucide-react";

type Tier = "core" | "pro" | "enterprise";

const TIERS: { id: Tier; price: number; name: string; tagline: string; features: string[]; highlight?: boolean }[] = [
  {
    id: "core",
    price: 399,
    name: "Core",
    tagline: "Daily buyer-intent alerts",
    features: [
      "Federal contract awards (NAICS 332/336) in MI/OH/IN",
      "New commercial building permits (BSEED + counties)",
      "Manufacturing entity filings (MI SOS)",
      "SBA 504 loan approvals > $500k",
      "Hiring surges: welder / fabricator / machinist",
      "Daily email + SMS alert",
    ],
  },
  {
    id: "pro",
    price: 599,
    name: "Pro",
    tagline: "Named-account watchlist",
    highlight: true,
    features: [
      "Everything in Core",
      "Upload your top 50 target accounts",
      "Per-account monitoring: permits, hiring, contracts, news, exec changes",
      "Quarterly stolen-share competitor report",
      "Salespeople walk into Monday meetings ahead of every account",
    ],
  },
  {
    id: "enterprise",
    price: 799,
    name: "Enterprise",
    tagline: "RFQ Intercept",
    features: [
      "Everything in Pro",
      "Daily RFQ scan: SAM.gov + state procurement portals",
      "Filtered to NAICS 332 / 333 / 336 in MI / OH / IN",
      "Estimators see bids the day they drop",
      "Replaces Reed / ConstructConnect / Dodge ($3k–$15k/yr) for a fraction",
    ],
  },
];

const SIGNALS = [
  { icon: Award, title: "Federal Contract Awards", desc: "ABC Defense just won a $4.2M Army contract (NAICS 336992) — armored vehicles need structural steel. Now." },
  { icon: Factory, title: "Permit Surges", desc: "Acme Auto Parts pulled an $1.8M expansion permit in Warren — capex is unlocked." },
  { icon: Users, title: "Hiring Patterns", desc: "XYZ Manufacturing posted 4 welder jobs this week — they're ramping production." },
  { icon: TrendingUp, title: "SBA 504 Loans", desc: "Manufacturer just got approved for $2M expansion capital — buying season starts now." },
];

export default function BuyerRadar() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [tier, setTier] = useState<Tier>("pro");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (success) toast.success("Welcome to Buyer Radar! Check your email for your dashboard link.");
  }, [success]);

  const handleCheckout = async (selected: Tier) => {
    if (!email) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-buyer-radar-checkout", {
        body: {
          email,
          company_name: company,
          phone,
          contact_name: contactName || company,
          vertical: "steel",
          tier: selected,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead
        title="Buyer Radar — Daily Industrial Buyer Intelligence | Detroit Web Agency"
        description="Real-time alerts on Metro Detroit manufacturers about to buy steel, fab work, machining, and powder coat. Federal contracts, permits, hiring, RFQs — delivered daily."
      />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight">Buyer Radar</span>
            <span className="text-xs text-[#64748b] uppercase tracking-widest hidden sm:inline">by Detroit Web Agency</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[0.4em] uppercase mb-4">For Steel, Fab & Industrial Suppliers</p>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 text-white">
          Know who's about to buy <span className="text-[#00d4ff]">— before they put it out for quote.</span>
        </h1>
        <p className="text-lg sm:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-10">
          Daily buyer-intent signals for Metro Detroit manufacturers: federal contract wins, expansion permits, hiring surges, SBA loans, and live RFQs. Your salespeople walk in already knowing.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Input
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-[#0a1628] border-[#1e3a5f] text-white"
          />
          <Button
            onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"
          >
            See Plans <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">The signals we surface</h2>
        <p className="text-center text-[#94a3b8] mb-10">All from public + government data — refreshed daily.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {SIGNALS.map((s) => (
            <div key={s.title} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <s.icon className="w-5 h-5 text-[#00d4ff]" />
                <h3 className="font-bold text-white">{s.title}</h3>
              </div>
              <p className="text-sm text-[#94a3b8]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">Pick your tier</h2>
        <p className="text-center text-[#94a3b8] mb-10">One closed deal pays for 10+ years. Start free for 14 days, cancel anytime.</p>

        <div className="mb-8 max-w-2xl mx-auto grid sm:grid-cols-3 gap-3">
          <Input placeholder="Work email *" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl p-6 border-2 ${t.highlight ? "border-[#00d4ff] bg-[#00d4ff]/5" : "border-[#1e3a5f] bg-[#0a1628]"}`}
            >
              {t.highlight && (
                <div className="inline-block bg-[#00d4ff] text-black text-[10px] font-extrabold tracking-widest px-2 py-1 rounded mb-3">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-xl font-bold text-white">{t.name}</h3>
              <p className="text-sm text-[#94a3b8] mb-4">{t.tagline}</p>
              <p className="text-4xl font-extrabold text-white mb-1">${t.price}<span className="text-base text-[#94a3b8] font-normal">/mo</span></p>
              <ul className="space-y-2 my-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#cbd5e1]">
                    <CheckCircle className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout(t.id)}
                disabled={loading}
                className={`w-full font-bold ${t.highlight ? "bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90" : "bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/80"}`}
              >
                {loading ? "Loading…" : `Start ${t.name}`}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Why this beats Reed / ConstructConnect / Dodge</h2>
        <p className="text-[#94a3b8] mb-8">Those tools cost $3,000–$15,000/year, drown you in irrelevant national data, and never tell you when a buyer just won funding. Buyer Radar is laser-focused on YOUR NAICS in YOUR region — and shows the leading indicator (the contract win, the permit, the SBA loan) instead of the lagging one (the RFQ).</p>
        <a href="tel:+13139921219" className="inline-flex items-center gap-2 text-[#00d4ff] font-bold">
          <Bell className="w-4 h-4" /> Talk to Matt directly: (313) 992-1219
        </a>
      </section>

      <footer className="border-t border-[#1e3a5f] py-8 text-center text-xs text-[#64748b]">
        Detroit Web Agency · Buyer Radar · We Handle The Tech
      </footer>
    </div>
  );
}
