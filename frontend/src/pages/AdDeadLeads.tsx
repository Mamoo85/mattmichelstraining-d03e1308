import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Phone, ArrowRight, DollarSign, Users } from "lucide-react";
import { trackFbLead } from "@/lib/fbpixel";

export default function AdDeadLeads() {
  const utm = Object.fromEntries(new URLSearchParams(window.location.search));
  const success = utm.success === "1";
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_name: "", lead_count: "" });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <DollarSign className="mx-auto mb-4 text-green-400" size={52} />
          <h1 className="text-3xl font-black mb-3">First Reactivation Is On Us!</h1>
          <p className="text-slate-300 mb-4">We'll reach out within 1 business day to start your first free dead lead reactivation campaign. Get ready to see who's still interested.</p>
          <p className="text-sm text-slate-400">
            Questions? Call Matt: <a href="tel:+13139921219" className="text-green-400 font-bold">(313) 992-1219</a>
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
      const { error } = await supabase.functions.invoke("create-dead-lead-campaign-checkout", {
        body: {
          ...form,
          free_first: true,
          utm_source: utm.utm_source ?? "ad",
          utm_medium: utm.utm_medium ?? "paid",
          utm_campaign: utm.utm_campaign ?? "dead-leads-ad",
          source: "ad-lander",
        },
      });
      if (error) throw error;
      trackFbLead("dead-leads-ad");
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
        title="Dead Lead Reactivation — First Campaign Free | Detroit Web Agency"
        description="Your old dead leads are worth real money. We text them — you only pay when they say yes. First reactivation is free."
        path="/ad/dead-leads"
      />
      <div className="min-h-screen bg-[#0f1923]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-green-400 font-black text-sm tracking-wider uppercase">Detroit Web Agency</p>
          <a href="tel:+13139921219" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 992-1219
          </a>
        </div>

        <div className="max-w-lg mx-auto px-4 py-14">
          <div className="text-center text-white mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-[11px] font-bold tracking-widest uppercase mb-5">
              <DollarSign size={11} /> First Reactivation Is FREE
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Your Dead Leads Are<br /><span className="text-green-400">Worth Real Money.</span>
            </h1>
            <p className="text-slate-300 text-sm">
              We text your old unresponsive leads a personalized message. You only pay $50 for the ones that actually say yes. Zero risk — your first campaign is completely free.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8 text-center text-white">
            <div className="border border-white/10 rounded-lg p-3">
              <Users size={18} className="mx-auto mb-1.5 text-green-400" />
              <p className="text-[10px] text-slate-400">We text your</p>
              <p className="text-sm font-black">Old Leads</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <CheckCircle size={18} className="mx-auto mb-1.5 text-green-400" />
              <p className="text-[10px] text-slate-400">Pay only per</p>
              <p className="text-sm font-black">Positive Reply</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <DollarSign size={18} className="mx-auto mb-1.5 text-green-400" />
              <p className="text-[10px] text-slate-400">First campaign</p>
              <p className="text-sm font-black">100% Free</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-2xl">
            <p className="text-xs font-bold text-slate-600 mb-4 text-center">Get your first dead lead reactivation FREE — no credit card</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mike Smith" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business</label>
                  <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Smith Roofing" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mike@smithroofing.com" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Your Phone <span className="text-red-500">*</span></label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-0100" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">How many dead leads? (approx.)</label>
                <input type="number" value={form.lead_count} onChange={(e) => setForm({ ...form, lead_count: e.target.value })} placeholder="e.g. 200" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" />
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-4 rounded-lg font-bold text-base transition">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <>Claim My Free Reactivation <ArrowRight size={16} /></>}
              </button>
              <p className="text-[10px] text-center text-slate-400">100% free first campaign. Then $50 per positive reply. No monthly fee.</p>
            </form>
          </div>

          <div className="mt-10 text-sm text-slate-400 text-center space-y-2">
            <p className="font-semibold text-white">How it works:</p>
            <p>📋 You send us your old lead list (name + phone)</p>
            <p>💬 We send a personalized text: "Hey [name], still need [service]?"</p>
            <p>✅ Every "yes" is a warm lead — you only pay $50 per reply</p>
          </div>
        </div>
      </div>
    </>
  );
}
