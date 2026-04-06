import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Shield, Clock, RefreshCw, Zap, CheckSquare } from "lucide-react";

const FEATURES = [
  { icon: FileText, title: "FCRA-Compliant Dispute Letters", desc: "AI generates legally structured dispute letters for every negative item — late payments, collections, charge-offs, hard inquiries. Sent to Equifax, Experian, and TransUnion." },
  { icon: Shield, title: "Method of Verification Requests", desc: "When bureaus verify without actually verifying, AI generates Method of Verification demands that force them to produce documentation or delete the item." },
  { icon: RefreshCw, title: "30-Day Follow-Up Automation", desc: "If an item isn't removed or updated within 30 days, a follow-up letter goes out automatically. You don't have to track anything." },
  { icon: Clock, title: "Unlimited Disputes", desc: "Dispute every negative item across all three bureaus. No per-letter charges, no limits on rounds." },
  { icon: CheckSquare, title: "Dispute Tracking Dashboard", desc: "See every item in dispute, which bureau it's at, what round you're on, and what the last response was." },
  { icon: Zap, title: "Debt Validation Letters", desc: "For collections accounts, AI writes FDCPA debt validation letters demanding the collector prove the debt is valid and owed by you." },
];

const COMPARISON = [
  { tool: "Credit repair company", price: "$99–199/mo", what: "They write the same letters you could write — just slower and more expensive" },
  { tool: "Attorney-based credit repair", price: "$300–500/mo", what: "Overkill for most disputes, reserved for serious violations" },
  { tool: "DIY (free templates)", price: "Free but slow", what: "Generic letters, no follow-up automation, you track everything manually" },
  { tool: "M2 Credit Dispute Factory", price: "$79/mo", what: "AI-generated FCRA letters, unlimited disputes, automated follow-ups", highlight: true },
];

export default function CreditDispute() {
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Email and name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-credit-dispute-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">You're set.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will reach out within 24 hours. Upload your credit reports and first dispute letters go out within 48 hours.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Credit Dispute Letter Factory — $79/mo | M2 Training" description="AI generates FCRA-compliant dispute letters for every negative item on your credit report. Unlimited disputes, automated follow-ups, all three bureaus." path="/credit-dispute" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Credit Dispute Service
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Fight Every Negative Item.<br /><span className="text-primary">Automatically.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Credit bureaus make mistakes. Collections accounts get reported twice. Late payments show up years after they were resolved. AI writes the FCRA-compliant letters that force bureaus to investigate — and remove items they can't verify.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$79<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">Unlimited disputes · All 3 bureaus · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Start Disputing <ArrowRight size={14} />
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

        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">Why Not DIY?</h2>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div key={c.tool} className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Disputing Today</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">First letters go out within 48 hours of signup.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Full Name *", placeholder: "John Smith" },
                { key: "email", label: "Email Address *", placeholder: "john@email.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Disputing — $79/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
