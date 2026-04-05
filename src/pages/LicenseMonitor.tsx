import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Bell, ShieldCheck, FileText, Clock, AlertTriangle } from "lucide-react";

const FEATURES = [
  { icon: Bell, title: "Automated Multi-Stage Reminders", desc: "Alerts at 90, 60, 30, 14, and 7 days before expiry. You'll never be caught off guard by a renewal deadline again." },
  { icon: FileText, title: "AI-Generated Renewal Guidance", desc: "Each reminder includes step-by-step instructions for renewing that specific license type — no more hunting for the right agency website." },
  { icon: ShieldCheck, title: "Covers All License Types", desc: "Business licenses, contractor licenses, professional certifications, trade licenses — if it has an expiry date, we track it." },
  { icon: AlertTriangle, title: "Never Pay a Late Renewal Fee", desc: "Late fees and lapsed licenses cost businesses thousands. One missed reminder pays for years of this service." },
  { icon: Clock, title: "Add Once, Track Forever", desc: "Enter your licenses after signup and we handle the rest. No dashboards to log into, no calendars to maintain." },
];

export default function LicenseMonitor() {
  const [form, setForm] = useState({ email: "", business_name: "", state: "MI", license_types: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Email and business name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-license-monitor-checkout", {
        body: {
          email: form.email,
          business_name: form.business_name,
          state: form.state,
          license_types: form.license_types.split(",").map(s => s.trim()).filter(Boolean),
        },
      });
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
        <h1 className="text-2xl font-black text-foreground mb-3">License Monitor Active!</h1>
        <p className="text-muted-foreground">
          After checkout, reply to your welcome email with your license details (name, number, expiry date) and we'll set up your reminder schedule.
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
        title="License Monitor — Never Miss a License Renewal Again | $25/mo"
        description="Automated reminders at 90, 60, 30, 14, and 7 days before your business licenses expire. Add your licenses once — we handle the rest. $25/mo."
        path="/license-monitor"
      />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <ShieldCheck size={11} /> License Monitor
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Never Miss a<br /><span className="text-primary">License Renewal Again.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Automated reminders at 90, 60, 30, 14, and 7 days before your business licenses expire. Add your licenses once — we handle the rest.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$25<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Cancel anytime · Setup in 5 minutes</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Start Tracking <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
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

        <section className="py-12 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-black mb-6 uppercase tracking-tight">Works For Every License Type</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {["General Contractor", "Plumbing", "Electrical", "HVAC", "Business License", "Real Estate", "CPA / Accounting", "Insurance Agent", "Cosmetology", "Roofing", "Landscaping", "Food Service"].map((t) => (
                <span key={t} className="text-xs bg-background border border-border px-3 py-1.5 rounded-full text-foreground font-medium">{t}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Tracking Your Licenses</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$25/mo · Cancel anytime · Peace of mind guaranteed</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@yourbusiness.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                  placeholder="Michigan Comfort HVAC"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                  placeholder="MI"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">License Types (comma-separated)</label>
                <input
                  type="text"
                  value={form.license_types}
                  onChange={e => setForm(p => ({ ...p, license_types: e.target.value }))}
                  placeholder="General contractor, Plumbing, Electrical, Business license"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">After checkout, reply to your welcome email with your license numbers and expiry dates to complete setup.</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Tracking — $25/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
