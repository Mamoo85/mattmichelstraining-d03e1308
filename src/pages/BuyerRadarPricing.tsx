import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Factory, CheckCircle2, X, ArrowRight, Sparkles } from "lucide-react";

type Tier = "core" | "pro" | "enterprise";

const FEATURES: { label: string; core: boolean | string; pro: boolean | string; ent: boolean | string; cust: boolean | string }[] = [
  { label: "Federal contract awards (NAICS 332/336)", core: true,  pro: true,  ent: true,  cust: true },
  { label: "Commercial building permits (BSEED + counties)", core: true,  pro: true,  ent: true,  cust: true },
  { label: "Manufacturing entity filings (MI SOS)", core: true,  pro: true,  ent: true,  cust: true },
  { label: "SBA 504 loan approvals > $500k", core: true,  pro: true,  ent: true,  cust: true },
  { label: "Hiring surges (welder, fabricator, machinist)", core: true,  pro: true,  ent: true,  cust: true },
  { label: "Daily email + SMS alerts", core: true,  pro: true,  ent: true,  cust: true },
  { label: "Named-account watchlist", core: false, pro: "Up to 50", ent: "Up to 200", cust: "Unlimited" },
  { label: "Quarterly competitor report", core: false, pro: true,  ent: true,  cust: true },
  { label: "Daily RFQ intercept (SAM.gov + state)", core: false, pro: false, ent: true,  cust: true },
  { label: "Custom NAICS codes", core: false, pro: false, ent: false, cust: true },
  { label: "Multi-state coverage (beyond MI/OH/IN)", core: false, pro: false, ent: false, cust: true },
  { label: "Dedicated CSM + onboarding", core: false, pro: false, ent: true,  cust: true },
  { label: "API access (push to your CRM)", core: false, pro: false, ent: false, cust: true },
];

const TIER_META = [
  { id: "core" as Tier,       name: "Core",       price: "$399",  tagline: "Daily buyer-intent alerts" },
  { id: "pro" as Tier,        name: "Pro",        price: "$599",  tagline: "Named-account watchlist", highlight: true },
  { id: "enterprise" as Tier, name: "Enterprise", price: "$799",  tagline: "RFQ intercept" },
];

export default function BuyerRadarPricing() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  // Custom request form
  const [c, setC] = useState({
    company_name: "", contact_name: "", email: "", phone: "",
    target_accounts: "", geographic_radius: "", message: "",
  });
  const [customLoading, setCustomLoading] = useState(false);
  const [customSent, setCustomSent] = useState(false);

  const startCheckout = async (tier: Tier) => {
    if (!email) { toast.error("Email is required"); return; }
    setLoadingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-buyer-radar-checkout", {
        body: { email, company_name: company, phone, contact_name: company, vertical: "steel", tier },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed");
    } finally {
      setLoadingTier(null);
    }
  };

  const submitCustom = async () => {
    if (!c.company_name || !c.email) { toast.error("Company and email are required"); return; }
    setCustomLoading(true);
    try {
      const { error } = await supabase.functions.invoke("request-buyer-radar-custom", { body: c });
      if (error) throw error;
      setCustomSent(true);
      toast.success("Got it. Matt will reach out within one business day.");
    } catch (e: any) {
      toast.error(e?.message || "Submit failed");
    } finally {
      setCustomLoading(false);
    }
  };

  const cell = (v: boolean | string) => {
    if (v === true)  return <CheckCircle2 className="w-4 h-4 text-[#00d4ff] mx-auto" />;
    if (v === false) return <X className="w-4 h-4 text-[#1e3a5f] mx-auto" />;
    return <span className="text-xs text-[#cbd5e1]">{v}</span>;
  };

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead
        title="Buyer Radar Pricing — Compare All Tiers | Detroit Web Agency"
        description="Compare Core, Pro, Enterprise, and Custom Buyer Radar plans. Side-by-side feature matrix and a custom plan request form for high-volume buyers."
      />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/buyer-radar" className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight">Buyer Radar</span>
            <span className="text-xs text-[#64748b] uppercase tracking-widest hidden sm:inline">Pricing</span>
          </Link>
          <Link to="/buyer-radar/demo" className="text-sm text-[#00d4ff] font-semibold">See the demo →</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <section className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white">Compare every plan</h1>
          <p className="text-[#94a3b8] max-w-2xl mx-auto">Pick the tier that matches how aggressively you're hunting. Need more? Build a custom plan.</p>
        </section>

        {/* Lead capture for checkout */}
        <section className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-3 mb-8">
          <Input placeholder="Work email *" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
        </section>

        {/* Feature matrix */}
        <section className="overflow-x-auto bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-4 sm:p-6">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr>
                <th className="text-left py-4 px-3 text-xs uppercase tracking-widest text-[#64748b]">Feature</th>
                {TIER_META.map((t) => (
                  <th key={t.id} className={`text-center py-4 px-3 ${t.highlight ? "bg-[#00d4ff]/5 rounded-t-lg" : ""}`}>
                    <div className="font-bold text-white">{t.name}</div>
                    <div className="text-2xl font-extrabold text-[#00d4ff]">{t.price}<span className="text-xs text-[#94a3b8] font-normal">/mo</span></div>
                    <div className="text-[10px] text-[#94a3b8] mt-1">{t.tagline}</div>
                  </th>
                ))}
                <th className="text-center py-4 px-3">
                  <div className="font-bold text-white">Custom</div>
                  <div className="text-2xl font-extrabold text-[#00d4ff]">Quote</div>
                  <div className="text-[10px] text-[#94a3b8] mt-1">Built for you</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-t border-[#1e3a5f]/60">
                  <td className="py-3 px-3 text-[#cbd5e1]">{f.label}</td>
                  <td className="py-3 px-3 text-center">{cell(f.core)}</td>
                  <td className="py-3 px-3 text-center bg-[#00d4ff]/5">{cell(f.pro)}</td>
                  <td className="py-3 px-3 text-center">{cell(f.ent)}</td>
                  <td className="py-3 px-3 text-center">{cell(f.cust)}</td>
                </tr>
              ))}
              <tr className="border-t border-[#1e3a5f]">
                <td className="py-4 px-3"></td>
                {TIER_META.map((t) => (
                  <td key={t.id} className="py-4 px-3 text-center">
                    <Button
                      onClick={() => startCheckout(t.id)}
                      disabled={loadingTier !== null}
                      className={`w-full font-bold ${t.highlight ? "bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90" : "bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/80"}`}
                    >
                      {loadingTier === t.id ? "Loading…" : `Start ${t.name}`}
                    </Button>
                  </td>
                ))}
                <td className="py-4 px-3 text-center">
                  <a href="#custom" className="inline-flex items-center justify-center w-full px-3 py-2 rounded font-bold bg-white/5 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10">
                    Request quote
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Custom plan form */}
        <section id="custom" className="mt-16 max-w-3xl mx-auto bg-[#0a1628] border border-[#00d4ff]/30 rounded-2xl p-6 sm:p-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#00d4ff]" />
            <h2 className="text-2xl font-extrabold text-white">Request a custom plan</h2>
          </div>
          <p className="text-[#94a3b8] mb-6 text-sm">Multi-state coverage, custom NAICS, API push to your CRM, dedicated CSM. Tell us what you need — Matt responds within one business day.</p>

          {customSent ? (
            <div className="bg-[#030711] border border-[#22c55e]/40 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#22c55e] mx-auto mb-3" />
              <p className="text-white font-bold">Request received.</p>
              <p className="text-sm text-[#94a3b8] mt-1">Matt will reach out within one business day.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Company name *" value={c.company_name} onChange={(e) => setC({ ...c, company_name: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Input placeholder="Contact name" value={c.contact_name} onChange={(e) => setC({ ...c, contact_name: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Input placeholder="Work email *" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Input placeholder="Phone" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Input placeholder="# target accounts" type="number" value={c.target_accounts} onChange={(e) => setC({ ...c, target_accounts: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Input placeholder="Geographic radius (e.g. MI/OH/IN/IL)" value={c.geographic_radius} onChange={(e) => setC({ ...c, geographic_radius: e.target.value })} className="bg-[#030711] border-[#1e3a5f] text-white" />
              <Textarea placeholder="What do you need monitored?" value={c.message} onChange={(e) => setC({ ...c, message: e.target.value })} className="sm:col-span-2 bg-[#030711] border-[#1e3a5f] text-white min-h-[110px]" />
              <Button onClick={submitCustom} disabled={customLoading} className="sm:col-span-2 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                {customLoading ? "Sending…" : <>Send request <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[#1e3a5f] py-8 text-center text-xs text-[#64748b]">
        Detroit Web Agency · Buyer Radar · We Handle The Tech
      </footer>
    </div>
  );
}
