import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Cloud, Home, Database, CheckCircle, Zap } from "lucide-react";

const TEAL = "#00d4ff";
const BG = "#0a1628";

const SIGNALS = [
  { icon: Home, label: "BSEED Roof Permits", desc: "Every roof permit pulled in your ZIPs is a gutter upsell window. Most contractors never mention it — new roofs void their warranty without matching gutters. You call first." },
  { icon: Cloud, label: "NOAA Storm Alerts", desc: "Real-time NWS wind, rain, and ice alerts by county. Storm events are the #1 cause of gutter failures in Michigan. We alert you the same day — while homeowners are still assessing damage." },
  { icon: Waves, label: "FEMA Disaster Declarations", desc: "Federal disaster declarations trigger insurance claim windows. Storm-damaged gutters are one of the most overlooked line items. We notify you the same day FEMA declares your county." },
];

const SOURCES = [
  "City of Detroit BSEED building permit feed (roof keyword)",
  "NOAA NWS real-time severe weather alerts API",
  "FEMA disaster declarations API (open federal data)",
  "FFIEC HMDA new homeowner originations (deferred gutter maintenance)",
  "LegalNews foreclosure notices (deferred maintenance signal)",
  "OpenFEMA NFIP flood claims data (gutter/drainage failure proxy)",
];

export default function GuttersRadar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTrial = async () => {
    if (!email) { toast.error("Email required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-radar-trial", {
        body: { product: "gutters_radar", email, contact_name: name, business_name: business, phone },
      });
      if (error || !data?.ok) throw new Error(data?.error || "Failed");
      toast.success("Check your email — your free trial link is on its way.");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      {/* Nav */}
      <nav className="border-b border-[#1e3a5f] px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-bold text-sm tracking-widest uppercase" style={{ color: TEAL }}>Detroit Web Agency</span>
        <Button size="sm" onClick={() => navigate("/gutters-radar/demo")} variant="outline"
          className="border-[#1e3a5f] text-[#94a3b8] hover:text-white">See Sample Report</Button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border mb-6"
          style={{ color: TEAL, borderColor: TEAL + "50", background: TEAL + "10" }}>
          Gutters Radar · Detroit Web Agency
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
          Know which homeowners just got a new roof<br />
          <span style={{ color: TEAL }}>and need gutters before their warranty is void.</span>
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-2xl mx-auto">
          We scan roof permits, storm alerts, and FEMA declarations every morning — and deliver scored leads to your inbox. The window closes in 21 days. You need to call today.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate("/gutters-radar/demo")} variant="outline"
            className="border-[#1e3a5f] text-[#94a3b8] hover:text-white px-6">
            View Sample Report
          </Button>
          <Button onClick={() => document.getElementById("trial-form")?.scrollIntoView({ behavior: "smooth" })}
            className="font-bold px-8" style={{ background: TEAL, color: BG }}>
            Start Free 7-Day Trial →
          </Button>
        </div>
      </section>

      {/* Signals */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-bold text-center mb-8">3 signal types that trigger a lead</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {SIGNALS.map((s) => (
            <div key={s.label} className="bg-[#0f2133] border border-[#1e3a5f] rounded-xl p-6">
              <s.icon className="mb-3 h-6 w-6" style={{ color: TEAL }} />
              <h3 className="font-bold mb-2">{s.label}</h3>
              <p className="text-[#94a3b8] text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Engine */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-[#0f2133] border border-[#1e3a5f] rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6" style={{ color: TEAL }} />
            <h2 className="text-xl font-bold">We built the search engine. You get the leads.</h2>
          </div>
          <p className="text-[#94a3b8] mb-6">
            Replicating this infrastructure costs <span className="text-white font-semibold">$1,500–2,500/month</span> in API subscriptions and 4–6 months of engineering time.
            Your subscription gets you the scored, verified output — delivered every morning for a fraction of that.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mb-6">
            {SOURCES.map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm text-[#cbd5e1]">
                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: TEAL }} />
                {s}
              </div>
            ))}
          </div>
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 flex-shrink-0" style={{ color: TEAL }} />
            <p className="text-sm text-[#94a3b8]">
              Every source is checked every morning. Leads hit your inbox by 8am with a score, address, signal type, and suggested opener. No login required.
            </p>
          </div>
        </div>
      </section>

      {/* ROI math */}
      <section className="max-w-4xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-xl font-bold mb-6">The math is simple</h2>
        <div className="grid md:grid-cols-3 gap-4 text-left">
          {[
            { label: "Average MI gutter replacement", value: "$1,800" },
            { label: "Leads/month in your ZIPs", value: "20–60" },
            { label: "Close 1 job from our leads", value: "14× your sub cost" },
          ].map((item) => (
            <div key={item.label} className="bg-[#0f2133] border border-[#1e3a5f] rounded-xl p-6 text-center">
              <div className="text-3xl font-extrabold mb-2" style={{ color: TEAL }}>{item.value}</div>
              <div className="text-[#94a3b8] text-sm">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bundle callout */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-[#0f2133] border border-[#1e3a5f] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: TEAL }}>Storm Bundle</div>
            <p className="font-bold text-lg">Roofing Radar + Gutters Radar</p>
            <p className="text-[#94a3b8] text-sm">Same roof permit. Two revenue streams. $249/mo (save $79/mo vs separate).</p>
          </div>
          <Button onClick={() => document.getElementById("trial-form")?.scrollIntoView({ behavior: "smooth" })}
            variant="outline" className="border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a1628] whitespace-nowrap">
            Start Bundle Trial
          </Button>
        </div>
      </section>

      {/* Pricing + Trial form */}
      <section id="trial-form" className="max-w-lg mx-auto px-6 pb-24">
        <div className="bg-[#0f2133] border border-[#1e3a5f] rounded-2xl p-8 text-center">
          <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: TEAL }}>7-Day Free Trial · No Credit Card</div>
          <div className="text-4xl font-extrabold mb-1">$64<span className="text-lg font-normal text-[#94a3b8]">/mo</span></div>
          <div className="text-[#94a3b8] text-sm mb-6">First 3 months · Then $129/mo · Cancel anytime</div>
          <div className="space-y-3 mb-6 text-left">
            <Input placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
              className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            <Input placeholder="Business name" value={business} onChange={e => setBusiness(e.target.value)}
              className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            <Input placeholder="Email address *" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            <Input placeholder="Phone (for 9+/10 SMS alerts)" value={phone} onChange={e => setPhone(e.target.value)}
              className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          </div>
          <Button onClick={handleTrial} disabled={loading} className="w-full font-bold py-3 text-base"
            style={{ background: TEAL, color: BG }}>
            {loading ? "Sending trial link…" : "Start Free Trial — No CC Required →"}
          </Button>
          <p className="text-[#64748b] text-xs mt-4">You'll get a magic link by email. No password. No card. Just leads.</p>
        </div>
      </section>
    </div>
  );
}
