import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Shield, TrendingUp, MapPin, Bell, Users } from "lucide-react";

const FEATURES = [
  { icon: Bell, title: "Weekly AI-Summarized Crime Digest", desc: "Every Monday at 7am, a clean summary of crime activity in your area — no raw data to wade through, just the key takeaways." },
  { icon: MapPin, title: "Covers Your Specific Zip Code", desc: "Hyper-local coverage. You get data for your zip, not a broad regional report that buries the signal in noise." },
  { icon: TrendingUp, title: "Trends & Week-Over-Week Comparisons", desc: "Is crime up or down this week? Which incident types are increasing? The digest tells you what's changing and why it matters." },
  { icon: Shield, title: "Safety Tips & Recommendations", desc: "AI-generated action items tailored to the incident types reported — practical guidance your community can actually use." },
  { icon: Users, title: "Built for HOAs, Property Managers & Realtors", desc: "Forward it to residents, include it in listing packets, or use it in board meetings. Professional format, ready to share." },
];

const CLIENT_TYPES = ["Property Manager", "HOA Board", "Realtor", "Neighborhood Watch", "Other"];

export default function CrimeDigest() {
  const [form, setForm] = useState({ email: "", business_name: "", zip_code: "", city: "", client_type: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.zip_code || !form.city) {
      toast.error("Email, zip code, and city are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-crime-digest-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">Crime Digest Active!</h1>
        <p className="text-muted-foreground">
          Your first weekly report arrives next Monday at 7am. Stay informed, stay ahead.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Weekly Neighborhood Safety Reports — Crime Digest | $19/mo"
        description="AI-summarized crime reports for your area, delivered every Monday. Perfect for HOAs, property managers, and realtors. $19/mo."
        path="/crime-digest"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Crime Digest
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Weekly Neighborhood<br /><span className="text-primary">Safety Reports.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              AI-summarized crime reports for your area, delivered every Monday. Perfect for HOAs, property managers, and realtors who need to stay informed.
            </p>
            <div className="text-4xl font-black text-primary mb-1">
              $19<span className="text-xl text-muted-foreground font-normal">/mo</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8">Cancel anytime · First report next Monday</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Get Started <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What's in Every Report</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4 bg-card border border-border p-6">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="py-12 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-black mb-6 uppercase tracking-tight">Built For</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {["HOA Boards", "Property Managers", "Realtors", "Neighborhood Watch Groups", "Apartment Complexes", "Commercial Property Owners", "Community Associations"].map((t) => (
                <span key={t} className="text-xs bg-background border border-border px-3 py-1.5 rounded-full text-foreground font-medium">{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Sign Up Form */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Subscribe to Crime Digest</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$19/mo · Cancel anytime · First report next Monday at 7am</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Organization Name (optional)</label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                  placeholder="Lakeview HOA"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Zip Code *</label>
                <input
                  type="text"
                  value={form.zip_code}
                  onChange={e => setForm(p => ({ ...p, zip_code: e.target.value }))}
                  placeholder="48236"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City *</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="Grosse Pointe"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">I Am A</label>
                <select
                  value={form.client_type}
                  onChange={e => setForm(p => ({ ...p, client_type: e.target.value }))}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Select one…</option>
                  {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Subscribe — $19/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
