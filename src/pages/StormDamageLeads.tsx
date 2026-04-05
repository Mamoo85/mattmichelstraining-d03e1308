import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, CloudLightning, MapPin, Smartphone, AlertTriangle } from "lucide-react";

const FEATURES = [
  { icon: CloudLightning, title: "Real-time NOAA Weather Monitoring", desc: "We tap NOAA's live severe weather feed 24/7 — hail, high winds, flooding, tornadoes." },
  { icon: Smartphone, title: "SMS Alerts Within Minutes", desc: "The moment severe weather hits your zip codes, you get a text. No apps, no dashboards." },
  { icon: MapPin, title: "Matched to YOUR Zip Codes & Trade", desc: "Only get alerted for storms in the areas you actually service. No noise." },
  { icon: AlertTriangle, title: "Never Miss a Storm-Damage Job Again", desc: "Be the first contractor on-site. Storm leads go to whoever calls first." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Us Your Area", desc: "Enter your zip codes and trade (roofing, HVAC, restoration, etc.) at signup." },
  { step: "02", title: "We Watch the Sky", desc: "NOAA alerts fire 24/7. The moment severe weather hits your territory, we catch it." },
  { step: "03", title: "You Get the Text", desc: "Within minutes of the storm, your phone buzzes. You call. You close." },
];

export default function StormDamageLeads() {
  const [form, setForm] = useState({
    email: "",
    business_name: "",
    phone: "",
    trade: "",
    zip_codes: "",
  });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-storm-lead-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set!</h1>
          <p className="text-muted-foreground leading-relaxed">Storm alerts are now active for your area. You'll get your first SMS the next time severe weather hits.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Storm Damage Leads — Real-Time Severe Weather SMS Alerts | $29/mo"
        description="NOAA-powered SMS alerts matched to your service area. Be the first contractor to know when hail, wind, or floods hit. $29/mo."
        path="/storm-damage-leads"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <CloudLightning size={11} /> Storm Lead Alerts
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Never Miss a<br /><span className="text-primary">Storm Lead Again</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Real-time severe weather SMS alerts matched to your service area. When hail, wind, or floods hit — you're the first contractor to know.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$29<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Set up in minutes · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Activate Storm Alerts <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-border p-5 rounded-sm">
                  <Icon size={20} className="text-primary mb-3" />
                  <p className="font-bold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
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

        {/* Sign-Up Form */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Activate Your Storm Alerts</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$29/mo — secure checkout via Stripe.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Smith Roofing Co."
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@business.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Cell Phone (for SMS alerts)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Trade</label>
                <select
                  value={form.trade}
                  onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Select your trade…</option>
                  <option value="Roofing">Roofing</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Tree Service">Tree Service</option>
                  <option value="Restoration">Restoration</option>
                  <option value="General Contractor">General Contractor</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Service Area Zip Codes (comma-separated)</label>
                <input
                  type="text"
                  value={form.zip_codes}
                  onChange={(e) => setForm((f) => ({ ...f, zip_codes: e.target.value }))}
                  placeholder="48230, 48236, 48224"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Activate Storm Alerts — $29/mo"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">Secure checkout via Stripe. Cancel anytime.</p>
            </form>
          </div>
        </section>

        <p className="text-[12px] text-muted-foreground text-center pb-10">
          Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </>
  );
}
