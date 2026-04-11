import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Phone, CheckCircle, XCircle, Shield, Zap, Clock, DollarSign, ArrowRight, X, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TERRITORIES = [
  { slug: "hvac-detroit", trade: "HVAC", city: "Detroit", state: "MI", monthly: "$399" },
  { slug: "hvac-warren", trade: "HVAC", city: "Warren", state: "MI", monthly: "$399" },
  { slug: "hvac-sterling-heights", trade: "HVAC", city: "Sterling Heights", state: "MI", monthly: "$399" },
  { slug: "hvac-dearborn", trade: "HVAC", city: "Dearborn", state: "MI", monthly: "$399" },
  { slug: "hvac-livonia", trade: "HVAC", city: "Livonia", state: "MI", monthly: "$399" },
  { slug: "plumbing-detroit", trade: "Plumbing", city: "Detroit", state: "MI", monthly: "$399" },
  { slug: "plumbing-sterling-heights", trade: "Plumbing", city: "Sterling Heights", state: "MI", monthly: "$399" },
  { slug: "plumbing-dearborn", trade: "Plumbing", city: "Dearborn", state: "MI", monthly: "$399" },
  { slug: "plumbing-troy", trade: "Plumbing", city: "Troy", state: "MI", monthly: "$399" },
  { slug: "plumbing-livonia", trade: "Plumbing", city: "Livonia", state: "MI", monthly: "$399" },
  { slug: "electrician-detroit", trade: "Electrical", city: "Detroit", state: "MI", monthly: "$399" },
  { slug: "electrician-dearborn", trade: "Electrical", city: "Dearborn", state: "MI", monthly: "$399" },
  { slug: "electrician-warren", trade: "Electrical", city: "Warren", state: "MI", monthly: "$399" },
  { slug: "electrician-troy", trade: "Electrical", city: "Troy", state: "MI", monthly: "$399" },
  { slug: "electrician-livonia", trade: "Electrical", city: "Livonia", state: "MI", monthly: "$399" },
  { slug: "roofing-detroit", trade: "Roofing", city: "Detroit", state: "MI", monthly: "$399" },
  { slug: "roofing-warren", trade: "Roofing", city: "Warren", state: "MI", monthly: "$399" },
  { slug: "roofing-troy", trade: "Roofing", city: "Troy", state: "MI", monthly: "$399" },
  { slug: "roofing-southfield", trade: "Roofing", city: "Southfield", state: "MI", monthly: "$399" },
  { slug: "roofing-livonia", trade: "Roofing", city: "Livonia", state: "MI", monthly: "$399" },
];

const WINS = [
  "Every lead is exclusive — you're the only contractor who gets it",
  "Leads are real homeowners who searched for your service, filled out a form, and asked to be contacted",
  "You get name, phone, email, and project details via SMS + email within minutes",
  "Flat monthly fee — no per-lead charges, no surprises",
  "7-day free trial — cancel anytime, no contracts",
];

const PAIN = [
  { label: "Angi / HomeAdvisor", sub: "Same lead sold to 4–8 contractors. You're bidding against yourself." },
  { label: "Thumbtack", sub: "$10–$100/lead, shared. You still compete on price." },
  { label: "Facebook Ads", sub: "You pay for clicks. Most don't convert. Requires constant management." },
  { label: "Word of mouth alone", sub: "Good but unpredictable. Feast or famine." },
];

interface HypeModalProps {
  territory: typeof TERRITORIES[0];
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function HypeModal({ territory, onClose, onConfirm, loading }: HypeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1e293b] border border-slate-600 rounded-xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white">
          <X size={20} />
        </button>
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Zap size={28} className="text-primary" />
          </div>
          <h3 className="text-xl font-black text-white">You're about to lock in {territory.city}</h3>
          <p className="text-slate-400 text-sm mt-1">{territory.trade} — {territory.city}, {territory.state}</p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200"><strong className="text-white">Exclusive territory.</strong> No other {territory.trade.toLowerCase()} company in {territory.city} gets these leads. Ever.</p>
          </div>
          <div className="flex items-start gap-3">
            <Zap size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200"><strong className="text-white">Instant delivery.</strong> New leads hit your phone via SMS + email within minutes. No login required.</p>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200"><strong className="text-white">No per-lead fees.</strong> Flat {territory.monthly}/mo after your free trial. One job pays for months of leads.</p>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200"><strong className="text-white">7-day free trial.</strong> See real leads before you pay a dime. Cancel anytime.</p>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200"><strong className="text-white">Daily-prorated refunds.</strong> Cancel mid-month? You get back every unused day. Just a $10 processing fee. No games.</p>
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "Opening checkout..." : <>Start Free Trial <ArrowRight size={16} /></>}
        </button>
        <p className="text-center text-[11px] text-slate-500 mt-3">
          7-day free trial. {territory.monthly}/mo after. Cancel anytime — daily-prorated refunds, $10 processing fee.
        </p>
      </div>
    </div>
  );
}

export default function ContractorLeads() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedTerritory, setSelectedTerritory] = useState<typeof TERRITORIES[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "", trade: "", city: "" });
  const [takenSlugs, setTakenSlugs] = useState<Set<string>>(new Set());

  const successTrade = searchParams.get("trade");
  const successCity = searchParams.get("city");
  const isSuccess = searchParams.get("success") === "1";

  // Load territory availability on mount
  useEffect(() => {
    supabase
      .from("contractor_lead_sites" as never)
      .select("slug, active_contractor_id")
      .then(({ data }) => {
        if (!data) return;
        const taken = new Set(
          (data as { slug: string; active_contractor_id: string | null }[])
            .filter((r) => r.active_contractor_id !== null)
            .map((r) => r.slug)
        );
        setTakenSlugs(taken);
      });
  }, []);

  const handleTerritoryClick = (t: typeof TERRITORIES[0]) => {
    if (takenSlugs.has(t.slug)) return;
    setForm((f) => ({ ...f, trade: t.trade.toLowerCase(), city: t.city }));
    setShowForm(true);
    setTimeout(() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleFormSubmit = () => {
    if (!form.email || !form.name || !form.phone) {
      toast({ title: "Please fill out all fields", variant: "destructive" });
      return;
    }
    const territory = TERRITORIES.find(
      (t) => t.trade.toLowerCase() === form.trade && t.city === form.city
    );
    if (!territory) {
      toast({ title: "Please select a territory first", variant: "destructive" });
      return;
    }
    if (takenSlugs.has(territory.slug)) {
      toast({ title: "That territory is already taken", description: "Pick another city or trade.", variant: "destructive" });
      return;
    }
    setSelectedTerritory(territory);
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-checkout", {
        body: {
          email: form.email,
          name: form.name,
          business_name: form.business_name || form.name,
          phone: form.phone,
          trade: form.trade,
          city: form.city,
          state: "MI",
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Success state — shown after returning from Stripe checkout
  if (isSuccess) {
    return (
      <>
        <SEOHead title="You're In — Contractor Leads | M² Lead Network" description="" />
        <div className="min-h-screen bg-background flex items-center justify-center px-6 py-20">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-3">
              You're locked in.
            </h1>
            {successTrade && successCity && (
              <p className="text-primary font-bold text-lg mb-4">
                {successTrade} — {successCity}, MI
              </p>
            )}
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Your 7-day free trial has started. Every {successTrade?.toLowerCase() || "contractor"} lead that comes in for {successCity || "your territory"} goes <strong className="text-foreground">only to you</strong>. You'll get an SMS + email the moment a new lead arrives.
            </p>
            <div className="bg-[#1e293b] rounded-xl p-5 text-left space-y-3 mb-8">
              <p className="text-sm text-slate-300"><span className="text-green-400 font-bold">✓</span> Territory reserved exclusively for you</p>
              <p className="text-sm text-slate-300"><span className="text-green-400 font-bold">✓</span> Welcome email sent — check your inbox</p>
              <p className="text-sm text-slate-300"><span className="text-green-400 font-bold">✓</span> SMS notifications active on new leads</p>
              <p className="text-sm text-slate-300"><span className="text-green-400 font-bold">✓</span> $399/mo begins after your free trial</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Questions? Text or call Matt directly:{" "}
              <a href="tel:+13138064952" className="text-primary font-bold hover:underline">(313) 806-4952</a>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Exclusive Contractor Leads — Metro Detroit | M² Lead Network"
        description="Exclusive roofing, HVAC, plumbing, and electrical leads in Metro Detroit. No shared leads. One contractor per trade per city. $399/mo flat fee with 7-day free trial."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Lead Network</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">Exclusive contractor leads.<br />One company per city.</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Every roofing, HVAC, plumbing, and electrical lead generated in your Metro Detroit market goes <strong className="text-white">only to you</strong>. No Angi. No shared bids. $399/mo flat — 7-day free trial.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setShowForm(true); setTimeout(() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 font-bold text-sm transition-all inline-flex items-center gap-2"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
            <a href="tel:+13138064952" className="border border-white/30 text-white px-6 py-3 font-bold text-sm hover:bg-white/10 transition-all inline-flex items-center gap-2">
              <Phone size={14} /> (313) 806-4952
            </a>
          </div>
        </div>

        {/* Why Not Angi */}
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

          {/* Founder Intro */}
          <div className="bg-[#1e293b] text-white p-5 mb-10 flex items-center gap-5">
            <img
              src="/images/matt-family-cornfield.jpg"
              alt="Matt Michels"
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
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

          {/* Open Territories */}
          <h2 className="text-lg font-black text-foreground mb-2 uppercase tracking-wide">Open territories — Metro Detroit</h2>
          <p className="text-sm text-muted-foreground mb-4">Click any available territory to claim it. First contractor to sign up owns it exclusively.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
            {TERRITORIES.map((t) => {
              const taken = takenSlugs.has(t.slug);
              return (
                <button
                  key={t.slug}
                  onClick={() => handleTerritoryClick(t)}
                  disabled={taken}
                  className={`border p-4 flex items-center justify-between transition-all text-left group ${
                    taken
                      ? "bg-slate-900/50 border-slate-700 opacity-60 cursor-not-allowed"
                      : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm text-foreground">{t.trade} — {t.city}, {t.state}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {taken ? "Territory taken" : `${t.monthly}/mo after 7-day free trial`}
                    </p>
                  </div>
                  {taken
                    ? <Lock size={14} className="text-slate-500 flex-shrink-0" />
                    : <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  }
                </button>
              );
            })}
          </div>

          {/* Signup Form */}
          {showForm && (
            <div id="signup-form" className="bg-[#1e293b] border border-slate-600 rounded-xl p-6 mb-12">
              <h3 className="text-lg font-black text-white mb-4">Claim your territory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Your name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Business name"
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
                />
                <input
                  type="email"
                  placeholder="Email address *"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
                />
                <input
                  type="tel"
                  placeholder="Phone number *"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
                />
                <select
                  value={form.trade}
                  onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded"
                >
                  <option value="">Select trade *</option>
                  <option value="hvac">HVAC</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="roofing">Roofing</option>
                </select>
                <select
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded"
                >
                  <option value="">Select city *</option>
                  <option value="Detroit">Detroit</option>
                  <option value="Warren">Warren</option>
                  <option value="Sterling Heights">Sterling Heights</option>
                  <option value="Dearborn">Dearborn</option>
                  <option value="Troy">Troy</option>
                  <option value="Southfield">Southfield</option>
                  <option value="Livonia">Livonia</option>
                </select>
              </div>
              <button
                onClick={handleFormSubmit}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded text-sm transition-all"
              >
                Continue to checkout
              </button>
              <p className="text-center text-[11px] text-slate-500 mt-2">7-day free trial. $399/mo after. Cancel anytime.</p>
            </div>
          )}

          {/* Refund Policy */}
          <div className="bg-green-950/20 border border-green-900/30 p-5 rounded-lg mb-10">
            <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
              <Shield size={16} className="text-green-500" /> Our refund policy is dead simple
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cancel anytime. If you cancel mid-month, we refund every unused day — prorated daily. Your monthly rate divided by 30, times the days remaining. We keep a flat <strong className="text-foreground">$10 processing fee</strong>. That's it. No hoops, no waiting, no "retention department." You text Matt, you're done.
            </p>
            <p className="text-[12px] text-muted-foreground mt-2">
              Example: Cancel on day 10? You get back 20 days worth — that's $266 minus $10 = <strong className="text-foreground">$256 refund</strong>. Fair for everyone.
            </p>
          </div>

          {/* Bottom CTA */}
          <div className="text-center py-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Don't see your city? Have questions?</p>
            <a href="tel:+13138064952" className="text-primary font-bold text-sm hover:underline inline-flex items-center gap-1">
              <Phone size={14} /> Call Matt — (313) 806-4952
            </a>
          </div>
        </div>
      </div>

      {/* Hype Modal */}
      {selectedTerritory && (
        <HypeModal
          territory={selectedTerritory}
          onClose={() => setSelectedTerritory(null)}
          onConfirm={handleCheckout}
          loading={loading}
        />
      )}
    </>
  );
}
