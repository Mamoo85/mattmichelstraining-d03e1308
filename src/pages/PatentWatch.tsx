import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Search, Bell, TrendingUp, Shield, Zap, Eye } from "lucide-react";

const FEATURES = [
  { icon: Search, title: "Weekly Patent Filing Digest", desc: "Every new patent filed in your technology space — by competitors, research institutions, and startups — summarized and delivered to your inbox every Monday." },
  { icon: Bell, title: "Competitor Patent Alerts", desc: "Get notified within 48 hours when a named competitor files a new patent. Know what they're building before it ships." },
  { icon: TrendingUp, title: "Technology Trend Analysis", desc: "Monthly AI report on emerging patent clusters in your space — where investment is concentrating and what technology directions are heating up." },
  { icon: Shield, title: "Freedom-to-Operate Signals", desc: "AI flags patents that could affect your product roadmap and suggests areas where you have clear runway." },
  { icon: Eye, title: "Prior Art Discovery", desc: "Need to challenge a patent? AI surfaces relevant prior art from the database to support your legal team." },
  { icon: Zap, title: "Custom IPC Class Monitoring", desc: "We configure monitoring for the exact patent classes relevant to your technology — not a generic feed." },
];

export default function PatentWatch() {
  const [form, setForm] = useState({ email: "", name: "", company_name: "", industry: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.company_name) { toast.error("Email and company name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-patent-watch-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">Monitoring activated.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will configure your patent classes within 24 hours. Your first weekly digest arrives next Monday.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Patent Watch Intelligence — $199/mo | M2 Training" description="Weekly digest of new patent filings in your technology space. Know what competitors are building before it ships. Automated alerts, trend analysis, prior art discovery." path="/patent-watch" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Search size={11} /> Patent Intelligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Know What Competitors<br /><span className="text-primary">Are Building. Before They Ship.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">The USPTO publishes 500,000+ patents per year. Your competitors file in there. Researchers who will disrupt your market file in there. Most companies find out 18 months too late. Patent Watch monitors it for you.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$199<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">Weekly digest · Competitor alerts · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Start Monitoring <ArrowRight size={14} />
            </button>
          </div>
        </section>

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

        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Patent Monitoring</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Setup takes 24 hours. First digest arrives the following Monday.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "company_name", label: "Company Name *", placeholder: "Acme Technologies" },
                { key: "industry", label: "Industry / Technology Space *", placeholder: "Medical devices, robotics, SaaS..." },
                { key: "name", label: "Your Name *", placeholder: "Jane Smith" },
                { key: "email", label: "Email Address *", placeholder: "jane@company.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Monitoring — $199/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
