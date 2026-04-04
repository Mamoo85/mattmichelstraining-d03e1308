import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Bell, Star, MessageSquare, Clock, Zap } from "lucide-react";

const FEATURES = [
  { icon: Bell, title: "Instant SMS Alert", desc: "The moment a new review lands on Google, you get a text with the full review text. No more logging in to check." },
  { icon: Star, title: "AI Suggested Response", desc: "Every alert includes a ready-to-post response written by AI. Copy, paste, done. Looks personal, takes 10 seconds." },
  { icon: MessageSquare, title: "Weekly Digest Email", desc: "Every Monday: all reviews from the past week, your rating trend, and how you compare to competitors in your area." },
  { icon: Clock, title: "Checks Every 6 Hours", desc: "4x per day, every day. You'll know about reviews within hours — not weeks." },
];

const COMPARISON = [
  { tool: "Birdeye", price: "$299/mo", what: "Review monitoring + reputation suite" },
  { tool: "Podium", price: "$399/mo", what: "Messaging + review management" },
  { tool: "ReviewTrackers", price: "$99/mo", what: "Review monitoring only" },
  { tool: "M2 Review Monitor", price: "$25/mo", what: "Instant alerts + AI responses + weekly digest", highlight: true },
];

export default function ReviewMonitor() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-review-monitor-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're set!</h1>
        <p className="text-muted-foreground">Matt will connect your Google Business Profile within 24 hours. After that, every new review triggers an instant text alert with a ready-to-post response.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Google Review Monitor — Instant Alerts + AI Responses | $29/mo" description="Get an instant text the moment you get a new Google review, with a ready-to-post AI response. $29/mo. Never miss a review again." path="/review-monitor" />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Bell size={11} /> Review Monitor
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Know the Second You<br /><span className="text-primary">Get a Google Review.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Most business owners find out about reviews weeks later — if at all. You'll know within hours, with an AI-written response ready to copy and paste.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$25<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Cancel anytime · No contracts · Setup in 24 hours</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start Monitoring <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">What Others Charge</h2>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div key={c.tool} className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-lg font-black ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><f.icon size={16} className="text-primary" /></div>
                  <div><p className="font-bold text-sm mb-1">{f.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start for $25/mo</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Matt connects your profile within 24 hours. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Smith's HVAC" },
                { key: "name", label: "Your Name", placeholder: "John Smith" },
                { key: "email", label: "Email *", placeholder: "john@smithshvac.com", type: "email" },
                { key: "phone", label: "Cell Phone (for SMS alerts) *", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Monitoring My Reviews — $25/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
