import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, Mail, Lock, TrendingUp, MapPin, Briefcase, CheckCircle2, Zap, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Teaser {
  id: string;
  redacted_company: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
  detected_at: string;
}

const VERTICALS = [
  "HVAC supply",
  "Industrial steel",
  "Welding consumables",
  "Roofing supply",
  "Lumber / building materials",
  "Plumbing supply",
  "Electrical supply",
  "Industrial staffing",
  "Other",
];

export default function IndustrialPulse() {
  const [teasers, setTeasers] = useState<Teaser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingTeasers, setLoadingTeasers] = useState(true);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [vertical, setVertical] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockPlan, setUnlockPlan] = useState<"snapshot_50" | "firehose_199">("snapshot_50");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    // Auto-open unlock modal if ?unlock=1 in URL (from email CTA)
    const params = new URLSearchParams(window.location.search);
    if (params.get("unlock") === "1") setUnlockOpen(true);
    if (params.get("unlocked") === "1") {
      toast.success("Payment received — check your inbox in the next 5 minutes for the full list.");
    }
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockEmail.trim()) return;
    setUnlocking(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-industrial-pulse-checkout", {
        body: { email: unlockEmail.trim(), plan: unlockPlan, business_name: businessName.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err?.message || "Checkout failed — try again");
      setUnlocking(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("industrial-pulse-preview", { body: {} });
        if (cancelled) return;
        if (error) throw error;
        setTeasers(data?.teasers || []);
        setTotalCount(data?.total_this_week || 0);
      } catch (e) {
        console.error("preview load failed", e);
      } finally {
        if (!cancelled) setLoadingTeasers(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("industrial-pulse-signup", {
        body: {
          email: email.trim(),
          business_name: businessName.trim() || undefined,
          vertical_interest: vertical || undefined,
          source: "industrial-pulse-page",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDone(true);
      toast.success("You're in. First digest hits Tuesday 7am.");
    } catch (err: any) {
      toast.error(err?.message || "Signup failed — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Detroit Industrial Pulse — Weekly Intelligence on Metro Detroit Manufacturers</title>
        <meta name="description" content="Free weekly digest of Metro Detroit manufacturers about to spend on consumables, equipment, and services. Built for industrial supply houses." />
        <link rel="canonical" href="https://www.detroitwebagent.com/industrial-pulse" />
      </Helmet>

      <main className="min-h-screen bg-[#020617] text-white">
        {/* Hero */}
        <section className="border-b border-[#1e3a5f] px-4 sm:px-6 py-10 sm:py-16 md:py-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-[10px] md:text-xs tracking-[0.3em] text-[#00d4ff] font-bold uppercase mb-3 sm:mb-4">
              DETROIT INDUSTRIAL PULSE · FREE WEEKLY DIGEST
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight mb-4 sm:mb-6">
              {totalCount > 0 ? totalCount : "42"} Metro Detroit manufacturers
              <br />
              <span className="text-[#00d4ff]">hired this week.</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mb-6 sm:mb-8">
              New crews mean new orders for consumables, equipment, and services within 30 days.
              Every Tuesday at 7am, we send 3 of this week's signals — company name blurred until you unlock.
              No fluff. Built for branch managers at industrial supply houses.
            </p>
          </div>
        </section>

        {/* Teasers */}
        <section className="px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-xs tracking-widest text-slate-500 font-bold uppercase mb-4 sm:mb-6">
              ↓ This week's signals (3 of {totalCount || "many"})
            </div>

            {loadingTeasers ? (
              <div className="text-center py-12 sm:py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#00d4ff] mx-auto" />
              </div>
            ) : teasers.length === 0 ? (
              <div className="text-center py-12 sm:py-16 text-slate-500 text-sm">
                Radar is still warming up — first digest goes out Tuesday.
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {teasers.map((t) => (
                  <div key={t.id} className="border border-[#1e3a5f] bg-[#0a1628] p-4 sm:p-5 rounded-md">
                    <div className="flex items-start justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                      <div className="font-mono text-lg sm:text-xl text-[#00d4ff] font-semibold tracking-wider break-all">
                        {t.redacted_company}
                      </div>
                      <div className="bg-[#00d4ff] text-[#0a1628] text-[10px] font-bold px-2 py-1 rounded shrink-0">
                        {t.confidence}/10
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-xs text-slate-400 mb-2 sm:mb-3">
                      {t.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.location}</span>}
                      {t.industry && <span>· {t.industry}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-200 mb-2 sm:mb-3">
                      <Briefcase className="w-3.5 h-3.5 text-[#00d4ff] shrink-0" />
                      <span className="break-words">Hiring <strong className="text-white">{t.hiring_count || "multiple"}× {t.hiring_roles.join(", ") || "trades"}</strong></span>
                    </div>
                    {t.predicted_needs.length > 0 && (
                      <div className="text-xs text-slate-500">
                        <span className="text-slate-400">Predicted spend:</span> {t.predicted_needs.slice(0, 3).join(" · ")}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-[#1e3a5f] flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-3 h-3 shrink-0" />
                      Company name unlocks for subscribers
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unlock CTA strip — shown right under teasers */}
            {teasers.length > 0 && (
              <div className="mt-6 sm:mt-8 border-2 border-[#00d4ff] bg-[#0a1628] rounded-md p-4 sm:p-6 text-center">
                <div className="text-xs tracking-widest text-[#00d4ff] font-bold uppercase mb-2">
                  Want the company names?
                </div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-white mb-4">
                  Unlock all {totalCount || 3} signals from this week
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <button
                    onClick={() => { setUnlockPlan("snapshot_50"); setUnlockOpen(true); }}
                    className="bg-[#00d4ff] text-[#0a1628] font-bold px-4 sm:px-6 py-3 sm:py-4 rounded-md hover:bg-[#00d4ff]/90 transition text-sm uppercase tracking-wider flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    <Zap className="w-4 h-4" /> Unlock this week · $50
                  </button>
                  <button
                    onClick={() => { setUnlockPlan("firehose_199"); setUnlockOpen(true); }}
                    className="border-2 border-[#00d4ff] text-[#00d4ff] font-bold px-4 sm:px-6 py-3 sm:py-4 rounded-md hover:bg-[#00d4ff]/10 transition text-sm uppercase tracking-wider min-h-[48px]"
                  >
                    Daily firehose · $199/mo
                  </button>
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 mt-3">One-time or cancel anytime · Instant email delivery</div>
              </div>
            )}
          </div>
        </section>

        {/* Unlock modal */}
        {unlockOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 sm:bg-black/80 flex items-end sm:items-center justify-center px-0 sm:px-4"
            onClick={() => !unlocking && setUnlockOpen(false)}
          >
            <div
              className="bg-[#020617] border-2 border-[#00d4ff] rounded-t-xl sm:rounded-lg w-full max-w-md p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => !unlocking && setUnlockOpen(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-xs tracking-widest text-[#00d4ff] font-bold uppercase mb-2">
                {unlockPlan === "snapshot_50" ? "This Week's Unlock" : "Firehose Subscription"}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {unlockPlan === "snapshot_50" ? "$50 — one-time" : "$199/mo — cancel anytime"}
              </h3>
              <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                {unlockPlan === "snapshot_50"
                  ? `Get all ${totalCount || 3} of this week's signals: full company name, address, hiring count, predicted spend window. Delivered to your inbox within 5 minutes.`
                  : "Daily access to every Metro Detroit hiring signal across every vertical — boiler, HVAC, welding, steel, lumber, electrical, plumbing. Cancel anytime."}
              </p>

              <div className="flex gap-2 mb-4 text-xs">
                <button
                  type="button"
                  onClick={() => setUnlockPlan("snapshot_50")}
                  className={`flex-1 px-3 py-3 rounded font-semibold uppercase tracking-wider min-h-[44px] ${unlockPlan === "snapshot_50" ? "bg-[#00d4ff] text-[#0a1628]" : "border border-[#1e3a5f] text-slate-400"}`}
                >
                  Snapshot $50
                </button>
                <button
                  type="button"
                  onClick={() => setUnlockPlan("firehose_199")}
                  className={`flex-1 px-3 py-3 rounded font-semibold uppercase tracking-wider min-h-[44px] ${unlockPlan === "firehose_199" ? "bg-[#00d4ff] text-[#0a1628]" : "border border-[#1e3a5f] text-slate-400"}`}
                >
                  Firehose $199/mo
                </button>
              </div>

              <form onSubmit={handleUnlock} className="space-y-3">
                <input
                  type="email"
                  value={unlockEmail}
                  onChange={(e) => setUnlockEmail(e.target.value)}
                  required
                  placeholder="Work email"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] focus:border-[#00d4ff] text-white px-4 py-3 sm:py-4 rounded-md outline-none text-sm min-h-[48px]"
                />
                <button
                  type="submit"
                  disabled={unlocking || !unlockEmail.trim()}
                  className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-3 sm:py-4 rounded-md hover:bg-[#00d4ff]/90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider min-h-[48px]"
                >
                  {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {unlocking ? "Redirecting…" : "Continue to checkout"}
                </button>
                <p className="text-[10px] sm:text-[11px] text-slate-500 text-center">
                  Secure Stripe checkout · No account required
                </p>
              </form>
            </div>
          </div>
        )}
        {/* Signup form */}
        <section id="signup" className="px-6 py-16 border-t border-[#1e3a5f]">
          <div className="max-w-xl mx-auto">
            <div className="text-xs tracking-widest text-[#00d4ff] font-bold uppercase mb-3">
              ↓ Get this week's full list
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Free weekly digest. Unlock company names anytime.
            </h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              No credit card. No spam. Tuesday 7am ET. Unsubscribe one click. If a signal turns into a sale,
              you can unlock the full week ($50) or every signal across every vertical ($199/mo).
            </p>

            {done ? (
              <div className="border border-[#00d4ff] bg-[#00d4ff]/10 p-6 rounded-md flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00d4ff] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white mb-1">You're on the list.</div>
                  <div className="text-sm text-slate-300">First digest hits Tuesday at 7am ET. Reply with the vertical you care about and I'll prioritize those signals for you. — Matt</div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2 font-medium">EMAIL *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="branch.manager@supplyco.com"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] focus:border-[#00d4ff] text-white px-4 py-3 rounded-md outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2 font-medium">COMPANY (optional)</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Behler-Young, Standard Supply, etc."
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] focus:border-[#00d4ff] text-white px-4 py-3 rounded-md outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2 font-medium">VERTICAL (optional — we'll prioritize signals for you)</label>
                  <select
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] focus:border-[#00d4ff] text-white px-4 py-3 rounded-md outline-none text-sm"
                  >
                    <option value="">— Select vertical —</option>
                    {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-4 rounded-md hover:bg-[#00d4ff]/90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {submitting ? "Subscribing..." : "Get the weekly digest"}
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Built by Matt Michels · Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219
                </p>
              </form>
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 border-t border-[#1e3a5f] bg-[#0a1628]/40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-8 text-center">How the radar works</h2>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-[#00d4ff] mb-2"><TrendingUp className="w-5 h-5" /></div>
                <div className="font-semibold mb-1 text-white">16 public sources</div>
                <div className="text-slate-400 leading-relaxed">MIOSHA permits, BSEED filings, SAM.gov contracts, job boards, business filings, NOAA weather correlations.</div>
              </div>
              <div>
                <div className="text-[#00d4ff] mb-2"><Briefcase className="w-5 h-5" /></div>
                <div className="font-semibold mb-1 text-white">Cross-referenced scoring</div>
                <div className="text-slate-400 leading-relaxed">Signals must triple-confirm across at least 2 sources to clear the 7/10 confidence threshold for a digest.</div>
              </div>
              <div>
                <div className="text-[#00d4ff] mb-2"><MapPin className="w-5 h-5" /></div>
                <div className="font-semibold mb-1 text-white">Metro Detroit only</div>
                <div className="text-slate-400 leading-relaxed">Wayne, Oakland, Macomb, Washtenaw, St. Clair, Livingston, Monroe. Real local intel, not national list scraping.</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
