import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Thermometer, Cloud, Home, Database, CheckCircle, Zap } from "lucide-react";

const TEAL = "#00d4ff";
const BG = "#0a1628";

const SIGNALS = [
  { icon: Thermometer, label: "NOAA Extreme Weather Alerts", desc: "Real-time NWS heat advisories, freeze warnings, and ice storms. When temps spike or plummet, HVAC failures follow — you're calling before the homeowner is on hold with a competitor." },
  { icon: Home, label: "BSEED Mechanical Permits", desc: "City of Detroit mechanical permit feed — every HVAC installation in the last 30 days. A permit pulled is a system installed. Adjacent homes are on borrowed time." },
  { icon: Cloud, label: "FEMA Disaster Declarations", desc: "Federal disaster declarations (ice storms, flooding) create insurance claim windows. We alert you the same day FEMA declares your county a disaster area." },
];

const SOURCES = [
  "NOAA NWS real-time severe weather alerts API",
  "FEMA disaster declarations API (open federal data)",
  "City of Detroit BSEED mechanical permit feed",
  "OpenFEMA NFIP flood insurance claims by ZIP",
  "FFIEC HMDA new homeowner originations (102k+ MI annually)",
  "USGS structural event data (earthquake/subsidence)",
];

export default function HVACRadar() {
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
        body: { product: "hvac_radar", email, contact_name: name, business_name: business, phone },
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
        <Button size="sm" onClick={() => navigate("/hvac-radar/demo")} variant="outline"
          className="border-[#1e3a5f] text-[#94a3b8] hover:text-white">See Sample Report</Button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border mb-6"
          style={{ color: TEAL, borderColor: TEAL + "50", background: TEAL + "10" }}>
          HVAC Radar · Detroit Web Agency
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
          Know which homeowners' systems are about to fail<br />
          <span style={{ color: TEAL }}>before they call the first name they Google.</span>
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-2xl mx-auto">
          We cross-reference live weather events, FEMA declarations, and city permit data every morning — and deliver scored leads straight to your inbox. You call. You close.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate("/hvac-radar/demo")} variant="outline"
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
            Building this infrastructure yourself costs <span className="text-white font-semibold">$1,500–2,500/month</span> in API subscriptions and 4–6 months of engineering time.
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
              Every source is scanned every morning. Leads hit your inbox by 8am with a score, address, signal type, and suggested opener. No login required.
            </p>
          </div>
        </div>
      </section>

      {/* ROI math */}
      <section className="max-w-4xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-xl font-bold mb-6">The math is simple</h2>
        <div className="grid md:grid-cols-3 gap-4 text-left">
          {[
            { label: "Average MI HVAC replacement", value: "$7,500" },
            { label: "Leads/month in your ZIPs", value: "15–40" },
            { label: "Close 1 job from our leads", value: "30× your sub cost" },
          ].map((item) => (
            <div key={item.label} className="bg-[#0f2133] border border-[#1e3a5f] rounded-xl p-6 text-center">
              <div className="text-3xl font-extrabold mb-2" style={{ color: TEAL }}>{item.value}</div>
              <div className="text-[#94a3b8] text-sm">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing + Trial form */}
      <section id="trial-form" className="max-w-lg mx-auto px-6 pb-24">
        <div className="bg-[#0f2133] border border-[#1e3a5f] rounded-2xl p-8 text-center">
          <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: TEAL }}>7-Day Free Trial · No Credit Card</div>
          <div className="text-4xl font-extrabold mb-1">$124<span className="text-lg font-normal text-[#94a3b8]">/mo</span></div>
          <div className="text-[#94a3b8] text-sm mb-6">First 3 months · Then $249/mo · Cancel anytime</div>
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
