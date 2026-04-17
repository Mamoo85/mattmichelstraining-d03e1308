import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Radio, Zap, Bell, MapPin, Wrench, ArrowRight } from "lucide-react";

const TRADES = ["HVAC", "Plumbing", "Roofing", "Electrical", "Concrete", "Landscaping", "Painting", "General"];
const METRO_CITIES = ["Detroit", "Grosse Pointe", "Royal Oak", "Birmingham", "Troy", "Sterling Heights", "Warren", "Livonia", "Dearborn", "Southfield", "Novi", "Farmington Hills"];

export default function TheWire() {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [radarSignals, setRadarSignals] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const [leadsRes, signalsRes] = await Promise.all([
        supabase
          .from("contractor_leads" as any)
          .select("id, trade, city, description, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("industry_pulse_signals" as any)
          .select("id, company_name, location, county, expansion_type, signal_type, recommended_pitch, summary, confidence, detected_at")
          .gte("detected_at", since)
          .gte("confidence", 6)
          .order("confidence", { ascending: false })
          .limit(4),
      ]);
      setRecentLeads((leadsRes.data as any[]) || []);
      setRadarSignals((signalsRes.data as any[]) || []);
    })();

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      alert("✅ You're on The Wire. Your first morning digest hits tomorrow at 7am ET.");
    }
  }, []);

  const toggle = (arr: string[], v: string, setter: (x: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !businessName) return alert("Email and business name required.");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-wire-checkout", {
        body: {
          email, business_name: businessName, contact_name: contactName, phone,
          trades: selectedTrades, cities: selectedCities,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      alert("Checkout failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead
        title="The Wire — Daily Contractor Leads | Detroit Web Agency"
        description="Get fresh contractor leads in Metro Detroit delivered to your inbox every morning at 7am ET. $99/mo. Cancel anytime."
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.15),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-xs font-bold tracking-widest mb-6">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE FEED · METRO DETROIT
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
            The Wire.
            <span className="block text-[#00d4ff]">Fresh leads, every morning.</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mb-8">
            Homeowners submit jobs through our network all day. At 7am ET we wire the previous 24 hours of fresh local leads — filtered to your trades and cities — straight to your inbox.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">📬 7am ET daily digest</span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">🎯 Filtered by trade + city</span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">⚡ Claim with one click</span>
          </div>
        </div>
      </section>

      {/* Live feed preview */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#00d4ff]" /> Last 48 hours on The Wire
          </h2>
          <span className="text-xs text-white/40">Live preview</span>
        </div>
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl divide-y divide-white/5">
          {recentLeads.length === 0 && (
            <div className="px-5 py-10 text-center text-white/40 text-sm">
              No leads in the last 48 hours. Subscribe to be first when they hit.
            </div>
          )}
          {recentLeads.map((l) => (
            <div key={l.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] font-bold">{l.trade || "LEAD"}</span>
                  <span className="text-white/50 flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city || "Metro Detroit"}</span>
                  <span className="text-white/30 ml-auto">{new Date(l.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-white/70 mt-1 line-clamp-2">{l.description || "Contact details available to subscribers"}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-b from-[#0f1f35] to-[#0a1628] border border-[#00d4ff]/30 rounded-2xl p-6 md:p-10">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-2xl md:text-3xl font-black">Get on The Wire</h2>
            <div className="text-right">
              <div className="text-3xl font-black text-[#00d4ff]">$99<span className="text-base text-white/50">/mo</span></div>
              <div className="text-xs text-white/40">Cancel anytime</div>
            </div>
          </div>
          <p className="text-sm text-white/60 mb-6">Pick your trades + cities. Get the morning digest at 7am ET tomorrow.</p>

          <form onSubmit={subscribe} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-3">
              <input required value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder="Business name *" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff]" />
              <input value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Your name" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff]" />
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email *" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff]" />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Phone" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff]" />
            </div>

            <div>
              <div className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Your trades</div>
              <div className="flex flex-wrap gap-2">
                {TRADES.map(t => (
                  <button type="button" key={t} onClick={() => toggle(selectedTrades, t, setSelectedTrades)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      selectedTrades.includes(t)
                        ? "bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Cities you serve</div>
              <div className="flex flex-wrap gap-2">
                {METRO_CITIES.map(c => (
                  <button type="button" key={c} onClick={() => toggle(selectedCities, c, setSelectedCities)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      selectedCities.includes(c)
                        ? "bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#00d4ff] hover:bg-[#33ddff] text-[#0a1628] font-black py-4 rounded-lg text-base disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? "Loading checkout…" : <>Subscribe to The Wire — $99/mo <ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="text-xs text-white/40 text-center">Secure checkout via Stripe. Cancel anytime from your account.</p>
          </form>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6 text-sm">
        <div><Bell className="h-6 w-6 text-[#00d4ff] mb-2" /><div className="font-bold">7am ET digest</div><p className="text-white/50 mt-1">Coffee + leads. Every morning. Filtered to what you actually do.</p></div>
        <div><Zap className="h-6 w-6 text-[#00d4ff] mb-2" /><div className="font-bold">One-click claim</div><p className="text-white/50 mt-1">Tap a lead in the email, lock the contact info before competitors see it.</p></div>
        <div><Radio className="h-6 w-6 text-[#00d4ff] mb-2" /><div className="font-bold">No long contracts</div><p className="text-white/50 mt-1">$99/mo. Cancel any time. No setup fees, no commitments.</p></div>
      </section>
    </div>
  );
}
