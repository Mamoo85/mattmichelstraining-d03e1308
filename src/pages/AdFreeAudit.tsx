import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, FileText, Phone, Clock, ArrowRight } from "lucide-react";

export default function AdFreeAudit() {
  const success = new URLSearchParams(window.location.search).get("success") === "1";
  const [form, setForm] = useState({ email: "", business_name: "", business_url: "" });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <CheckCircle className="mx-auto mb-4 text-green-400" size={48} />
          <h1 className="text-3xl font-black mb-3">Check Your Inbox!</h1>
          <p className="text-slate-300 mb-6">Your website audit is being generated and will arrive within 60 seconds.</p>
          <p className="text-sm text-slate-400">
            Want help fixing what the audit finds? <a href="tel:+13138064952" className="text-[#e8621a] font-bold">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_url) { toast.error("Email and website URL are required"); return; }
    let url = form.business_url.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("instant-audit", {
        body: { email: form.email, business_name: form.business_name || "Your Business", business_url: url },
      });
      if (error) throw error;
      window.location.search = "?success=1";
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Call (313) 806-4952.");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <SEOHead
        title="Free Website Audit — Instant Report | M² Development"
        description="Get a free AI website audit in 60 seconds. SEO, mobile, speed, and actionable fixes. No credit card."
        path="/ad/free-audit"
      />
      <div className="min-h-screen bg-[#1e293b]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-[#e8621a] font-black text-sm tracking-wider uppercase">M² Development</p>
          <a href="tel:+13138064952" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 806-4952
          </a>
        </div>

        <div className="max-w-lg mx-auto px-4 py-16">
          <div className="text-center text-white mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8621a]/20 text-[#e8621a] text-[11px] font-bold tracking-widest uppercase mb-5">
              <Clock size={11} /> 60-Second Delivery
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Is Your Website <span className="text-[#e8621a]">Costing You Customers?</span>
            </h1>
            <p className="text-slate-300">
              Enter your URL. Get a full professional audit — SEO, mobile, speed, trust signals, and the 3 fixes that will actually move the needle. <strong className="text-[#e8621a]">100% Free.</strong>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8621a]/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business Name</label>
                <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Smith Roofing" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8621a]/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Website URL <span className="text-red-500">*</span></label>
                <input type="text" required value={form.business_url} onChange={(e) => setForm({ ...form, business_url: e.target.value })} placeholder="www.smithroofing.com" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8621a]/30" />
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-[#e8621a] hover:bg-[#d4570f] text-white py-4 rounded-lg font-bold text-base transition">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><FileText size={16} /> Get My Free Audit</>}
              </button>
              <p className="text-[10px] text-center text-slate-400">Free. No credit card. No phone call. Just the report.</p>
            </form>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center text-white">
            <div><p className="text-xl font-black text-[#e8621a]">6</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Categories checked</p></div>
            <div><p className="text-xl font-black text-[#e8621a]">60s</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Delivery time</p></div>
            <div><p className="text-xl font-black text-[#e8621a]">$0</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Cost</p></div>
          </div>
        </div>
      </div>
    </>
  );
}
