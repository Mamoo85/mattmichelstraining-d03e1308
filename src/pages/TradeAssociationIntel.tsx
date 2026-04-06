import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Bell, FileText, TrendingUp, Users, Zap, Shield } from "lucide-react";

const FEATURES = [
  { icon: Bell, title: "Weekly Policy & Regulatory Digest", desc: "Every significant policy change, comment period, proposed rule, and legislative update from your trade associations — summarized and explained, not just forwarded." },
  { icon: FileText, title: "Comment Period Alerts", desc: "When a regulation affecting your industry opens for public comment, you're notified with enough lead time to actually respond. Most businesses miss these windows entirely." },
  { icon: TrendingUp, title: "Industry Trend Briefing", desc: "Monthly analysis of the trends your associations are tracking — workforce shifts, supply chain developments, technology adoption curves in your sector." },
  { icon: Users, title: "Member Benefits Audit", desc: "Most companies pay association dues and use maybe 10% of available benefits. AI inventories what you're entitled to and what you're leaving on the table." },
  { icon: Shield, title: "Compliance Calendar", desc: "Deadlines, reporting requirements, and certification renewals from your associations consolidated into a single calendar — with 30-day advance alerts." },
  { icon: Zap, title: "Multi-Association Monitoring", desc: "If you belong to multiple associations (national, state, regional), all feeds get consolidated into one weekly digest. No more separate email lists." },
];

export default function TradeAssociationIntel() {
  const [form, setForm] = useState({ email: "", name: "", company_name: "", associations: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.company_name) { toast.error("Email and company name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-trade-association-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Intelligence activated.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will configure your association monitoring within 24 hours. First weekly digest arrives Monday.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Trade Association Intelligence — $149/mo | M2 Training" description="Weekly briefing on policy changes, regulatory updates, and industry moves from your trade associations. Never miss a comment period or compliance deadline again." path="/trade-association-intel" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Trade Association Intelligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">You Pay the Dues.<br /><span className="text-primary">Are You Getting the Intelligence?</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Your trade associations publish regulatory updates, policy changes, and industry intelligence every week. Most of it gets buried in email or ignored entirely. AI monitors every feed and delivers what actually matters — before the deadline passes.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$149<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">All associations · Weekly digest · Cancel anytime</p>
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
            <h2 className="text-2xl font-black text-center mb-2">Start Association Monitoring</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Configured within 24 hours. First digest arrives Monday.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "company_name", label: "Company Name *", placeholder: "Acme Manufacturing" },
                { key: "associations", label: "Trade Associations (list them)", placeholder: "NFIB, NAM, state chamber..." },
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
                {loading ? "Redirecting…" : "Get Started — $149/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
