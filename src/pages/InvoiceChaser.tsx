import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Receipt, AlertTriangle, TrendingUp, Clock } from "lucide-react";

const STATS = [
  { icon: Receipt, stat: "29%", label: "of invoices are paid late" },
  { icon: AlertTriangle, stat: "$50K+", label: "avg small biz carries in overdue AR" },
  { icon: TrendingUp, stat: "3x", label: "faster payment with auto follow-up" },
  { icon: Clock, stat: "Day 7/14/21", label: "automated reminder sequence" },
];

const SEQUENCE = [
  { day: "Day 7", tone: "Friendly", title: "Gentle Reminder", msg: "\"Hi [Name], just a quick reminder that invoice #123 for $X is due. Happy to resend if needed!\"" },
  { day: "Day 14", tone: "Firm", title: "Second Notice", msg: "\"[Name], invoice #123 is now 14 days past due. Please arrange payment at your earliest convenience.\"" },
  { day: "Day 21", tone: "Final", title: "Final Notice", msg: "\"[Name], this is a final notice. Invoice #123 is 21 days overdue. Please pay today to avoid further action.\"" },
];

export default function InvoiceChaser() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invoice-chaser-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">7-Day Trial Started!</h1>
        <p className="text-muted-foreground">Matt will set up your invoice webhook within 24 hours. Log an invoice once, and the 3-text chase sequence fires automatically at Day 7, 14, and 21.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Invoice Chaser — Auto-Text Late Payers | $49/mo" description="Stop chasing invoices manually. Automated Day 7, 14, 21 text reminders collect overdue payments 3x faster. 7-day free trial. $49/mo." path="/invoice-chaser" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Receipt size={11} /> Invoice Chaser
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Stop Chasing<br /><span className="text-primary">Late Payers.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Log an invoice once. We send three escalating text reminders — at Day 7, 14, and 21 — automatically. No more awkward follow-up calls. No more invoices that just disappear.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$29<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">7-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">Recovering one invoice pays for months of service</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 7-Day Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.stat} className="text-center bg-card border border-border p-5">
                <s.icon size={20} className="text-primary mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground mb-1">{s.stat}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">The 3-Text Sequence</h2>
            <div className="space-y-4">
              {SEQUENCE.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-16 text-right flex-shrink-0 pt-1">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{s.day}</span>
                  </div>
                  <div className="flex-1 border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm">{s.title}</p>
                      <span className="text-[10px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">{s.tone}</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">{s.msg}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">Customer marks invoice paid → sequence stops automatically.</p>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">7 days free. $29/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Premier Electric LLC" },
                { key: "name", label: "Your Name", placeholder: "Dave Kowalski" },
                { key: "email", label: "Email *", placeholder: "dave@premierelectric.com", type: "email" },
                { key: "phone", label: "Your Phone", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $29/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
