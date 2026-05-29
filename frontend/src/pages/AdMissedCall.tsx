import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Phone, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { trackFbLead } from "@/lib/fbpixel";

export default function AdMissedCall() {
  const utm = Object.fromEntries(new URLSearchParams(window.location.search));
  const success = utm.success === "1";
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_name: "" });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <CheckCircle className="mx-auto mb-4 text-green-400" size={52} />
          <h1 className="text-3xl font-black mb-3">You're In!</h1>
          <p className="text-slate-300 mb-4">Your 7-day free trial is being set up. Check your inbox for setup instructions — usually under 2 minutes.</p>
          <p className="text-sm text-slate-400">
            Questions? Call Matt: <a href="tel:+13139921219" className="text-[#22d3ee] font-bold">(313) 992-1219</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) { toast.error("Name, email, and phone are required"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("create-missed-call-subscription", {
        body: {
          ...form,
          trial: true,
          utm_source: utm.utm_source ?? "ad",
          utm_medium: utm.utm_medium ?? "paid",
          utm_campaign: utm.utm_campaign ?? "missed-call-ad",
          source: "ad-lander",
        },
      });
      if (error) throw error;
      trackFbLead("missed-call-ad");
      window.location.href = window.location.pathname + "?success=1";
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Call (313) 992-1219.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Missed Call Text-Back — Free 7-Day Trial | Detroit Web Agency"
        description="Every missed call gets an instant automatic text. No credit card. Set up in 2 minutes."
        path="/ad/missed-call"
      />
      <div className="min-h-screen bg-[#0f1923]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-[#22d3ee] font-black text-sm tracking-wider uppercase">Detroit Web Agency</p>
          <a href="tel:+13139921219" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 992-1219
          </a>
        </div>

        <div className="max-w-lg mx-auto px-4 py-14">
          <div className="text-center text-white mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22d3ee]/20 text-[#22d3ee] text-[11px] font-bold tracking-widest uppercase mb-5">
              <Clock size={11} /> 7-Day Free Trial — No Credit Card
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Every Missed Call Is<br /><span className="text-[#22d3ee]">A Lost Job.</span>
            </h1>
            <p className="text-slate-300 text-sm">
              We text them back in under 60 seconds — automatically. You focus on the job. We close the lead.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8 text-center text-white">
            <div className="border border-white/10 rounded-lg p-3">
              <MessageSquare size={18} className="mx-auto mb-1.5 text-[#22d3ee]" />
              <p className="text-[10px] text-slate-400">Auto-texts in</p>
              <p className="text-sm font-black">60 Seconds</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <Clock size={18} className="mx-auto mb-1.5 text-[#22d3ee]" />
              <p className="text-[10px] text-slate-400">Setup in</p>
              <p className="text-sm font-black">2 Minutes</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <CheckCircle size={18} className="mx-auto mb-1.5 text-[#22d3ee]" />
              <p className="text-[10px] text-slate-400">Trial cost</p>
              <p className="text-sm font-black">$0 Free</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mike Smith" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business</label>
                  <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Smith Roofing" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mike@smithroofing.com" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business Phone <span className="text-red-500">*</span></label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-0100" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-white py-4 rounded-lg font-bold text-base transition">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Setting up your trial…</> : <>Start My Free Trial <ArrowRight size={16} /></>}
              </button>
              <p className="text-[10px] text-center text-slate-400">7 days free. No credit card. Cancel anytime. Then $99/mo.</p>
            </form>
          </div>

          <div className="mt-10 text-sm text-slate-400 text-center space-y-2">
            <p className="font-semibold text-white">How it works:</p>
            <p>📞 Customer calls → misses → gets an auto-text in 60 seconds</p>
            <p>💬 Text says "Hey, this is [Your Business]. Sorry we missed you! Can we help?"</p>
            <p>✅ They reply → you close the job</p>
          </div>
        </div>
      </div>
    </>
  );
}
