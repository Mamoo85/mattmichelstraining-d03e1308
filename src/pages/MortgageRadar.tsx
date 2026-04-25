import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import { Home, Target, Shield, FileText, TrendingUp, Bell, CheckCircle, ArrowRight, MapPin, Lock } from "lucide-react";
import ReceiptStatusBanner from "@/components/checkout/ReceiptStatusBanner";
import CheckEmailCard from "@/components/checkout/CheckEmailCard";
import ActionButton from "@/components/ui/action-button";

type Tier = "solo" | "team";

const TIERS: { id: Tier; price: number; name: string; tagline: string; zips: number; features: string[]; highlight?: boolean }[] = [
  {
    id: "solo",
    price: 399,
    zips: 5,
    name: "Solo LO",
    tagline: "One loan officer, 5 ZIP codes",
    highlight: true,
    features: [
      "10–25 in-market leads/day in your ZIPs",
      "Each lead scored 1–10 with suggested opener",
      "SMS alert on every 9–10 score",
      "One-click 7-day claim lock — no double-calling",
      "Weekly warm-pipeline digest",
      "Add extra ZIPs for $50/mo each",
    ],
  },
  {
    id: "team",
    price: 899,
    zips: 15,
    name: "Branch Team",
    tagline: "5 loan officers, 15 ZIP codes",
    features: [
      "Everything in Solo, for 5 LOs",
      "15 ZIPs included (vs 5)",
      "Shared lead pool with per-LO claim locks",
      "Weekly branch-level performance digest",
      "Priority support",
    ],
  },
];

const SIGNALS = [
  { icon: Home, title: "Renovation Permits", desc: "Kitchen, addition, or whole-house permit pulled in the last 7 days — likely cash-out refi or HELOC." },
  { icon: MapPin, title: "FSBO Listings", desc: "For-sale-by-owner — they'll need a new mortgage when the next purchase happens." },
  { icon: Shield, title: "Foreclosure / Lis Pendens", desc: "Pre-foreclosure notices filed at the county — refi or short-sale candidates moving fast." },
  { icon: TrendingUp, title: "New Self-Employed LLCs", desc: "MI SOS just registered the business — bank-statement loan candidates 12–18 months out." },
];

const COMPLIANCE = [
  "100% public records and behavioral signals",
  "We do NOT access, purchase, or resell credit-bureau trigger leads",
  "FCRA-clean — Homebuyers Privacy Protection Act compliant",
  "All outreach drafts must be manually sent by the licensed loan officer",
];

export default function MortgageRadar() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [nmls, setNmls] = useState("");
  const [zipsInput, setZipsInput] = useState("");
  const [extraZips, setExtraZips] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (selected: Tier) => {
    if (!email) { toast.error("Email is required"); return; }
    const zip_codes = zipsInput.split(/[, ]+/).map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mortgage-radar-checkout", {
        body: {
          email,
          business_name: business,
          contact_name: contactName || business,
          nmls_number: nmls,
          phone,
          zip_codes,
          extra_zip_count: extraZips,
          tier: selected,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const tier = searchParams.get("tier") || "solo";
    const tierLabel = tier === "team" ? "Branch Team ($899/mo)" : "Solo LO ($399/mo)";
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="mb-6 space-y-3">
            <ReceiptStatusBanner sessionId={searchParams.get("session_id")} productLabel="Mortgage Radar" />
            <CheckEmailCard sessionId={searchParams.get("session_id")} />
          </div>
          <div className="text-6xl mb-6">🏠</div>
          <h1 className="text-3xl font-extrabold text-white mb-3">Mortgage Radar is Live</h1>
          <p className="text-[#00d4ff] text-lg font-bold mb-5">{tierLabel} · 7-day free trial started</p>
          <p className="text-[#94a3b8] text-sm leading-relaxed mb-8">
            Check your email — your dashboard link and first lead signals land within 24 hours. Your ZIPs are being activated now. Reply STOP to any SMS to opt out.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <a href="sms:+13139921219" className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 text-left hover:border-[#00d4ff] transition-colors">
              <div className="text-xl mb-1">📱</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] mb-1">Text Matt</div>
              <div className="text-xs text-white">(313) 992-1219</div>
            </a>
            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 text-left">
              <div className="text-xl mb-1">📧</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] mb-1">Check email</div>
              <div className="text-xs text-white">Dashboard link inside</div>
            </div>
            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 text-left">
              <div className="text-xl mb-1">⏱️</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] mb-1">First leads</div>
              <div className="text-xs text-white">Within 24 hours</div>
            </div>
          </div>
          <a
            href="/my-mortgage-radar"
            className="inline-block bg-[#00d4ff] text-black font-bold px-8 py-4 rounded-lg text-base hover:bg-[#00d4ff]/90 transition-colors"
          >
            Open Your Dashboard →
          </a>
          <p className="text-xs text-[#64748b] mt-4">
            All outreach drafts must be sent manually by you per TCPA. No auto-dialing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead
        title="Mortgage Radar — In-Market Mortgage Leads | Detroit Web Agency"
        description="FCRA-clean mortgage leads from public records: permits, FSBO, foreclosures, new LLCs. Catch borrowers BEFORE they pull credit. ZIP-exclusive for loan officers."
      />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight">Mortgage Radar</span>
            <span className="text-xs text-[#64748b] uppercase tracking-widest hidden sm:inline">by Detroit Web Agency</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border border-red-500/30 bg-red-500/10">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-300 text-xs font-bold tracking-widest uppercase">H.R. 2808 — In Effect Since March 4, 2026</span>
        </div>
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[0.4em] uppercase mb-4">For Mortgage Loan Officers</p>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 text-white">
          H.R. 2808 killed trigger leads.<br />
          <span className="text-[#00d4ff]">Here's what replaced them.</span>
        </h1>
        <p className="text-lg sm:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-6">
          Bureaus can no longer resell trigger leads without consumer consent. Mortgage Radar finds the same in-market borrowers <strong className="text-white">weeks earlier</strong> using public records: permits, FSBO, foreclosures, divorces, new LLCs, job changes.
        </p>
        <p className="text-sm text-[#64748b] max-w-xl mx-auto mb-10">
          You see them while there are still 0 other LOs calling — not after 47 of them already did.
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

      {/* Trigger Leads vs Mortgage Radar comparison */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">
          Trigger Leads <span className="text-red-400">(Banned)</span> vs <span className="text-[#00d4ff]">Mortgage Radar</span>
        </h2>
        <p className="text-center text-[#94a3b8] mb-10 text-sm max-w-2xl mx-auto">
          The Homebuyers Privacy Protection Act ended the credit-bureau resale model. The intent signal didn't disappear — it just moved upstream.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
            <div className="inline-block bg-red-500/20 text-red-300 text-[10px] font-extrabold tracking-widest px-2 py-1 rounded mb-3 uppercase">
              ⛔ Banned March 4, 2026
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Trigger Leads</h3>
            <ul className="space-y-2 text-sm text-[#cbd5e1]">
              <li>✗ Required consumer to apply for credit first</li>
              <li>✗ Sold to 8–47 competing LOs simultaneously</li>
              <li>✗ Borrower already shopping — race to the bottom</li>
              <li>✗ FCRA-restricted — illegal without explicit opt-in (H.R. 2808)</li>
              <li>✗ 1–2% conversion typical</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-[#00d4ff] bg-[#00d4ff]/5 p-6">
            <div className="inline-block bg-[#00d4ff] text-black text-[10px] font-extrabold tracking-widest px-2 py-1 rounded mb-3 uppercase">
              ✓ FCRA-Clean Replacement
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Mortgage Radar</h3>
            <ul className="space-y-2 text-sm text-[#cbd5e1]">
              <li>✓ 100% public records + behavioral signals</li>
              <li>✓ ZIP-exclusive — first LO in your ZIP gets it</li>
              <li>✓ Catch borrowers 1–6 weeks BEFORE they pull credit</li>
              <li>✓ FCRA-clean, no bureau dependency, no consent landmine</li>
              <li>✓ Real reason to call ("saw the kitchen permit")</li>
            </ul>
          </div>
        </div>

        {/* Brother case-study placeholder */}
        <div className="mt-6 rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#00d4ff] font-bold">📈</span>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase font-bold text-[#00d4ff] mb-1">Active Pilot — Metro Detroit</p>
              <h4 className="text-white font-bold mb-1">Licensed loan officer running 5 ZIPs</h4>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Real numbers from our active 30-day pilot drop here once the case study completes. In the meantime, talk to Matt to see the live dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>


      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">The signals we hunt</h2>
        <p className="text-center text-[#94a3b8] mb-10">All public + behavioral data. Refreshed daily. Zero bureau dependency.</p>
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
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">Pick your plan</h2>
        <p className="text-center text-[#94a3b8] mb-10">7-day free trial. ZIP-exclusive after checkout — first come, first served.</p>

        <div className="mb-8 max-w-3xl mx-auto grid sm:grid-cols-2 gap-3">
          <Input placeholder="Work email *" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Brokerage / Lender name" value={business} onChange={(e) => setBusiness(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="NMLS #" value={nmls} onChange={(e) => setNmls(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <Input placeholder="ZIP codes (comma-separated)" value={zipsInput} onChange={(e) => setZipsInput(e.target.value)} className="bg-[#0a1628] border-[#1e3a5f] text-white" />
          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="text-sm text-[#94a3b8]">Extra ZIPs beyond plan ($50/mo each):</label>
            <Input type="number" min={0} value={extraZips} onChange={(e) => setExtraZips(Math.max(0, Number(e.target.value) || 0))} className="bg-[#0a1628] border-[#1e3a5f] text-white w-24" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
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
              <p className="text-xs text-[#64748b] mb-4">{t.zips} ZIP codes included · 7-day free trial</p>
              <ul className="space-y-2 my-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#cbd5e1]">
                    <CheckCircle className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <ActionButton
                onClick={() => handleCheckout(t.id)}
                busyLabel="Loading…"
                ariaLabel={`Start ${t.name} — $${t.price}/mo`}
                className={`w-full ${t.highlight ? "" : "hover:bg-[#1e3a5f]/80"}`}
                style={
                  t.highlight
                    ? { background: "#00d4ff", color: "#000", minHeight: 44, fontSize: 14 }
                    : { background: "#1e3a5f", color: "#fff", minHeight: 44, fontSize: 14 }
                }
              >
                Start {t.name}
              </ActionButton>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Compliance — read this</h2>
          </div>
          <ul className="space-y-2">
            {COMPLIANCE.map(c => (
              <li key={c} className="flex items-start gap-2 text-sm text-[#cbd5e1]">
                <CheckCircle className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" /><span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#64748b] mt-4">
            HR 2808 (Homebuyers Privacy Protection Act, 2026) banned credit bureaus from reselling mortgage trigger leads to unaffiliated lenders. Mortgage Radar is the legal alternative — same intent, earlier in the funnel.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Why this beats trigger leads</h2>
        <p className="text-[#94a3b8] mb-8">Trigger leads are dead AND were lousy: borrowers got 47 cold calls in 24 hours and conversion was 1–2%. Mortgage Radar surfaces the same person 1–6 weeks earlier, with zero competition, and a real reason to call ("saw the kitchen permit").</p>
        <a href="tel:+13139921219" className="inline-flex items-center gap-2 text-[#00d4ff] font-bold">
          <Bell className="w-4 h-4" /> Talk to Matt: (313) 992-1219
        </a>
      </section>

      <footer className="border-t border-[#1e3a5f] py-8 text-center text-xs text-[#64748b]">
        Detroit Web Agency · Mortgage Radar · We Handle The Tech
      </footer>
    </div>
  );
}
