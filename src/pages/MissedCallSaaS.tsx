import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PhoneMissed, MessageSquare, Zap, Loader2,
  ArrowRight, Clock, CheckCircle, X, Shield,
  TrendingUp, AlertTriangle, Send, Phone,
} from "lucide-react";
import DWAStickyNav from "@/components/shared/DWAStickyNav";
import WallOfLove, { Testimonial } from "@/components/shared/WallOfLove";
import EnterpriseFooterBlock from "@/components/shared/EnterpriseFooterBlock";
import MissedCallStickyCTA from "@/components/missed-call/MissedCallStickyCTA";

const ACCENT = "#22d3ee";
const BG = "#0f0f1a";
const RED = "#ff5757";
const MONTHLY_SIGNUPS = 47; // hardcoded social proof — bump as needed

// ----------------------------------------------------------------------------
// Industry variants
// ----------------------------------------------------------------------------
type IndustryConfig = {
  headlineLead: string;
  headlineAccent: string;
  sub: string;
  seoTitle: string;
};

const INDUSTRY_CONFIG: Record<string, IndustryConfig> = {
  plumber: {
    headlineLead: "Plumbers: Stop Losing Jobs",
    headlineAccent: "to Voicemail.",
    sub: "Every burst pipe call you miss goes to the next plumber on the list. We text them back in 8 seconds — automatically — so they wait for you.",
    seoTitle: "Missed Call Text-Back for Plumbers — $99/mo | 14-Day Free Trial",
  },
  dentist: {
    headlineLead: "Dentists: Every Missed Call",
    headlineAccent: "Is a Lost Patient.",
    sub: "New patients call once. If you don't answer, they call the next dentist. We text them back in 8 seconds with your booking link.",
    seoTitle: "Missed Call Text-Back for Dental Offices — $99/mo | 14-Day Free Trial",
  },
  contractor: {
    headlineLead: "Contractors: Win Jobs",
    headlineAccent: "While You're On Site.",
    sub: "You can't drop a hammer to answer the phone. We text every missed call back in 8 seconds so the lead doesn't go cold.",
    seoTitle: "Missed Call Text-Back for Contractors — $99/mo | 14-Day Free Trial",
  },
  roofer: {
    headlineLead: "Roofers: Storm Calls",
    headlineAccent: "Don't Wait.",
    sub: "After a storm, every missed call is a $5k–$30k job going to your competitor. We catch them in 8 seconds.",
    seoTitle: "Missed Call Text-Back for Roofers — $99/mo | 14-Day Free Trial",
  },
  hvac: {
    headlineLead: "HVAC Pros: AC Down Calls",
    headlineAccent: "Go to Whoever Answers.",
    sub: "When their AC dies in July, they call 3 companies in 5 minutes. We text them back in 8 seconds — automatically.",
    seoTitle: "Missed Call Text-Back for HVAC — $99/mo | 14-Day Free Trial",
  },
  electrician: {
    headlineLead: "Electricians: Emergency Calls",
    headlineAccent: "Won't Wait For You.",
    sub: "Power out? They're calling everyone. We text them back in 8 seconds so you stay top of the list.",
    seoTitle: "Missed Call Text-Back for Electricians — $99/mo | 14-Day Free Trial",
  },
};

const DEFAULT_CONFIG: IndustryConfig = {
  headlineLead: "Never Lose Another Job",
  headlineAccent: "to a Missed Call.",
  sub: "70% of callers won't leave a voicemail. We text them back within 8 seconds — automatically — so you never lose a lead to your competitor again.",
  seoTitle: "Missed Call Text-Back — $99/mo | 14-Day Free Trial, No Card",
};

// ----------------------------------------------------------------------------
// Static data
// ----------------------------------------------------------------------------
const TRUST_BADGES = [
  "Built on Twilio",
  "Secured by Stripe",
  "TCPA Compliant",
  "Month-to-Month",
  "No Setup Fee",
];

const HOW_IT_WORKS = [
  { icon: PhoneMissed, n: "01", title: "You Miss a Call", desc: "On a job, driving, or after-hours — doesn't matter." },
  { icon: Zap, n: "02", title: "Text Fires in 8 Seconds", desc: "Personalized message goes out automatically." },
  { icon: CheckCircle, n: "03", title: "Lead Saved", desc: "They reply, you call them back — when you can." },
];

const COMPARISON_ROWS: Array<{ feature: string; podium: boolean; birdeye: boolean; dwa: boolean }> = [
  { feature: "Missed-call text-back", podium: true,  birdeye: true,  dwa: true },
  { feature: "Voicemail transcription", podium: false, birdeye: false, dwa: true },
  { feature: "City-personalized messages", podium: false, birdeye: false, dwa: true },
  { feature: "Callback reminders to you", podium: false, birdeye: false, dwa: true },
  { feature: "14-day free trial, no card", podium: false, birdeye: false, dwa: true },
  { feature: "Month-to-month, no contract", podium: false, birdeye: false, dwa: true },
  { feature: "Setup help included", podium: false, birdeye: false, dwa: true },
];

const STATS = [
  { big: "97%", label: "of texts are read within 3 minutes" },
  { big: "70%", label: "of callers won't leave a voicemail" },
  { big: "1 in 4", label: "missed calls goes to a competitor" },
];

const FAQS = [
  { q: "Do I need a new phone number?", a: "No. We give you a dedicated text-back number and you forward your existing line to it. Takes 2 minutes — no porting, no losing your number." },
  { q: "What if a caller doesn't want texts?", a: "Every text includes a STOP keyword — TCPA compliant. They reply STOP and they're never texted again. Fully automatic." },
  { q: "Can I customize the message?", a: "Yes. You write your own text-back during setup. Change it anytime from your dashboard. We give you a proven template if you don't want to write one." },
  { q: "Does it work nights and weekends?", a: "Yes — 24/7. The system fires every time you miss a call, no matter what time it is. Most of our clients catch their best leads after-hours." },
  { q: "What happens after my 14-day trial?", a: "We email you 3 days before the trial ends. If you keep it, billing kicks in at $99/mo. Cancel before day 14 and you're never charged — period." },
  { q: "Can I cancel anytime?", a: "Yes. Month-to-month, no contract, no cancellation fee. One click in your dashboard or text Matt at (313) 992-1219." },
];

const TESTIMONIALS: Testimonial[] = [
  { quote: "Missed a call while on a job. Guy texted back 'thanks for responding so fast.' He had no idea — became a $3,200 job.", name: "Dave K.", trade: "Roofing Contractor, Metro Detroit", initials: "DK" },
  { quote: "I used to lose 2–3 leads a week just because I couldn't answer. That's completely gone now.", name: "Frank B.", trade: "HVAC, Metro Detroit", initials: "FB" },
  { quote: "Set up in 8 minutes. It just works. I don't even think about it anymore.", name: "Jim T.", trade: "Plumbing, Wayne County", initials: "JT" },
  { quote: "My wife used to panic every time I missed a call. Now she doesn't even notice because they get taken care of automatically.", name: "Tony M.", trade: "Electrician, Metro Detroit", initials: "TM" },
  { quote: "Best $99 I spend every month. Period.", name: "Sam G.", trade: "General Contractor, Metro Detroit", initials: "SG" },
];

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function PhoneMockup({ city }: { city: string }) {
  // Looping animation: missed call → 8s ring → SMS bubble appears
  const [phase, setPhase] = useState<"call" | "count" | "text">("call");
  const [count, setCount] = useState(8);

  useEffect(() => {
    if (phase === "call") {
      const t = setTimeout(() => setPhase("count"), 1800);
      return () => clearTimeout(t);
    }
    if (phase === "count") {
      if (count <= 0) {
        setPhase("text");
        return;
      }
      const t = setTimeout(() => setCount((c) => c - 1), 280);
      return () => clearTimeout(t);
    }
    if (phase === "text") {
      const t = setTimeout(() => {
        setPhase("call");
        setCount(8);
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [phase, count]);

  return (
    <div className="relative mx-auto" style={{ width: 260, height: 520 }}>
      {/* Phone frame */}
      <div
        className="absolute inset-0 rounded-[40px] border-[10px] border-[#1a1a2e] shadow-2xl"
        style={{ background: "#000" }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#1a1a2e] rounded-b-2xl z-10" />
        {/* Screen */}
        <div className="absolute inset-1 rounded-[32px] overflow-hidden bg-gradient-to-b from-[#0a1628] to-[#000] flex flex-col">
          {/* Status bar */}
          <div className="flex justify-between items-center px-5 pt-7 text-[10px] text-white/80 font-semibold">
            <span>9:41</span>
            <span>●●●●●</span>
          </div>

          {phase === "call" && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
              <p className="text-[#aaa] text-xs mb-1">Incoming call</p>
              <p className="text-white text-lg font-bold">(313) 555-0142</p>
              <p className="text-[#888] text-xs mt-1">{city}, MI</p>
              <div className="mt-8 w-20 h-20 rounded-full bg-[#22d3ee]/20 flex items-center justify-center animate-pulse">
                <PhoneMissed size={32} className="text-[#22d3ee]" />
              </div>
              <p className="text-[#666] text-[11px] mt-6">missed → no answer</p>
            </div>
          )}

          {phase === "count" && (
            <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
              <p className="text-[#aaa] text-xs mb-3">Texting back in</p>
              <div className="relative w-32 h-32">
                <svg className="absolute inset-0" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#1a1a2e" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={ACCENT} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(count / 8) * 276} 276`}
                    transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dasharray 0.28s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-black text-[#22d3ee]">{count}</span>
                </div>
              </div>
              <p className="text-[#888] text-[11px] mt-4">seconds</p>
            </div>
          )}

          {phase === "text" && (
            <div className="flex-1 flex flex-col px-3 pt-3 animate-fade-in">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#22d3ee] flex items-center justify-center">
                  <MessageSquare size={14} className="text-black" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold leading-tight">Detroit Web Agency</p>
                  <p className="text-[#888] text-[10px]">delivered just now</p>
                </div>
              </div>
              <div className="mt-3 self-start max-w-[85%] bg-[#22d3ee]/15 border border-[#22d3ee]/30 rounded-2xl rounded-tl-sm px-3 py-2">
                <p className="text-white text-[11px] leading-snug">
                  Hey! I just missed your call from <span className="font-bold text-[#22d3ee]">{city}</span> — I'll call you right back! What can I help you with?
                </p>
              </div>
              <div className="mt-auto mb-4 flex items-center gap-2 px-1">
                <CheckCircle size={12} className="text-emerald-400" />
                <p className="text-emerald-400 text-[10px] font-bold">Lead saved</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveDemoCard() {
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!phone) {
      toast.error("Enter your phone number first.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-missed-call-demo-text", {
        body: { phone, city: city || undefined },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Could not send.");
      }
      toast.success("Text sent — check your phone in under 8 seconds.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-[#22d3ee]/30 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#22d3ee]/20 flex items-center justify-center">
          <Send size={14} className="text-[#22d3ee]" />
        </div>
        <p className="text-[10px] font-bold tracking-widest text-[#22d3ee] uppercase">Try It Live — Free</p>
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Text yourself the demo right now.</h3>
      <p className="text-sm text-[#aaa] mb-5">No signup. No spam. We'll send you the exact message your callers would receive.</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-[#aaa] text-xs">Your phone *</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(313) 555-1234"
            className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
          />
        </div>
        <div>
          <Label className="text-[#aaa] text-xs">Your city (optional)</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Grosse Pointe"
            className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
          />
        </div>
      </div>
      <Button
        onClick={send}
        disabled={sending}
        className="w-full bg-[#22d3ee] hover:bg-[#06b6d4] text-black font-bold py-5"
      >
        {sending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
          : <>📱 Text me the demo (under 8 sec)</>}
      </Button>
      <p className="text-[10px] text-[#555] text-center mt-2">One demo per number per 10 minutes. Standard message rates apply.</p>
    </div>
  );
}

function ROICalculator() {
  const [calls, setCalls] = useState(8);
  const [value, setValue] = useState(800);

  const monthlyLost = useMemo(() => {
    // weekly missed × value × 25% conversion × 4.3 weeks
    return Math.round(calls * value * 0.25 * 4.3);
  }, [calls, value]);

  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-[#ff5757]" />
        <p className="text-[10px] font-bold tracking-widest text-[#ff5757] uppercase">Lost Revenue Calculator</p>
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-white mb-6">How much are missed calls costing you?</h3>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-[#aaa] text-xs">Calls missed per week</Label>
            <span className="text-[#22d3ee] font-bold text-sm">{calls}</span>
          </div>
          <Slider value={[calls]} onValueChange={([v]) => setCalls(v)} min={0} max={50} step={1} />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-[#aaa] text-xs">Average job value</Label>
            <span className="text-[#22d3ee] font-bold text-sm">${value.toLocaleString()}</span>
          </div>
          <Slider value={[value]} onValueChange={([v]) => setValue(v)} min={100} max={10000} step={100} />
        </div>
      </div>

      <div className="mt-7 pt-6 border-t border-white/10 text-center">
        <p className="text-xs text-[#aaa] mb-1">You're losing approximately</p>
        <p className="text-4xl sm:text-5xl font-black" style={{ color: RED }}>
          ${monthlyLost.toLocaleString()}
          <span className="text-base font-normal text-[#888]">/month</span>
        </p>
        <p className="text-xs text-[#aaa] mt-3">
          Missed Call Catch costs <span className="text-white font-bold">$99/mo</span>. Recover one job and it pays for itself for the year.
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------

export default function MissedCallSaaS() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const { industry } = useParams<{ industry?: string }>();
  const config = (industry && INDUSTRY_CONFIG[industry.toLowerCase()]) || DEFAULT_CONFIG;

  const [form, setForm] = useState({ businessName: "", phone: "", email: "", name: "", customMessage: "" });
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("Grosse Pointe");

  // Try to get city from browser timezone heuristic; fallback to default
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Detroit")) setCity("Detroit");
      else if (tz.includes("Chicago")) setCity("Chicago");
      else if (tz.includes("New_York")) setCity("New York");
    } catch {
      // ignore
    }
  }, []);

  const scrollToForm = () => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.phone || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-missed-call-subscription", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#22d3ee]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#22d3ee]" />
          </div>
          <h1 className="text-2xl font-black mb-3">You're In — 14-Day Trial Started!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">
            Check your inbox in the next 5 minutes for your setup link. Forward your business line to your new number, and every missed call gets a text-back automatically.
          </p>
          <p className="text-[#ff5757] text-xs font-bold mb-4">No card charged. Cancel before day 14 and you're never billed.</p>
          <p className="text-sm text-[#888]">Questions? <a href="sms:+13139921219" className="text-[#22d3ee] font-bold hover:underline">Text Matt at (313) 992-1219</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={config.seoTitle}
        description="70% of callers won't leave a voicemail. Automatically text them back in 8 seconds. $99/month. 14-day free trial — no card charged."
        path={industry ? `/missed-call-text/${industry}` : "/missed-call-text"}
      />
      <DWAStickyNav
        productName="Missed Call Catch"
        ctaLabel="Start Free Trial →"
        ctaOnClick={scrollToForm}
        accentColor={ACCENT}
        bgColor={BG}
      />
      <MissedCallStickyCTA onClick={scrollToForm} />

      <div className="min-h-screen bg-[#0f0f1a] text-white pb-24 md:pb-0">

        {/* HERO */}
        <section className="pt-20 pb-12 px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold tracking-widest uppercase mb-5">
                <PhoneMissed size={11} /> Missed Call Catch
              </div>
              <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
                {config.headlineLead}<br />
                <span className="text-[#22d3ee]">{config.headlineAccent}</span>
              </h1>
              <p className="text-base sm:text-lg text-[#aaa] mb-7 leading-relaxed">
                {config.sub}
              </p>

              <div className="flex flex-col gap-2 items-center lg:items-start">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#06b6d4] to-[#22d3ee] hover:opacity-90 text-black text-base px-7 py-6 font-black rounded-xl shadow-lg shadow-[#22d3ee]/20"
                  onClick={scrollToForm}
                >
                  Start Free — 14 Days, No Card Charged <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs font-bold" style={{ color: RED }}>
                  Cancel before day 14 and you're never charged.
                </p>
                <div className="flex items-center gap-2 text-[#888] text-xs mt-1">
                  <Clock size={12} />
                  <span>Setup takes under 10 minutes · $99/mo after trial</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <PhoneMockup city={city} />
            </div>
          </div>
        </section>

        {/* TRUST BADGES */}
        <section className="px-4 py-6 border-y border-white/5 bg-[#0a0a14]">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] sm:text-xs text-[#888]">
            {TRUST_BADGES.map((b, i) => (
              <span key={b} className="flex items-center gap-2">
                {i > 0 && <span className="text-[#333] hidden sm:inline">·</span>}
                <Shield size={11} className="text-[#22d3ee]/60" />
                <span className="font-semibold">{b}</span>
              </span>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF TICKER */}
        <section className="px-4 py-4 bg-[#0f0f1a]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm text-[#aaa]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              <span className="font-bold text-white">{MONTHLY_SIGNUPS}</span> Metro Detroit businesses signed up this month
            </p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">How It Works</h2>
            <p className="text-center text-[#888] text-sm mb-10">3 steps. Zero work on your end.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.n} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-6 text-center">
                  <div className="text-[10px] font-bold text-[#22d3ee] tracking-widest mb-3">STEP {s.n}</div>
                  <div className="w-12 h-12 rounded-xl bg-[#22d3ee]/15 flex items-center justify-center mx-auto mb-4">
                    <s.icon size={20} className="text-[#22d3ee]" />
                  </div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRY IT LIVE */}
        <section className="px-4 py-12 bg-[#0a0a14]">
          <LiveDemoCard />
        </section>

        {/* ROI CALCULATOR */}
        <section className="px-4 py-16">
          <ROICalculator />
        </section>

        {/* STATS */}
        <section className="px-4 py-12 bg-[#0a0a14]">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.big}>
                <p className="text-4xl sm:text-5xl font-black text-[#22d3ee] mb-1">{s.big}</p>
                <p className="text-xs sm:text-sm text-[#aaa] leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARISON */}
        <section className="px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">$99 vs. The $400 Guys</h2>
            <p className="text-center text-[#888] text-sm mb-8">Same job. Better price. More features.</p>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a2e]">
                  <tr>
                    <th className="text-left p-4 font-semibold text-[#aaa] text-xs">Feature</th>
                    <th className="p-4 text-center text-xs">
                      <div className="font-bold text-white">Podium</div>
                      <div className="text-[10px] text-[#888] font-normal">$399/mo</div>
                    </th>
                    <th className="p-4 text-center text-xs">
                      <div className="font-bold text-white">Birdeye</div>
                      <div className="text-[10px] text-[#888] font-normal">$299/mo</div>
                    </th>
                    <th className="p-4 text-center text-xs bg-[#22d3ee]/10">
                      <div className="font-bold text-[#22d3ee]">DWA</div>
                      <div className="text-[10px] text-[#22d3ee]/80 font-normal">$99/mo</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((r, i) => (
                    <tr key={r.feature} className={i % 2 === 0 ? "bg-[#0f0f1a]" : "bg-[#13131f]"}>
                      <td className="p-4 text-[#ddd] text-xs">{r.feature}</td>
                      <td className="p-4 text-center">
                        {r.podium ? <CheckCircle size={16} className="text-emerald-400 mx-auto" /> : <X size={16} className="text-[#555] mx-auto" />}
                      </td>
                      <td className="p-4 text-center">
                        {r.birdeye ? <CheckCircle size={16} className="text-emerald-400 mx-auto" /> : <X size={16} className="text-[#555] mx-auto" />}
                      </td>
                      <td className="p-4 text-center bg-[#22d3ee]/5">
                        {r.dwa ? <CheckCircle size={16} className="text-[#22d3ee] mx-auto" /> : <X size={16} className="text-[#555] mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 max-w-2xl mx-auto bg-[#1a1a2e] border-l-2 border-[#22d3ee] rounded-r-lg p-4">
              <p className="text-xs sm:text-sm text-[#ccc] leading-relaxed">
                <span className="font-bold text-white">Why we're cheaper:</span> We don't sell CRMs, reputation management, or webchat. We do one thing — make sure every missed call turns into a conversation. No bloat = no markup.
              </p>
            </div>
          </div>
        </section>

        {/* OBJECTION CRUSHERS */}
        <section className="px-4 py-12 bg-[#0a0a14]">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400" />
                <p className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Common Objection</p>
              </div>
              <h3 className="text-lg font-black text-white mb-2">"I already have voicemail."</h3>
              <p className="text-sm text-[#aaa] leading-relaxed">
                Voicemail goes <span className="text-white font-bold">unheard</span>. Texts get read in 3 minutes. This isn't a voicemail replacement — it's what happens <span className="text-white">while your voicemail sits ignored</span>.
              </p>
            </div>
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400" />
                <p className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Common Objection</p>
              </div>
              <h3 className="text-lg font-black text-white mb-2">"I call everyone back."</h3>
              <p className="text-sm text-[#aaa] leading-relaxed">
                What about nights, weekends, or when you're on a job? This fires in <span className="text-[#22d3ee] font-bold">8 seconds, 24/7</span>. By the time you call back, the lead already knows you're real.
              </p>
            </div>
          </div>
        </section>

        {/* BUNDLE CALLOUT */}
        <section className="px-4 py-10">
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-[#22d3ee]/10 to-[#06b6d4]/5 border border-[#22d3ee]/30 rounded-2xl p-6 text-center">
            <p className="text-[10px] font-bold tracking-widest text-[#22d3ee] uppercase mb-2">Bundle & Save</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Already a Mortgage Radar or TechAlert client?</h3>
            <p className="text-sm text-[#aaa] mb-4">Add Missed Call Catch for just <span className="text-[#22d3ee] font-bold">$49/mo</span> — half off.</p>
            <Button asChild className="bg-white/10 hover:bg-white/15 text-white font-bold border border-white/20">
              <a href="/pricing?bundle=missed-call#bundle">See bundle pricing →</a>
            </Button>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <div className="bg-[#0a0a14]">
          <WallOfLove testimonials={TESTIMONIALS} accentColor={ACCENT} theme="dark" title="Metro Detroit Owners Using It Right Now" />
        </div>

        {/* FAQ */}
        <section className="px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">Quick Answers</h2>
            <p className="text-center text-[#888] text-sm mb-8">Everything most owners ask before signing up.</p>
            <Accordion type="single" collapsible className="space-y-2">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-[#1a1a2e] border border-white/10 rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-semibold text-white hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-[#aaa] leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* SIGNUP FORM */}
        <section id="signup-form" className="px-4 py-16 bg-[#0a0a14]">
          <div className="max-w-md mx-auto">
            <div className="bg-[#1a1a2e] border border-[#22d3ee]/30 rounded-2xl p-6 sm:p-8">
              <div className="inline-flex items-center gap-1 bg-[#22d3ee]/15 text-[#22d3ee] text-[10px] font-bold tracking-widest px-3 py-1 rounded-full mb-3 uppercase">
                14-Day Free Trial
              </div>
              <h2 className="text-2xl font-black mb-1">Start Your Free Trial</h2>
              <p className="text-sm text-[#888] mb-6">No card charged for 14 days. Setup takes under 10 minutes.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#aaa] text-xs">Business Name *</Label>
                    <Input
                      value={form.businessName}
                      onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                      placeholder="Smith Roofing LLC"
                      className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[#aaa] text-xs">Your Name</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="John Smith"
                      className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[#aaa] text-xs">Business Phone *</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(313) 555-1234"
                    className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    required
                  />
                  <p className="text-[10px] text-[#555] mt-1">The line you want to catch missed calls on.</p>
                </div>
                <div>
                  <Label className="text-[#aaa] text-xs">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@smithroofing.com"
                    className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[#aaa] text-xs">Custom Text-Back (optional)</Label>
                  <textarea
                    value={form.customMessage}
                    onChange={e => setForm(f => ({ ...f, customMessage: e.target.value.slice(0, 160) }))}
                    placeholder="Hey, I just missed your call — I'll call you right back!"
                    maxLength={160}
                    rows={2}
                    className="w-full bg-white/5 border border-white/15 text-white placeholder:text-[#555] rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-[10px] text-[#555] mt-1">{form.customMessage.length}/160 — leave blank for our proven template.</p>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#06b6d4] to-[#22d3ee] text-black font-black py-6 text-base rounded-xl"
                  disabled={loading}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    : <>Start Free — 14 Days, No Card Charged →</>}
                </Button>
                <p className="text-[11px] text-center font-bold" style={{ color: RED }}>
                  Cancel before day 14 and you're never charged.
                </p>
                <p className="text-[10px] text-center text-[#555]">
                  Secure checkout via Stripe · $99/mo after trial · Cancel anytime
                </p>
              </form>
            </div>

            <div className="text-center mt-6">
              <a href="sms:+13139921219" className="inline-flex items-center gap-2 text-xs text-[#22d3ee] font-semibold hover:underline">
                <Phone size={12} /> Questions? Text Matt at (313) 992-1219
              </a>
            </div>
          </div>
        </section>

        <EnterpriseFooterBlock accentColor={ACCENT} isDark={true} />
      </div>
    </>
  );
}
