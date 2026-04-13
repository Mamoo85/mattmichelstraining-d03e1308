import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, MessageSquare, UtensilsCrossed, Phone, DollarSign, Clock, Users, Star } from "lucide-react";

const SAMPLE_TEXTS = [
  { day: "Tuesday", msg: "Taco Tuesday is BACK! $2 tacos + $5 margs all day. Bring the crew. 🌮 Reply STOP to opt out." },
  { day: "Friday", msg: "Weekend special: buy 1 entree, get 1 half off. Tonight only. Walk-ins welcome! Reply STOP to opt out." },
  { day: "Monday", msg: "New week, new menu item: smoked brisket mac & cheese. First 20 orders get a free side. Reply STOP to opt out." },
];

const WHY = [
  { icon: DollarSign, title: "51x ROI", desc: "SMS marketing returns $51 for every $1 spent. Best ROI of any marketing channel for restaurants." },
  { icon: Clock, title: "98% Open Rate", desc: "Texts get read in 3 minutes. Emails sit in spam. Flyers go in the trash. Texts get read." },
  { icon: Users, title: "Builds Your List", desc: "We put a 'Text JOIN to get specials' widget on your website. Your list grows on autopilot." },
  { icon: Star, title: "Zero Effort", desc: "AI writes the text. We send it. You don't log in, click send, or write anything. Ever." },
];

export default function RestaurantSMS() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "restaurant", city: "", state: "MI" });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're in!</h1>
        <p className="text-muted-foreground">Reply to your welcome email with your customer list (name + phone as a spreadsheet or CSV) and we'll get your first text out this Tuesday.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13139921219" className="text-primary">(313) 992-1219</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Restaurant SMS Marketing — Weekly Specials Texted to Your Customers | $19/mo"
        description="Send your weekly specials, happy hour deals, and events directly to your customers' phones. AI writes the text. We send it. $19/mo flat. No contracts."
        path="/restaurant-sms"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <UtensilsCrossed size={11} /> Restaurant SMS Marketing
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Your Tuesday Special.<br /><span className="text-primary">In Every Customer's Pocket.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Most restaurants post specials on Instagram and hope someone sees it. Your competitors are texting their customers directly — and filling tables. Join them for <strong className="text-foreground">$19/month</strong>.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$19<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">AI writes it · We send it · Tables fill up</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
                Get Started <ArrowRight size={14} />
              </button>
              <a href="tel:+13139921219" className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-bold text-sm uppercase tracking-widest hover:bg-card">
                <Phone size={14} /> (313) 992-1219
              </a>
            </div>
          </div>
        </section>

        {/* Sample Texts */}
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What your customers will see</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">AI writes a fresh, on-brand text every week. Here are real examples:</p>
            <div className="space-y-3">
              {SAMPLE_TEXTS.map((t) => (
                <div key={t.day} className="bg-background border border-border rounded-xl p-4 flex gap-4 items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.day}</p>
                    <p className="text-sm text-foreground leading-relaxed">{t.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why SMS */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">Why SMS crushes everything else</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {WHY.map((w) => (
                <div key={w.title} className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <w.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{w.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { step: "01", title: "Send Us Your List", desc: "Customer names + phone numbers. A spreadsheet, a CSV, even a screenshot of your contacts — we'll take it." },
                { step: "02", title: "AI Writes Your Weekly Text", desc: "Every week, AI creates a short, punchy text about your specials, events, or seasonal menu. Tailored to your restaurant." },
                { step: "03", title: "Customers Get It. Tables Fill Up.", desc: "Your entire list gets the text automatically. We handle compliance, opt-outs, and delivery. You just cook." },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-3xl font-black text-primary/20 mb-2">{s.step}</div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">Perfect for</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Weekly specials & daily deals",
                "Happy hour announcements",
                "New menu item launches",
                "Holiday hours & closings",
                "Catering & event promos",
                "Slow night flash deals",
                "Loyalty rewards updates",
                "Seasonal menu drops",
              ].map((u) => (
                <div key={u} className="flex items-center gap-3 p-3 bg-card border border-border rounded">
                  <CheckCircle size={14} className="text-primary flex-shrink-0" />
                  <span className="text-sm">{u}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start for $19/mo</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">No contracts. Cancel anytime. Daily-prorated refunds + $10 fee.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Restaurant Name *", placeholder: "Mama Rosa's Trattoria" },
                { key: "name", label: "Your Name", placeholder: "Rosa DiMaggio" },
                { key: "email", label: "Email *", placeholder: "rosa@mamarosas.com", type: "email" },
                { key: "phone", label: "Your Cell Phone", placeholder: "(313) 555-0100", type: "tel" },
                { key: "city", label: "City", placeholder: "Grosse Pointe" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UtensilsCrossed size={14} />}
                {loading ? "Redirecting…" : "Start Weekly Texts — $19/mo"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-1">TCPA compliant. We handle opt-outs automatically.</p>
            </form>
          </div>
        </section>

        {/* FAQ-ish */}
        <section className="py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-2">Questions? Want to see it in action first?</p>
            <a href="tel:+13139921219" className="text-primary font-bold text-sm hover:underline inline-flex items-center gap-1">
              <Phone size={14} /> Call Matt — (313) 992-1219
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
