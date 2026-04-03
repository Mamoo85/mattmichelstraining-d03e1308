import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, MessageSquare, Users, Repeat, TrendingUp } from "lucide-react";

const HOW_IT_WORKS = [
  { step: "01", title: "Upload Your List", desc: "Send us your customer list (name + phone). We import it securely, handle opt-outs, and stay FCC-compliant." },
  { step: "02", title: "AI Writes the Message", desc: "Every Tuesday morning, AI generates a fresh 1-2 sentence tip, reminder, or offer tailored to your business and the season." },
  { step: "03", title: "We Send It", desc: "Your entire list gets the text automatically. No logins, no dashboards, no clicking send." },
];

export default function WeeklySMSBlast() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "", city: "", state: "MI" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-sms-blast-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're in!</h1>
        <p className="text-muted-foreground">Reply to your welcome email with your customer list (name + phone as a spreadsheet or CSV) and we'll get you live by this Tuesday.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Weekly SMS Blast — AI-Written Texts to Your Customers | $19/mo" description="Every Tuesday, AI writes and sends a personalized SMS to your customer list. Stay top of mind, drive repeat business. $19/mo." path="/weekly-sms-blast" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <MessageSquare size={11} /> Weekly SMS Blast
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Stay Top of Mind.<br /><span className="text-primary">Every Single Week.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Your customers forget about you between visits. A short weekly text — a tip, a reminder, a special — keeps you first in mind when they need your service again.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$19<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">AI writes it · We send it · You get results</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Get Started <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-3xl font-black text-primary/20 mb-2">{s.step}</div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-8 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
            {[{ icon: Users, stat: "200+", label: "contacts per blast" }, { icon: Repeat, stat: "52x/yr", label: "touchpoints per customer" }, { icon: TrendingUp, stat: "$0", label: "effort after setup" }].map((s) => (
              <div key={s.stat}><s.icon size={20} className="text-primary mx-auto mb-2" /><div className="text-2xl font-black">{s.stat}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            ))}
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start for $19/mo</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Send us your list, we handle everything after that.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Tony's Auto Repair" },
                { key: "businessType", label: "Business Type", placeholder: "Auto Repair Shop" },
                { key: "name", label: "Your Name", placeholder: "Tony Ricci" },
                { key: "email", label: "Email *", placeholder: "tony@tonysauto.com", type: "email" },
                { key: "phone", label: "Your Cell Phone", placeholder: "(313) 555-0100", type: "tel" },
                { key: "city", label: "City", placeholder: "Grosse Pointe" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Weekly SMS — $19/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
