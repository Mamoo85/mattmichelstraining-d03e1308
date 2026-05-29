import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Phone, Eye, ArrowRight, Building2 } from "lucide-react";
import { trackFbLead } from "@/lib/fbpixel";

export default function AdSiteRadar() {
  const utm = Object.fromEntries(new URLSearchParams(window.location.search));
  const success = utm.success === "1";
  const [form, setForm] = useState({ name: "", email: "", website_url: "", business_name: "" });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <Eye className="mx-auto mb-4 text-[#22d3ee]" size={52} />
          <h1 className="text-3xl font-black mb-3">SiteRadar is Live!</h1>
          <p className="text-slate-300 mb-4">We're setting up your visitor identification. You'll see your first visitor report within 24 hours of adding the tracking code.</p>
          <p className="text-sm text-slate-400">
            Questions? <a href="tel:+13139921219" className="text-[#22d3ee] font-bold">(313) 992-1219</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.website_url) { toast.error("Name, email, and website are required"); return; }
    let url = form.website_url.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("create-site-radar-checkout", {
        body: {
          ...form,
          website_url: url,
          trial: true,
          utm_source: utm.utm_source ?? "ad",
          utm_medium: utm.utm_medium ?? "paid",
          utm_campaign: utm.utm_campaign ?? "site-radar-ad",
          source: "ad-lander",
        },
      });
      if (error) throw error;
      trackFbLead("site-radar-ad");
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
        title="SiteRadar — See Who Visits Your Website | Detroit Web Agency"
        description="Identify anonymous business visitors to your website before they call your competitor. Free 7-day trial."
        path="/ad/site-radar"
      />
      <div className="min-h-screen bg-[#0a1628]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-[#22d3ee] font-black text-sm tracking-wider uppercase">Detroit Web Agency</p>
          <a href="tel:+13139921219" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 992-1219
          </a>
        </div>

        <div className="max-w-lg mx-auto px-4 py-14">
          <div className="text-center text-white mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22d3ee]/20 text-[#22d3ee] text-[11px] font-bold tracking-widest uppercase mb-5">
              <Eye size={11} /> 7-Day Free Trial — No Credit Card
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              See Every Company That<br /><span className="text-[#22d3ee]">Visits Your Website.</span>
            </h1>
            <p className="text-slate-300 text-sm">
              SiteRadar reveals the businesses browsing your site — company name, industry, pages viewed — before they call your competitor.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8 text-center text-white">
            <div className="border border-white/10 rounded-lg p-3">
              <Building2 size={18} className="mx-auto mb-1.5 text-[#22d3ee]" />
              <p className="text-[10px] text-slate-400">Identifies</p>
              <p className="text-sm font-black">Business Visitors</p>
            </div>
            <div className="border border-white/10 rounded-lg p-3">
              <Eye size={18} className="mx-auto mb-1.5 text-[#22d3ee]" />
              <p className="text-[10px] text-slate-400">See which</p>
              <p className="text-sm font-black">Pages They View</p>
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
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Your Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mike Smith" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Business Name</label>
                  <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Smith Agency" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mike@smithagency.com" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Your Website <span className="text-red-500">*</span></label>
                <input type="text" required value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="www.smithagency.com" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/30" />
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-white py-4 rounded-lg font-bold text-base transition">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Starting trial…</> : <>See My Visitors Free <ArrowRight size={16} /></>}
              </button>
              <p className="text-[10px] text-center text-slate-400">7 days free. No credit card. Then $49/mo. Cancel anytime.</p>
            </form>
          </div>

          <div className="mt-10 text-sm text-slate-400 text-center space-y-2">
            <p className="font-semibold text-white">What you'll see every day:</p>
            <p>🏢 Company name, industry, and location</p>
            <p>📄 Which pages they visited and how long</p>
            <p>📬 Direct outreach suggestions — reach them first</p>
          </div>
        </div>
      </div>
    </>
  );
}
