import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Phone, CheckCircle, XCircle } from "lucide-react";

const TRADES = [
  { slug: "roofing-chicago", trade: "Roofing", city: "Chicago", state: "IL", monthly: "$249" },
  { slug: "hvac-columbus", trade: "HVAC", city: "Columbus", state: "OH", monthly: "$249" },
  { slug: "plumbing-phoenix", trade: "Plumbing", city: "Phoenix", state: "AZ", monthly: "$249" },
  { slug: "electrical-dallas", trade: "Electrical", city: "Dallas", state: "TX", monthly: "$249" },
  { slug: "roofing-charlotte", trade: "Roofing", city: "Charlotte", state: "NC", monthly: "$199" },
  { slug: "hvac-denver", trade: "HVAC", city: "Denver", state: "CO", monthly: "$199" },
  { slug: "plumbing-nashville", trade: "Plumbing", city: "Nashville", state: "TN", monthly: "$199" },
  { slug: "gutters-atlanta", trade: "Gutters / Siding", city: "Atlanta", state: "GA", monthly: "$199" },
];

const WINS = [
  "Every lead is exclusive — you're the only contractor who gets it",
  "Leads are real homeowners who searched for your service, filled out a form, and asked to be contacted",
  "You get name, phone, email, and project details in your inbox within minutes",
  "Flat monthly fee — no per-lead charges, no surprises",
  "Cancel anytime — no contracts, no minimums",
];

const PAIN = [
  { label: "Angi / HomeAdvisor", sub: "Same lead sold to 4–8 contractors. You're bidding against yourself." },
  { label: "Thumbtack", sub: "$10–$100/lead, shared. You still compete on price." },
  { label: "Facebook Ads", sub: "You pay for clicks. Most don't convert. Requires constant management." },
  { label: "Word of mouth alone", sub: "Good but unpredictable. Feast or famine." },
];

export default function ContractorLeads() {
  return (
    <>
      <SEOHead
        title="Exclusive Contractor Leads — Any City in the US | M2 Lead Network"
        description="Exclusive roofing, HVAC, plumbing, and electrical leads in your market. No shared leads. One contractor per trade per city. Flat monthly fee."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero Banner */}
        <div className="w-full">
          <img
            src="/images/hero-contractor-leads.png"
            alt="Contractor Lead System — Exclusive leads in your city"
            className="w-full object-cover"
          />
        </div>
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M2 Lead Network</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">Exclusive contractor leads.<br />One company per city.</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Every roofing, HVAC, plumbing, and electrical lead generated in your market goes <strong className="text-white">only to you</strong>. No Angi. No shared bids. Flat monthly fee — cancel anytime.
          </p>
          <div className="mt-6">
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
          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">Open territories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
            {TRADES.map((t) => (
              <div key={t.slug} className="bg-card border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-foreground">{t.trade} — {t.city}, {t.state}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Starting at {t.monthly}/mo</p>
                </div>
              </div>
            ))}
          </div>

          {/* Waitlist Gate */}
          <WaitlistGate
            productName="Contractor Leads"
            description="We're onboarding a limited number of contractors in select markets. Join the waitlist and Matt will reach out personally when your area opens up."
          />
        </div>
      </div>
    </>
  );
}
