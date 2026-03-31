import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

const INCLUDED = [
  "Monthly AI-written congregation newsletter",
  "Weekly bulletin content and announcements",
  "Sermon recap summaries",
  "Volunteer spotlights and event recaps",
  "Upcoming events section (you provide dates)",
  "Seasonal devotionals and reflections",
  "Works for churches, nonprofits, and ministries",
  "7-day free trial — cancel anytime",
];

export default function AIChurchNewsletter() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [form, setForm] = useState({ businessName: "", email: "", name: "", denomination: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) { toast.error("Fill in all required fields"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-church-newsletter-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err: any) { toast.error(err.message || "Something went wrong."); }
    finally { setLoading(false); }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">Welcome!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to learn about your church and get your first newsletter started.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Church & Nonprofit Newsletter — $29/mo | M² Development" description="AI writes your monthly congregation newsletter, weekly bulletin content, and sermon recaps. $29/month — the most affordable ministry tool available." path="/ai-church-newsletter" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><BookOpen size={11} /> AI Church & Nonprofit Newsletter</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Your Congregation Deserves<br /><span className="text-[#f97316]">a Great Newsletter.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes your monthly newsletter, weekly bulletin copy, and sermon summaries. You give us the heart of your ministry — we handle the writing. Just $29/month.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$29/mo after trial · Churches, nonprofits & ministries · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCLUDED.map(item => (
                <div key={item} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <CheckCircle size={15} className="text-[#f97316] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#ccc]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-20">
          <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-black mb-2">Start Your Free Trial</h2>
            <p className="text-[#888] text-sm mb-6">7 days free, then $29/month. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#888] block mb-1">Your Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Pastor John" className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-[#555] rounded-lg outline-none focus:ring-1 focus:ring-[#f97316]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#888] block mb-1">Church / Org Name *</label>
                  <input value={form.businessName} onChange={e => setForm(f => ({...f, businessName: e.target.value}))} placeholder="Grace Community Church" required className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-[#555] rounded-lg outline-none focus:ring-1 focus:ring-[#f97316]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#888] block mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="pastor@yourchurch.org" required className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-[#555] rounded-lg outline-none focus:ring-1 focus:ring-[#f97316]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#888] block mb-1">Denomination (optional)</label>
                  <input value={form.denomination} onChange={e => setForm(f => ({...f, denomination: e.target.value}))} placeholder="Baptist, Catholic, Nondenominational…" className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-[#555] rounded-lg outline-none focus:ring-1 focus:ring-[#f97316]" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white py-3 font-bold text-sm uppercase tracking-widest rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Processing..." : "Start Free Trial →"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
