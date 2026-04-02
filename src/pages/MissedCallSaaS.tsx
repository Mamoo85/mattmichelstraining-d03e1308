import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PhoneMissed, MessageSquare, Zap, Loader2,
  ArrowRight, DollarSign, Clock, CheckCircle,
} from "lucide-react";

const HOW_IT_WORKS = [
  {
    icon: PhoneMissed,
    step: "01",
    title: "Caller Doesn't Get Through",
    desc: "Your phone rings but you're on a job, driving, or just can't pick up. Normally that lead is gone.",
  },
  {
    icon: Zap,
    step: "02",
    title: "We Detect the Missed Call",
    desc: "Our system sees the missed call within seconds — no app, no manual check required on your end.",
  },
  {
    icon: MessageSquare,
    step: "03",
    title: "Caller Gets an Instant Text",
    desc: "A personalized text fires immediately: \"Hey, I just missed your call — I'll call you right back. How can I help?\" Lead saved.",
  },
];

const INCLUDED = [
  "Instant text-back within seconds",
  "Custom message per business",
  "Works on any phone (mobile or landline)",
  "No app to install — setup in under 10 min",
  "Missed call log dashboard",
  "7-day free trial — cancel anytime",
];

export default function MissedCallSaaS() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({ businessName: "", phone: "", email: "", name: "", customMessage: "" });
  const [loading, setLoading] = useState(false);

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
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#f97316]" />
          </div>
          <h1 className="text-2xl font-black mb-3">You're In — Trial Started!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">
            Matt will reach out within 24 hours to complete the 5-minute call forwarding setup. After that, every missed call gets an instant text-back — automatically.
          </p>
          <p className="text-xs text-[#666]">Questions? Text Matt at (313) 806-4952</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Missed Call Text-Back for Local Businesses — $99/mo | 7-Day Free Trial"
        description="70% of callers won't leave a voicemail. Automatically text them back within seconds of a missed call. $99/month. 7-day free trial."
        path="/missed-call-text"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <PhoneMissed size={11} /> Missed Call Text-Back
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              70% of Callers Won't<br />
              <span className="text-[#f97316]">Leave a Voicemail.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">
              When you miss a call, most leads are gone forever. We text them back within seconds — automatically — so you never lose a job to a missed call again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button
                size="lg"
                className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl"
                onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start Free 7-Day Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 text-[#888] text-sm">
                <Clock size={14} />
                <span>Setup takes under 10 minutes</span>
              </div>
            </div>
            <p className="text-xs text-[#666] mt-4">$99/mo after trial · Month-to-month · Cancel anytime</p>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-6 text-center">
                  <div className="text-[10px] font-bold text-[#f97316] tracking-widest mb-3">STEP {step.step}</div>
                  <div className="w-12 h-12 rounded-xl bg-[#f97316]/15 flex items-center justify-center mx-auto mb-4">
                    <step.icon size={20} className="text-[#f97316]" />
                  </div>
                  <h3 className="font-bold text-sm mb-2">{step.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing + What's Included */}
        <section className="px-4 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-6 text-center">
              <div className="inline-flex items-center gap-1 bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold px-3 py-1 rounded-full mb-3">
                <DollarSign size={10} /> 7-DAY FREE TRIAL
              </div>
              <div className="text-4xl font-black text-[#f97316] mb-1">$99<span className="text-xl text-[#888] font-normal">/mo</span></div>
              <p className="text-sm text-[#aaa] mb-4">after trial · cancel anytime</p>
              <ul className="text-xs text-[#888] space-y-2 text-left max-w-xs mx-auto">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle size={11} className="text-[#f97316] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Signup Form */}
        <section id="signup-form" className="px-4 pb-24">
          <div className="max-w-md mx-auto">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 sm:p-8">
              <h2 className="text-xl font-bold mb-1">Start Your Free Trial</h2>
              <p className="text-sm text-[#888] mb-6">No credit card charged for 7 days. Setup call with Matt included.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
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
                  <Label className="text-[#aaa] text-xs">Business Phone Number *</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(313) 555-1234"
                    className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    required
                  />
                  <p className="text-[10px] text-[#555] mt-1">The number you want to catch missed calls on.</p>
                </div>
                <div>
                  <Label className="text-[#aaa] text-xs">Email Address *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@smithroofing.com"
                    className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl"
                  disabled={loading}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                    : "Start Free 7-Day Trial →"}
                </Button>
                <p className="text-[10px] text-center text-[#555]">
                  Secure payment via Stripe. $99/mo after 7 days. Cancel before trial ends and you're never charged.
                </p>
              </form>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
