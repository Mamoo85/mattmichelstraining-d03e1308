import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, DollarSign, Shield, Search, Zap, AlertTriangle } from "lucide-react";

const FEATURES = [
  { icon: DollarSign, title: "Itemized Bill Audit Request", desc: "AI writes the letter requesting a complete itemized bill — the first step in catching duplicate charges, upcoding, and phantom services." },
  { icon: AlertTriangle, title: "Charge Dispute Letters", desc: "For every incorrect charge identified, AI writes a formal dispute citing the relevant billing codes, Medicare rates, and applicable state laws." },
  { icon: Shield, title: "Insurance Coordination Disputes", desc: "When your insurer and the provider disagree on what's covered, AI writes the coordination letters that force a resolution." },
  { icon: Search, title: "Explanation of Benefits Analysis", desc: "Upload your EOB and AI identifies discrepancies between what was billed, what was approved, and what you're actually being asked to pay." },
  { icon: FileText, title: "Financial Hardship Applications", desc: "AI writes financial hardship letters and charity care applications — most hospitals have programs they don't advertise." },
  { icon: Zap, title: "Negotiation Prep Package", desc: "Before you call to negotiate, AI generates a talking-points document with comparable rates, settlement precedents, and the right ask." },
];

export default function MedicalBillDispute() {
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Email and name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-medical-bill-checkout", { body: form });
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
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will reach out within 24 hours. Send over your bills and first letters go out within 48 hours.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13139921219" className="text-primary font-bold">(313) 992-1219</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Medical Bill Dispute Letters — $79/mo | M2 Training" description="AI writes itemized dispute letters for incorrect medical charges. Challenge upcoding, duplicate charges, and billing errors automatically." path="/medical-bill-dispute" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Medical Bill Disputes
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">80% of Medical Bills<br /><span className="text-primary">Contain Errors. Fight Back.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Studies show the vast majority of hospital bills have at least one error — duplicate charges, upcoding, services never rendered. Most patients pay without questioning. AI writes the dispute letters that put the burden of proof back on the provider.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$79<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">Unlimited disputes · All providers · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Start Fighting Bills <ArrowRight size={14} />
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
            <h2 className="text-2xl font-black text-center mb-2">Start Disputing Your Bills</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Send over your bills and first letters go out within 48 hours.</p>
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
                {loading ? "Redirecting…" : "Get Started — $79/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
