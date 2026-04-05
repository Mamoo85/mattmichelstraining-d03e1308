import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Monitor, Wifi, Shield, HardDrive, Download, Phone } from "lucide-react";

const FEATURES = [
  { icon: Monitor, title: "Remote Desktop Support", desc: "Matt connects securely to your computer and fixes the problem while you watch. No driving, no waiting." },
  { icon: Shield, title: "Virus & Malware Removal", desc: "Full scan and cleanup. Your computer running slow or acting weird? Probably something that shouldn't be there." },
  { icon: Monitor, title: "Slow Computer Diagnosis", desc: "Matt identifies exactly what's bogging your machine down and fixes it — startup programs, bloatware, hardware issues." },
  { icon: Wifi, title: "WiFi & Network Troubleshooting", desc: "Can't connect? Drops keep happening? Dead spots in the house? Matt diagnoses and walks you through the fix." },
  { icon: Download, title: "Software Installation & Setup", desc: "New printer, new program, new device — Matt gets it installed, configured, and working properly." },
  { icon: HardDrive, title: "Data Backup Guidance", desc: "Matt shows you exactly how to back up what matters so you never lose photos, documents, or files again." },
];

const TIERS = [
  {
    id: "one_time",
    label: "One-Time Session",
    price: "$49",
    period: "",
    desc: "Single remote support session. Matt contacts you within 24 hours to schedule.",
    cta: "Book a Session",
  },
  {
    id: "monthly",
    label: "Monthly Plan",
    price: "$29",
    period: "/mo",
    desc: "Priority scheduling, monthly system checkup, unlimited email support.",
    cta: "Start Monthly Plan",
    featured: true,
  },
];

export default function TechSupportServices() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", issue_description: "", tier: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleTierClick = (tierId: string) => {
    setForm(p => ({ ...p, tier: tierId }));
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.tier) {
      toast.error("Name, email, and a selected plan are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tech-support-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Got it!</h1>
        <p className="text-muted-foreground">
          Matt will reach out within 24 hours to schedule your session. If it's urgent, call{" "}
          <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Local Tech Support — Grosse Pointe's Local Tech Guy | $49 / $29mo"
        description="Remote computer support from a real person in Grosse Pointe. Virus removal, slow computer fixes, WiFi troubleshooting, and more. Matt responds within 24 hours."
        path="/tech-support"
      />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Monitor size={11} /> Tech Support
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Grosse Pointe's<br /><span className="text-primary">Local Tech Guy.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Computer problems? Matt's got you. Remote support for when technology isn't cooperating — from a real person, not a call center.
            </p>
            <a
              href="tel:+13138064952"
              className="inline-flex items-center gap-2 text-primary font-black text-2xl mb-8 hover:opacity-80"
            >
              <Phone size={20} /> (313) 806-4952
            </a>
            <p className="text-sm text-muted-foreground">Or pick a plan below — Matt responds within 24 hours.</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">Choose Your Plan</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`bg-card border p-8 flex flex-col ${tier.featured ? "border-primary" : "border-border"}`}
                >
                  {tier.featured && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Most Popular</div>
                  )}
                  <p className="font-black text-lg mb-1">{tier.label}</p>
                  <div className="text-4xl font-black text-primary mb-1">
                    {tier.price}<span className="text-lg text-muted-foreground font-normal">{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">{tier.desc}</p>
                  <button
                    onClick={() => handleTierClick(tier.id)}
                    className={`w-full py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-2 ${
                      tier.featured ? "bg-primary text-white" : "border border-primary text-primary bg-transparent"
                    }`}
                  >
                    {tier.cta} <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What Matt Fixes</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4 p-4">
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

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Book Your Session</h2>
            <p className="text-center text-muted-foreground text-sm mb-2">
              {form.tier === "monthly" ? "Monthly Plan — $29/mo" : form.tier === "one_time" ? "One-Time Session — $49" : "Select a plan above, then fill this out."}
            </p>
            <p className="text-center text-sm font-bold text-primary mb-8">
              Urgent? Call Matt directly: <a href="tel:+13138064952" className="underline">(313) 806-4952</a>
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {form.tier && (
                <div className="bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary font-medium flex items-center justify-between">
                  <span>Plan: {TIERS.find(t => t.id === form.tier)?.label}</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, tier: "" }))} className="text-xs underline opacity-70">Change</button>
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Describe the Issue</label>
                <textarea
                  value={form.issue_description}
                  onChange={e => setForm(p => ({ ...p, issue_description: e.target.value }))}
                  placeholder="My computer is running super slow and keeps freezing…"
                  rows={3}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>
              <input type="hidden" value={form.tier} />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Book Now"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
