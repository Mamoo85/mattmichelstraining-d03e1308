import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TRADE_OPTIONS = [
  { key: "hvac", label: "HVAC" },
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "roofing", label: "Roofing" },
  { key: "concrete", label: "Concrete / Masonry" },
  { key: "windows", label: "Windows / Siding" },
];

const COUNTY_OPTIONS = [
  { key: "Wayne", label: "Wayne County" },
  { key: "Oakland", label: "Oakland County" },
  { key: "Macomb", label: "Macomb County" },
  { key: "Washtenaw", label: "Washtenaw County" },
];

const ACCENT = "#00d4ff";
const BG = "#0a1628";

export default function HighVolumeBuyerAlerts() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";

  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [trades, setTrades] = useState<string[]>(["hvac", "plumbing", "electrical"]);
  const [counties, setCounties] = useState<string[]>(["Wayne", "Oakland", "Macomb"]);
  const [minPermits, setMinPermits] = useState(5);
  const [loading, setLoading] = useState(false);

  const toggleTrade = (k: string) =>
    setTrades((prev) => (prev.includes(k) ? prev.filter((t) => t !== k) : [...prev, k]));
  const toggleCounty = (k: string) =>
    setCounties((prev) => (prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k]));

  const handleCheckout = async () => {
    if (!email || !businessName) {
      toast({ title: "Required", description: "Email and supply house name are required.", variant: "destructive" });
      return;
    }
    if (trades.length === 0 || counties.length === 0) {
      toast({ title: "Pick at least one", description: "Select at least one trade and county.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-high-volume-buyer-checkout", {
        body: {
          email,
          business_name: businessName,
          contact_name: contactName,
          phone,
          target_trades: trades,
          target_counties: counties,
          min_permit_count: minPermits,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message || "Try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ background: BG, minHeight: "100vh" }} className="flex items-center justify-center px-4">
        <SEOHead
          title="Welcome — High-Volume Buyer Alerts"
          description="Your weekly buyer digest starts Monday."
          path="/high-volume-buyer-alerts"
        />
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">You're In.</h1>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Your first weekly digest hits your inbox <strong>this Monday at 7am</strong>. We're already aggregating
            permit data on contractors in your trades.
          </p>
          <Link to="/">
            <Button className="w-full" style={{ background: ACCENT, color: BG }}>
              Back to Detroit Web Agency
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh" }} className="text-white">
      <SEOHead
        title="High-Volume Buyer Permit Package — $199/mo"
        description="Weekly digest of Metro Detroit contractors pulling 5+ permits in your trade. Verified active accounts with contact emails and material spend estimates. Built for supply houses."
        path="/high-volume-buyer-alerts"
      />

      {/* HERO */}
      <section className="px-4 py-12 md:py-20 max-w-4xl mx-auto">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6"
             style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}55` }}>
          📦 For Supply Houses
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          Stop guessing which contractors{" "}
          <span style={{ color: ACCENT }}>actually buy.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 leading-relaxed mb-8 max-w-3xl">
          Every Monday at 7am, you get a digest of every Metro Detroit contractor that pulled{" "}
          <strong className="text-white">5+ permits in the last 30 days</strong> in your trades — with contact emails,
          project addresses, and estimated material spend.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { n: "5+", label: "Active permits per buyer" },
            { n: "$199", label: "Per month, cancel anytime" },
            { n: "1", label: "Email per week" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-5 text-center"
                 style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ACCENT}22` }}>
              <div className="text-3xl font-black mb-1" style={{ color: ACCENT }}>{s.n}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SAMPLE PREVIEW */}
      <section className="px-4 pb-12 max-w-4xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: ACCENT }}>
          What a digest entry looks like
        </p>
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", borderLeft: `4px solid ${ACCENT}` }}>
          <p className="text-xl font-black mb-2">Reliable HVAC LLC</p>
          <p className="text-sm text-slate-300 mb-3">
            <strong style={{ color: ACCENT }}>7 active permits</strong> · Est. material spend:{" "}
            <strong>$85k</strong> · HVAC, Plumbing
          </p>
          <p className="text-sm text-slate-200 mb-1">📧 Contacts: ops@reliablehvac.com, purchasing@reliablehvac.com</p>
          <p className="text-xs text-slate-400">📍 Recent projects: 14290 Mack Ave, Detroit · 3402 Cass Ave, Detroit</p>
        </div>
      </section>

      {/* WHY IT WORKS */}
      <section className="px-4 py-12 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black mb-8">Why supply houses sign up</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { icon: "🏗️", title: "Verified active accounts", body: "5+ permits = real, scaling operations. Not tire-kickers, not one-off projects." },
            { icon: "📧", title: "Direct contact emails", body: "We auto-enrich with purchasing manager and ops contacts via Hunter — no gatekeeper calls." },
            { icon: "💰", title: "Estimated material spend", body: "Permit values × industry-standard material ratios = approximate $$ each buyer is spending." },
            { icon: "📍", title: "Project addresses", body: "Know where they're working — drop a sales rep in person if the account is worth it." },
          ].map((b, i) => (
            <div key={i} className="rounded-xl p-5"
                 style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ACCENT}22` }}>
              <div className="text-3xl mb-3">{b.icon}</div>
              <h3 className="text-lg font-bold mb-2">{b.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CHECKOUT FORM */}
      <section className="px-4 py-12 max-w-2xl mx-auto">
        <div className="rounded-2xl p-6 md:p-8 bg-white text-slate-900">
          <h2 className="text-2xl md:text-3xl font-black mb-2">Start Monday's digest</h2>
          <p className="text-slate-600 text-sm mb-6">
            $199/mo · cancel anytime · first digest within 7 days
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Supply house name *</label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Plumbing Supply" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Contact name</label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Mike Johnson" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(313) 555-0100" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Email *</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@supplyhouse.com" />
              <p className="text-xs text-slate-500 mt-1">Where we send the weekly digest</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Target trades</label>
              <div className="flex flex-wrap gap-2">
                {TRADE_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => toggleTrade(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      trades.includes(t.key)
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Counties</label>
              <div className="flex flex-wrap gap-2">
                {COUNTY_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleCounty(c.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      counties.includes(c.key)
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Min permits per buyer</label>
              <Input
                type="number"
                min={3}
                max={20}
                value={minPermits}
                onChange={(e) => setMinPermits(Math.max(3, Math.min(20, parseInt(e.target.value) || 5)))}
              />
              <p className="text-xs text-slate-500 mt-1">Default: 5+ permits in 30 days. Raise this to focus on the largest buyers only.</p>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full h-12 text-base font-black"
              style={{ background: BG, color: ACCENT }}
            >
              {loading ? "Loading…" : "Start — $199/mo"}
            </Button>
            <p className="text-xs text-center text-slate-500">
              Secure checkout via Stripe · Cancel anytime from your inbox link
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-4 py-8 text-center text-xs text-slate-500 border-t border-white/5">
        Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219
      </footer>
    </div>
  );
}
