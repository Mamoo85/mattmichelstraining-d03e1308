import { useState, useEffect, useMemo } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, ArrowRight, Lock } from "lucide-react";
import DWAStickyNav from "@/components/shared/DWAStickyNav";
import WallOfLove, { Testimonial } from "@/components/shared/WallOfLove";
import EnterpriseFooterBlock from "@/components/shared/EnterpriseFooterBlock";

// Trade catalog — must match create-contractor-checkout normalizeTrade map.
const TRADES = [
  { value: "electrical", label: "Electrical", monthly: 399 },
  { value: "hvac", label: "HVAC", monthly: 399 },
  { value: "plumbing", label: "Plumbing", monthly: 399 },
  { value: "roofing", label: "Roofing", monthly: 399 },
  { value: "boiler", label: "Boiler / Mechanical", monthly: 399 },
  { value: "gutters", label: "Gutters", monthly: 299 },
  { value: "siding", label: "Siding", monthly: 299 },
];

type Territory = {
  id: string;
  city: string;
  trade: string;
  slug: string;
  active: boolean;
  active_contractor_id: string | null;
};

const WINS = [
  "Every lead is exclusive — you're the only contractor who gets it",
  "Real homeowners who asked us to send them a contractor",
  "Name, phone, email in your inbox in minutes",
  "Flat monthly fee — no per-lead charges, no surprises",
  "Cancel anytime — no contracts, no minimums",
];

const PAIN = [
  { label: "Angi / HomeAdvisor", sub: "Same lead sold to 4–8 contractors. You're bidding against yourself." },
  { label: "Thumbtack", sub: "$10–$100/lead, shared. You still compete on price." },
  { label: "Facebook Ads", sub: "You pay for clicks. Most don't convert. Requires constant management." },
];

const TESTIMONIALS: Testimonial[] = [
  { quote: "First exclusive lead came in on day 3. Booked the job. The $399 paid for itself in one afternoon.", name: "Chris A.", trade: "HVAC Contractor, Metro Detroit", initials: "CA" },
  { quote: "I've tried Angi, Thumbtack, everything. This is the first time I'm actually the only one calling the homeowner back.", name: "Steve R.", trade: "Roofing, Wayne County", initials: "SR" },
  { quote: "The quality is different. These people actually requested service. I'm not cold-calling — I'm closing.", name: "Mike D.", trade: "Plumbing, Metro Detroit", initials: "MD" },
  { quote: "Locked down the electrical territory in Metro Detroit. Best business decision I've made this year.", name: "Tom B.", trade: "Electrician, Oakland County", initials: "TB" },
  { quote: "Matt was upfront about how it works. No smoke and mirrors. The leads show up, I close them.", name: "Paul H.", trade: "HVAC, Macomb County", initials: "PH" },
];

function normalizeTradeParam(raw: string | null): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  return TRADES.find(t => t.value === lower)?.value || "";
}

function normalizeCityParam(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/\b\w/g, l => l.toUpperCase());
}

export default function ContractorLeads() {
  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "1";
  const successCid = params.get("cid") || "";
  const refToken = params.get("ref") || "";
  const expired = params.get("expired") === "1";

  const rawTradeParam = params.get("trade");
  const rawCityParam = params.get("city");
  const initialTrade = normalizeTradeParam(rawTradeParam);
  const initialCity = normalizeCityParam(rawCityParam);
  // If a trade= param was supplied but didn't match the allowlist, flag it so we can show a friendly banner.
  const unknownTradeParam = !!rawTradeParam && !initialTrade ? rawTradeParam : "";

  const [trade, setTrade] = useState<string>(initialTrade);
  const [city, setCity] = useState<string>(initialCity);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  // Set when the URL ?city= param doesn't match any active territory for the selected trade.
  const [unknownCity, setUnknownCity] = useState<string>("");
  const [form, setForm] = useState({
    name: params.get("name") || "",
    business_name: params.get("business_name") || "",
    email: params.get("prefilled_email") || "",
    phone: params.get("phone") || "",
  });
  const [loading, setLoading] = useState(false);

  const selectedTrade = useMemo(() => TRADES.find(t => t.value === trade), [trade]);
  const monthly = selectedTrade?.monthly || 399;
  const tradeLabel = selectedTrade?.label || "";
  const isPrefilled = !!(initialTrade && initialCity);

  // Load territories from DB whenever trade changes.
  useEffect(() => {
    if (!trade) { setTerritories([]); return; }
    setTerritoriesLoading(true);
    // Trade stored as title-case in DB (HVAC, Plumbing, etc.)
    const dbTrade = TRADES.find(t => t.value === trade)?.label || trade;
    supabase
      .from("contractor_lead_sites")
      .select("id, city, trade, slug, active, active_contractor_id")
      .ilike("trade", dbTrade)
      .eq("active", true)
      .order("city")
      .then(({ data }) => {
        setTerritories(data || []);
        setTerritoriesLoading(false);
        // If the city from URL params is NOT in the active list, surface a friendly banner
        // and clear the selection so the user falls back to manually picking one.
        if (initialCity && data && !data.find(t => t.city.toLowerCase() === initialCity.toLowerCase())) {
          setUnknownCity(initialCity);
          setCity("");
        } else {
          setUnknownCity("");
        }
      });
  }, [trade]);

  // Auto-scroll to form when arriving with deep-link params.
  useEffect(() => {
    if ((isPrefilled || unknownTradeParam || unknownCity) && !success) {
      setTimeout(() => document.getElementById("territory")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    }
  }, [isPrefilled, unknownTradeParam, unknownCity, success]);

  const scrollToTerritory = () => document.getElementById("territory")?.scrollIntoView({ behavior: "smooth" });

  const availableTerritories = territories.filter(t => !t.active_contractor_id);
  const claimedTerritories = territories.filter(t => !!t.active_contractor_id);
  const selectedTerritory = territories.find(t => t.city.toLowerCase() === city.toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) { toast.error("Please pick a profession"); return; }
    if (!city.trim()) { toast.error("Please pick or enter a territory"); return; }
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-checkout", {
        body: {
          email: form.email,
          name: form.name,
          business_name: form.business_name || form.name,
          phone: form.phone,
          trade,
          city: city.trim(),
          state: "MI",
          ref: refToken || undefined,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const statusUrl = successCid
      ? `/contractor-onboarding-status?contractor_id=${encodeURIComponent(successCid)}`
      : `/contractor-onboarding-status`;
    const successTradeLabel = tradeLabel || "your trade";
    const successCity = city || "your territory";
    const bookmarkUrl = (initialTrade && initialCity)
      ? `https://detroitwebagent.com/contractor-leads?trade=${encodeURIComponent(initialTrade)}&city=${encodeURIComponent(initialCity)}`
      : `https://detroitwebagent.com/contractor-leads`;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              ✅ You're all set for {successTradeLabel} — {successCity}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your territory is reserved. Welcome email is on its way.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <a href="sms:+13139921219" className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors">
              <div className="text-2xl mb-1">📱</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Save Matt's #</div>
              <div className="text-sm font-bold text-foreground">(313) 992-1219</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Tap to text</div>
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(bookmarkUrl);
                toast.success("Bookmark URL copied");
              }}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors"
            >
              <div className="text-2xl mb-1">🔖</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Bookmark page</div>
              <div className="text-[11px] text-foreground font-mono break-all leading-tight">{bookmarkUrl}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Tap to copy</div>
            </button>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl mb-1">📧</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Check email</div>
              <div className="text-sm font-bold text-foreground">Welcome guide</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Arrives in ~2 min</div>
            </div>
          </div>

          <a href={statusUrl} className="block bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4 text-left hover:bg-primary/15 transition-colors">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Track activation</div>
            <div className="text-sm font-bold text-foreground mb-1">Payment pending → Ready</div>
            <div className="text-xs text-muted-foreground leading-relaxed">See real-time activation status and when your welcome SMS will arrive →</div>
          </a>

          <p className="text-xs text-muted-foreground text-center">
            First lead usually arrives within 3–7 days. Questions? <a href="sms:+13139921219" className="text-primary font-bold hover:underline">Text Matt</a>
          </p>
        </div>
      </div>
    );
  }

  const heroTitle = isPrefilled
    ? `Claim ${tradeLabel} leads in ${city}, MI`
    : "Exclusive contractor leads. One company per trade per city.";

  return (
    <>
      <SEOHead
        title={isPrefilled ? `${tradeLabel} Leads — ${city}, MI | Detroit Web Agency` : "Exclusive Contractor Leads — Metro Detroit | Detroit Web Agency"}
        description={isPrefilled ? `Exclusive ${tradeLabel.toLowerCase()} leads in ${city}, Michigan. One contractor per territory. $${monthly}/mo.` : "Exclusive roofing, HVAC, plumbing, and electrical leads in Metro Detroit. No shared leads."}
      />
      <DWAStickyNav productName="Exclusive Contractor Leads" ctaLabel="Claim Your Territory →" ctaOnClick={scrollToTerritory} accentColor="#00d4ff" bgColor="#0a1628" />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#0a1628] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Detroit Web Agency</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">{heroTitle}</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            {isPrefilled
              ? <>Every {tradeLabel.toLowerCase()} lead generated in {city} goes <strong className="text-white">only to you</strong>. ${monthly}/mo flat. Cancel anytime.</>
              : <>Every roofing, HVAC, plumbing, and electrical lead generated in your territory goes <strong className="text-white">only to you</strong>. No Angi. No shared bids. Flat monthly fee — cancel anytime.</>
            }
          </p>
          <div className="mt-8">
            <button onClick={scrollToTerritory} className="bg-primary text-white px-8 py-4 font-bold text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2">
              {isPrefilled ? `Lock in ${city} — $${monthly}/mo` : "Claim My Territory — $399/mo"} <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-lg font-black text-foreground mb-6 uppercase tracking-wide">Why contractors hate Angi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {PAIN.map((p) => (
              <div key={p.label} className="bg-red-950/20 border border-red-900/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={14} className="text-red-500 flex-shrink-0" />
                  <span className="font-bold text-sm text-foreground">{p.label}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">{p.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#0a1628] text-white p-5 mb-10 flex items-center gap-5">
            <img src="/images/matt-family-cornfield.jpg" alt="Matt Michels" className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
            <p className="text-sm text-slate-200 leading-relaxed">
              <span className="font-bold text-white">I'm Matt Michels — local guy, dad, Grosse Pointe.</span>{" "}
              I built this because I watched good contractors get killed by Angi's shared lead model. Every lead I send is yours alone.
            </p>
          </div>

          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">How this works</h2>
          <div className="space-y-3 mb-10">
            {WINS.map((w) => (
              <div key={w} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-y border-border bg-card">
          <WallOfLove testimonials={TESTIMONIALS} accentColor="#00d4ff" theme="light" title="What Our Contractors Say" />
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 id="territory" className="text-lg font-black text-foreground mb-2 uppercase tracking-wide">Pick your territory</h2>
          <p className="text-sm text-muted-foreground mb-4">One contractor per trade per city. Choose your profession and city below.</p>

          {expired && (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-4">
              <p className="text-sm font-bold text-foreground">
                ⏰ This signup link has expired.
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pick your trade and city below to continue — or text Matt at (313) 992-1219 for a fresh link.
              </p>
            </div>
          )}

          {unknownTradeParam && (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-4">
              <p className="text-sm font-bold text-foreground">
                ⚠️ We couldn't find a trade called "{unknownTradeParam}".
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pick your profession from the list below — or text Matt at <a href="sms:+13139921219" className="text-primary underline">(313) 992-1219</a> for help.
              </p>
            </div>
          )}

          {unknownCity && trade && (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-4">
              <p className="text-sm font-bold text-foreground">
                ⚠️ "{unknownCity}" isn't an active {tradeLabel || "territory"} city right now.
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pick an open city below, or <a href="sms:+13139921219" className="text-primary underline">text Matt</a> to request {unknownCity} as a new territory.
              </p>
            </div>
          )}

          {isPrefilled && city && selectedTerritory && !selectedTerritory.active_contractor_id && (
            <div className="bg-primary/10 border-l-4 border-primary p-3 mb-4">
              <p className="text-sm font-bold text-foreground">
                ✅ {tradeLabel} — {city}, MI is available. Fill in your info below to claim it.
              </p>
            </div>
          )}

          {isPrefilled && city && selectedTerritory?.active_contractor_id && (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 mb-4">
              <p className="text-sm font-bold text-foreground">⚠️ {tradeLabel} — {city} is already claimed.</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pick another city below, or <a href="sms:+13139921219" className="text-primary underline">text Matt</a> to get on the waitlist.</p>
            </div>
          )}

          <div className="bg-card border border-border p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Trade */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Step 1 — Select your profession *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TRADES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTrade(t.value); setCity(""); }}
                      className={`px-3 py-2 text-xs font-bold border transition-colors text-left ${trade === t.value ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground hover:border-primary"}`}
                    >
                      {t.label}<br /><span className="font-normal opacity-70">${t.monthly}/mo</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Territory — live from DB */}
              {trade && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                    Step 2 — Pick your territory *
                    {territoriesLoading && <span className="ml-2 text-muted-foreground font-normal normal-case">Loading…</span>}
                  </label>

                  {!territoriesLoading && territories.length === 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 text-sm">
                      <p className="font-bold text-foreground mb-1">No territories configured yet for {tradeLabel}.</p>
                      <p className="text-muted-foreground text-xs">Text Matt at <a href="sms:+13139921219" className="text-primary underline">(313) 992-1219</a> — he'll set up your city and send you a direct link.</p>
                    </div>
                  )}

                  {!territoriesLoading && territories.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availableTerritories.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCity(t.city)}
                          className={`px-3 py-2.5 text-xs font-bold border transition-colors text-left ${city === t.city ? "bg-primary text-white border-primary" : "bg-background border-green-600/40 text-foreground hover:border-primary"}`}
                        >
                          {t.city}
                          <span className={`block text-[10px] font-normal mt-0.5 ${city === t.city ? "text-white/80" : "text-green-500"}`}>● OPEN</span>
                        </button>
                      ))}
                      {claimedTerritories.map(t => (
                        <div key={t.id} className="px-3 py-2.5 text-xs font-bold border border-border bg-muted/30 text-muted-foreground cursor-not-allowed select-none">
                          {t.city}
                          <span className="block text-[10px] font-normal mt-0.5 text-red-400 flex items-center gap-1"><Lock size={8} className="inline" /> CLAIMED</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation bar */}
              {trade && city && selectedTerritory && !selectedTerritory.active_contractor_id && (
                <div className="bg-primary/5 border border-primary/20 px-3 py-2 text-[12px] font-bold text-foreground">
                  ✓ {tradeLabel} leads in {city}, MI — ${monthly}/mo, exclusive territory, cancel anytime
                </div>
              )}

              {/* Step 3: Contact info — only shown once a valid territory is selected */}
              {trade && city && selectedTerritory && !selectedTerritory.active_contractor_id && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Step 3 — Your contact info</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Your Name *</label>
                      <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" required className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Business Name</label>
                      <input type="text" value={form.business_name} onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Your company name" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Email *</label>
                      <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@yourcompany.com" required className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Phone</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !trade || !city || !selectedTerritory || !!selectedTerritory?.active_contractor_id}
                className="w-full bg-primary text-white font-bold py-3 text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Opening checkout…</>
                ) : (
                  <>{trade && city && selectedTerritory && !selectedTerritory.active_contractor_id ? `Claim ${tradeLabel} — ${city} ($${monthly}/mo)` : trade && !city ? "← Select a territory above" : "Claim My Territory"} <ArrowRight size={14} /></>
                )}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Secure checkout via Stripe. Cancel anytime. First month begins on activation.
              </p>
            </form>
          </div>
        </div>

        <EnterpriseFooterBlock accentColor="#00d4ff" isDark={false} />
      </div>
    </>
  );
}
