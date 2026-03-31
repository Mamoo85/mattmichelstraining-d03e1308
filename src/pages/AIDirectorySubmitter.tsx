import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Globe, Search, CheckCircle2, Loader2, ArrowRight, DollarSign, Clock, CheckCircle, Shield } from "lucide-react";

const HOW_IT_WORKS = [
  { icon: Search, step: "01", title: "We Audit 20+ Directories", desc: "AI scans Yelp, YellowPages, BBB, Angi, MapQuest, and 15+ other directories for your business listing." },
  { icon: CheckCircle2, step: "02", title: "Find Inconsistencies", desc: "Wrong phone number? Old address? Missing listing? AI identifies every NAP inconsistency that hurts your SEO." },
  { icon: Globe, step: "03", title: "Monthly Fix Report", desc: "Every month you get a clear report showing which listings need fixing, with exact instructions for each directory." },
];

const INCLUDED = [
  "Monthly audit of 20+ business directories",
  "NAP consistency checking (Name, Address, Phone)",
  "Missing listing detection",
  "Incorrect data alerts",
  "Directory-specific fix instructions",
  "SEO impact scoring",
  "Yelp, BBB, YellowPages, Angi + more",
  "7-day free trial — cancel anytime",
];

export default function AIDirectorySubmitter() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [form, setForm] = useState({ businessName: "", email: "", name: "", address: "", phone: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) { toast.error("Please fill in all required fields"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-directory-submitter-checkout", { body: form });
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
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">Your first directory audit will arrive within 7 days. Monthly audits on the 1st after that.</p>
          <p className="text-xs text-[#666]">Questions? Email matt@mattmichelstraining.com</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Local Directory Submitter — $39/mo" description="Monthly audit of 20+ business directories for NAP consistency. Fix wrong listings that hurt your local SEO. $39/mo." path="/ai-directory-submitter" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Shield size={11} /> AI Directory Submitter</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Wrong Info Online<br /><span className="text-[#f97316]">Costs You Customers.</span></h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">AI audits 20+ business directories monthly and tells you exactly where your Name, Address, and Phone are wrong — the #1 factor in local search rankings.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button size="lg" className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl" onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}>Start Free 7-Day Trial <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <div className="flex items-center gap-2 text-[#888] text-sm"><Clock size={14} /><span>First audit in 7 days</span></div>
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
                  <div><Label className="text-[#aaa] text-xs">Business Name *</Label><Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Smith Plumbing LLC" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required /></div>
                  <div><Label className="text-[#aaa] text-xs">Your Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
                </div>
                <div><Label className="text-[#aaa] text-xs">Business Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, Detroit, MI 48201" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
                <div><Label className="text-[#aaa] text-xs">Business Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(313) 555-1234" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" /></div>
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
