import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Megaphone, Target, BarChart3, Loader2,
  ArrowRight, DollarSign, Clock, CheckCircle,
} from "lucide-react";

const HOW_IT_WORKS = [
  { icon: Target, step: "01", title: "Tell Us Your Business", desc: "Enter your business type, city, and services. That's all we need to generate high-converting ad copy." },
  { icon: Megaphone, step: "02", title: "AI Generates Ad Copy", desc: "Every month, AI creates 10 fresh Google Ads headlines, descriptions, and extensions — optimized for your market." },
  { icon: BarChart3, step: "03", title: "Paste & Run", desc: "Copy the ad variations directly into Google Ads. Fresh copy monthly keeps your CTR high and costs low." },
];

const INCLUDED = [
  "10 ad copy variations per month",
  "Headlines, descriptions & extensions",
  "Keyword targeting suggestions",
  "Local market optimization",
  "Monthly refresh — always fresh copy",
  "Delivered via email — ready to paste",
  "7-day free trial — cancel anytime",
];

export default function AIAdsCopyGenerator() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [form, setForm] = useState({ businessName: "", email: "", name: "", city: "", services: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.city) { toast.error("Please fill in all required fields"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ads-copy-checkout", { body: form });
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
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">Your first batch of Google Ads copy will be delivered to your email within 24 hours. Fresh copy every month after that.</p>
          <p className="text-xs text-[#666]">Questions? Email matt@mattmichelstraining.com</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Google Ads Copy Generator — $39/mo" description="AI generates 10 Google Ads copy variations monthly for your local business. Headlines, descriptions, and keyword suggestions. $39/mo." path="/ai-ads-copy" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Megaphone size={11} /> AI Ads Copy</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Stop Guessing.<br /><span className="text-[#f97316]">Let AI Write Your Ads.</span></h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">Every month, AI generates 10 high-converting Google Ads variations tailored to your business and city. Just paste and run.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button size="lg" className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl" onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}>Start Free 7-Day Trial <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <div className="flex items-center gap-2 text-[#888] text-sm"><Clock size={14} /><span>First ads delivered in 24 hours</span></div>
            </div>
            <p className="text-xs text-[#666] mt-4">$39/mo after trial · Month-to-month · Cancel anytime</p>
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
              <div className="text-4xl font-black text-[#f97316] mb-1">$39<span className="text-xl text-[#888] font-normal">/mo</span></div>
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
                  <div><Label className="text-[#aaa] text-xs">Business Name *</Label><Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Smith Plumbing" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                  <div><Label className="text-[#aaa] text-xs">City *</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Detroit, MI" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                </div>
                <div><Label className="text-[#aaa] text-xs">Services You Offer</Label><Input value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} placeholder="Plumbing, drain cleaning, water heater..." className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
                <div><Label className="text-[#aaa] text-xs">Email Address *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@smithplumbing.com" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                <Button type="submit" className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Start Free 7-Day Trial →"}
                </Button>
                <p className="text-[10px] text-center text-[#555]">Secure payment via Stripe. $39/mo after 7 days.</p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
