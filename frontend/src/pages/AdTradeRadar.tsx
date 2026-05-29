import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Phone, ArrowRight, Zap, MapPin, Bell } from "lucide-react";
import { trackFbLead } from "@/lib/fbpixel";

const VERTICALS = [
  "Roofing", "HVAC", "Plumbing", "Electrical", "Gutters",
  "Exterior / Siding", "Painting", "Tree Service", "Pest Control", "Foundation", "Other",
];

export default function AdTradeRadar() {
  const utm = Object.fromEntries(new URLSearchParams(window.location.search));
  const success = utm.success === "1";
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_name: "", vertical: "", zip: "" });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#0c1a0e] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <Bell className="mx-auto mb-4 text-orange-400" size={52} />
          <h1 className="text-3xl font-black mb-3">Trade Radar Is On!</h1>
          <p className="text-slate-300 mb-4">Your 7-day free trial is being set up. Check your inbox — first lead signals usually arrive within 24 hours.</p>
          <p className="text-sm text-slate-400">
            Questions? <a href="tel:+13139921219" className="text-orange-400 font-bold">(313) 992-1219</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.zip) { toast.error("Name, email, and ZIP code are required"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("create-trade-radar-checkout", {
        body: {
          ...form,
          trial: true,
          utm_source: utm.utm_source ?? "ad",
          utm_medium: utm.utm_medium ?? "paid",
          utm_campaign: utm.utm_campaign ?? "trade-radar-ad",
          source: "ad-lander",
        },
      });
      if (error) throw error;
      trackFbLead("trade-radar-ad");
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
        title="Trade Radar — Daily Lead Signals for Contractors | Detroit Web Agency"
        description="Daily permit pulls, storm damage alerts, and homeowner signals delivered every morning. Free 7-day trial."
        path="/ad/trade-radar"
      />
      <div className="min-h-screen bg-[#0c1a0e]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-orange-400 font-black text-sm tracking-wider uppercase">Detroit Web Agency</p>
          <a href="tel:+13139921219" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 992-1219
          </a>
        </div>

        <div className="max-w-lg mx-auto px-4 py-14">
          <div className="text-center text-white mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-bold tracking-widest uppercase mb-5">
              <Zap size={11} /> 7-Day Free Trial — No Credit Card
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Stop Chasing Leads.<br /><span className="text-orange-400">Let the Signals Come to You.</span>
            </h1>
            <p className="text-slate-300 text-sm">
              Every morning: fresh permit pulls, storm damage reports, and homeowner signals in your market — before your competitors wake up.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8 text-center text-white">
            <div className="border border-white/10 rounded-lg p-3">
              <MapPin size={18} className="mx-auto mb-1.5 text-orange-400" />
              <p className="text-[10px] text-slate-400">Hyper-local</p>
              <p className="text-sm font-black">Your ZIP Code</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <Bell size={18} className="mx-auto mb-1.5 text-orange-400" />
              <p className="text-[10px] text-slate-400">Fresh signals</p>
              <p className="text-sm font-black">Every Morning</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <CheckCircle size={18} className="mx-auto mb-1.5 text-orange-400" />
              <p className="text-[10px] text-slate-400">Trial cost</p>
              <p className="text-sm font-black">$0 Free</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mike Smith" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business</label>
                  <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Smith Roofing" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mike@smithroofing.com" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-0100" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Service ZIP <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="48228" maxLength={5} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Your Trade</label>
                <select value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 bg-white">
                  <option value="">Select your trade…</option>
                  {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-lg font-bold text-base transition">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Starting trial…</> : <>Start Getting Signals Free <ArrowRight size={16} /></>}
              </button>
              <p className="text-[10px] text-center text-slate-400">7 days free. No credit card. Then $149/mo. Cancel anytime.</p>
            </form>
          </div>

          <div className="mt-10 text-sm text-slate-400 text-center space-y-2">
            <p className="font-semibold text-white">What you get every morning:</p>
            <p>🏗️ Building permits filed in your area</p>
            <p>⛈️ Storm damage reports from NOAA + local sources</p>
            <p>🏠 Homeowner intent signals (insurance claims, listings)</p>
          </div>
        </div>
      </div>
    </>
  );
}
