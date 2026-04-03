import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Home, MapPin, TrendingUp, Clock } from "lucide-react";

const WHY_IT_WORKS = [
  { icon: Home, title: "New Homeowners Spend Big", desc: "The average new homeowner spends $10,000–$15,000 in the first year on services: HVAC, landscaping, pest control, cleaning, renovations." },
  { icon: MapPin, title: "Hyper-Local Targeting", desc: "We pull recent property sales data in your zip codes. Every postcard-style text goes to someone who just moved nearby — no wasted reach." },
  { icon: Clock, title: "First Impression Wins", desc: "New homeowners haven't picked their service providers yet. Reach them in the first 30 days and you're their guy for the next 10 years." },
  { icon: TrendingUp, title: "Monthly Drip", desc: "Every month, new movers in your area get a welcome text from your business. Fully automated, always fresh." },
];

export default function NewHomeownerCampaign() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "", serviceArea: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-homeowner-campaign-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">14-Day Trial Started!</h1>
        <p className="text-muted-foreground">Matt will set up your new homeowner campaign within 24–48 hours. Every month, new movers in your area receive a text introducing your business — fully automated.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="New Homeowner Campaign — Text New Movers in Your Area | $79/mo" description="Automatically reach new homeowners in your service area within 30 days of their move. They need your services — reach them first. $79/mo." path="/new-homeowner-campaign" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Home size={11} /> New Homeowner Campaign
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Reach New Homeowners<br /><span className="text-primary">Before Anyone Else.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Every month, new families move into your service area. They need a plumber, a landscaper, an HVAC tech, a cleaner. They haven't picked anyone yet. We get your name in front of them first — automatically.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$59<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">14-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">One new homeowner as a lifetime customer = 10+ years of recurring service</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 14-Day Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">Why New Homeowners?</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {WHY_IT_WORKS.map((f) => (
                <div key={f.title} className="flex gap-4 bg-card border border-border p-6">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><f.icon size={16} className="text-primary" /></div>
                  <div><p className="font-bold text-sm mb-1">{f.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-black mb-6 uppercase tracking-tight">Best For</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {["HVAC", "Plumbing", "Landscaping", "Pest Control", "House Cleaning", "Painting", "Security", "Gutters", "Fencing", "Pool Service", "Internet / Cable", "Moving"].map((t) => (
                <span key={t} className="text-xs bg-background border border-border px-3 py-1.5 rounded-full text-foreground font-medium">{t}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">14 days free. $59/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Michigan Comfort HVAC" },
                { key: "businessType", label: "Business Type", placeholder: "HVAC Service & Repair" },
                { key: "name", label: "Your Name", placeholder: "Tom Nowak" },
                { key: "email", label: "Email *", placeholder: "tom@micomforthvac.com", type: "email" },
                { key: "phone", label: "Your Phone", placeholder: "(313) 555-0100", type: "tel" },
                { key: "serviceArea", label: "Service Area (zip codes or cities)", placeholder: "48236, 48230, Grosse Pointe area" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $59/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
