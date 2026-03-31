import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Mail, MessageSquare, Loader2, ArrowRight, DollarSign, Clock, CheckCircle, Shield } from "lucide-react";

const HOW_IT_WORKS = [
  { icon: Users, step: "01", title: "Customer Signs Up", desc: "When your customer makes a purchase or signs up, our AI triggers a personalized welcome sequence automatically." },
  { icon: Mail, step: "02", title: "AI Sends Welcome Emails", desc: "Day 1: welcome + setup. Day 3: tips & best practices. Day 7: check-in + review request. All AI-personalized to your business." },
  { icon: MessageSquare, step: "03", title: "SMS Follow-Ups", desc: "Text message check-ins at key milestones ensure your new customers feel supported and stick around." },
];

const INCLUDED = [
  "AI-personalized welcome email sequence",
  "Day 1, 3, and 7 automated touchpoints",
  "SMS check-in messages",
  "Industry-specific onboarding tips",
  "Review request at Day 7",
  "Reduces early churn by 40%+",
  "Works for any local business",
  "7-day free trial — cancel anytime",
];

export default function AIOnboardingAgent() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [form, setForm] = useState({ businessName: "", email: "", name: "", industry: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) { toast.error("Please fill in all required fields"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-agent-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) { toast.error(err.message || "Something went wrong."); }
    finally { setLoading(false); }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6"><CheckCircle size={36} className="text-[#f97316]" /></div>
          <h1 className="text-2xl font-black mb-3">You're In — Trial Started!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">Your AI onboarding agent is being configured. Matt will reach out within 24 hours to connect your customer intake system.</p>
          <p className="text-xs text-[#666]">Questions? Email matt@mattmichelstraining.com</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Customer Onboarding Agent — $59/mo" description="Automated welcome sequences for new customers. AI-personalized emails + SMS at Day 1, 3, and 7. Reduce churn by 40%. $59/mo." path="/ai-onboarding-agent" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Shield size={11} /> AI Onboarding Agent</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Never Lose a New Customer<br /><span className="text-[#f97316]">In the First Week.</span></h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">AI sends personalized welcome emails and texts to every new customer — automatically. They feel supported, you reduce churn, and they leave reviews.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button size="lg" className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl" onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}>Start Free 7-Day Trial <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <div className="flex items-center gap-2 text-[#888] text-sm"><Clock size={14} /><span>Live within 24 hours</span></div>
            </div>
            <p className="text-xs text-[#666] mt-4">$59/mo after trial · Month-to-month · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-6 text-center">
                  <div className="text-[10px] font-bold text-[#f97316] tracking-widest mb-3">STEP {s.step}</div>
                  <div className="w-12 h-12 rounded-xl bg-[#f97316]/15 flex items-center justify-center mx-auto mb-4"><s.icon size={20} className="text-[#f97316]" /></div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-6 text-center">
              <div className="inline-flex items-center gap-1 bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold px-3 py-1 rounded-full mb-3"><DollarSign size={10} /> 7-DAY FREE TRIAL</div>
              <div className="text-4xl font-black text-[#f97316] mb-1">$59<span className="text-xl text-[#888] font-normal">/mo</span></div>
              <p className="text-sm text-[#aaa] mb-4">after trial · cancel anytime</p>
              <ul className="text-xs text-[#888] space-y-2 text-left max-w-xs mx-auto">
                {INCLUDED.map((item) => (<li key={item} className="flex items-start gap-2"><CheckCircle size={11} className="text-[#f97316] shrink-0 mt-0.5" />{item}</li>))}
              </ul>
            </div>
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-24">
          <div className="max-w-md mx-auto">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 sm:p-8">
              <h2 className="text-xl font-bold mb-1">Start Your Free Trial</h2>
              <p className="text-sm text-[#888] mb-6">No credit card charged for 7 days.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label className="text-[#aaa] text-xs">Business Name *</Label><Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Smith Plumbing LLC" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                  <div><Label className="text-[#aaa] text-xs">Your Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
                </div>
                <div><Label className="text-[#aaa] text-xs">Industry</Label><Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="Plumbing, HVAC, Dental..." className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
                <div><Label className="text-[#aaa] text-xs">Email Address *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@smithplumbing.com" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                <Button type="submit" className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Start Free 7-Day Trial →"}
                </Button>
                <p className="text-[10px] text-center text-[#555]">Secure payment via Stripe. $59/mo after 7 days.</p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
