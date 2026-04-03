import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Zap, MessageSquare, Users, TrendingUp } from "lucide-react";

const HOW_IT_WORKS = [
  { step: "01", title: "Pick Your Keyword", desc: "Choose a word like \"SLOW\" or \"PROMO\". Text it to your M² number whenever business needs a boost." },
  { step: "02", title: "AI Writes the Offer", desc: "We generate a personalized promo message based on your business, the season, and the offer you have in mind." },
  { step: "03", title: "Blast Goes Out", desc: "Your entire customer list gets the text within minutes. You get a confirmation with how many were sent." },
];

const STATS = [
  { icon: Zap, stat: "< 5 min", label: "from your text to customer phones" },
  { icon: Users, stat: "200+", label: "contacts per blast" },
  { icon: MessageSquare, stat: "1 text", label: "from you triggers it all" },
  { icon: TrendingUp, stat: "20–35%", label: "of customers respond to promo texts" },
];

export default function SlowDaySMS() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "", promoOffer: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-slow-day-checkout", { body: form });
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
        <p className="text-muted-foreground">Matt will set up your trigger keyword and import your contact list within 24 hours. After that, text your keyword any time business is slow — and we do the rest.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Slow Day SMS — One Text Fires a Promo Blast to All Your Customers | $19/mo" description="Text a keyword when business is slow. We blast a promo to your entire customer list within minutes. $19/mo." path="/slow-day-sms" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Zap size={11} /> Slow Day SMS
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Slow Day? One Text<br /><span className="text-primary">Fills Your Schedule.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Text "SLOW" to your M² number. In minutes, your entire customer list gets a promo. AI writes it, we send it, you answer the phone. That's it.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$25<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">7-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">One booked job from the blast = months of subscription paid for</p>
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
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-4xl font-black text-primary/20 mb-3">{s.step}</div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">7 days free. $25/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Kowalski's Auto Spa" },
                { key: "businessType", label: "Business Type", placeholder: "Auto Detailing" },
                { key: "name", label: "Your Name", placeholder: "Stan Kowalski" },
                { key: "email", label: "Email *", placeholder: "stan@kowalskisauto.com", type: "email" },
                { key: "phone", label: "Your Cell (trigger phone)", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Default Promo Offer (optional)</label>
                <input type="text" value={form.promoOffer} onChange={e => setForm(p => ({ ...p, promoOffer: e.target.value }))}
                  placeholder="10% off any service booked today" className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $25/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
