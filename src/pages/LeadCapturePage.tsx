import { useState } from "react";
import { useParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, CheckCircle, Loader2, Send, AlertCircle } from "lucide-react";

const TRADE_COPY: Record<string, { title: string; description: string; cta: string; checks: string[] }> = {
  roofing: {
    title: "Get a Free Roofing Estimate",
    description: "Describe your project and a local roofing contractor will reach out within the hour.",
    cta: "Request Roofing Estimate",
    checks: ["Licensed & insured", "Free estimates", "Local — not a national chain", "Storm damage specialists"],
  },
  hvac: {
    title: "HVAC Service & Repair",
    description: "AC not cooling? Furnace issues? Tell us what's happening and a local HVAC tech will call you back fast.",
    cta: "Request HVAC Service",
    checks: ["Same-day service available", "All makes & models", "Licensed & insured", "Free diagnostic quotes"],
  },
  plumbing: {
    title: "Get a Local Plumber Fast",
    description: "Leak? Clog? Hot water out? Tell us what's going on and a licensed plumber will reach out promptly.",
    cta: "Request Plumbing Help",
    checks: ["Emergency service available", "Licensed & insured", "Upfront pricing", "Drain, water heater, pipe specialists"],
  },
  electrical: {
    title: "Licensed Electrician — Your Area",
    description: "Panel upgrades, new circuits, outlet issues — describe your project and a local electrician will follow up.",
    cta: "Request Electrical Quote",
    checks: ["Licensed master electrician", "Free estimates", "Panel, wiring & EV chargers", "Code-compliant work"],
  },
  gutters: {
    title: "Gutter & Siding Estimates",
    description: "New gutters, repairs, or siding — get a local estimate from a contractor who knows your area.",
    cta: "Request Gutter/Siding Estimate",
    checks: ["Free measurements & estimates", "Installation & repair", "Licensed & insured", "Local — not a national chain"],
  },
};

function parseSlug(slug: string) {
  const parts = slug.split("-");
  const trade = parts[0] || "service";
  const city = parts.slice(1).join(" ").replace(/\b\w/g, c => c.toUpperCase());
  return { trade, city };
}

export default function LeadCapturePage() {
  const { slug = "roofing-detroit" } = useParams<{ slug: string }>();
  const { trade, city } = parseSlug(slug);
  const copy = TRADE_COPY[trade] || {
    title: `${trade.charAt(0).toUpperCase() + trade.slice(1)} Service — ${city}`,
    description: `Get connected with a local ${trade} professional in ${city}.`,
    cta: "Request a Quote",
    checks: ["Licensed & insured", "Free estimates", "Local contractor", "Fast response"],
  };

  const [form, setForm] = useState({ name: "", phone: "", email: "", project_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error("Name and phone are required"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("contractor-lead-capture", {
        body: { site_slug: slug, ...form },
      });
      if (error) throw error;
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Request received.</h1>
          <p className="text-muted-foreground leading-relaxed">A local {trade} contractor will reach out within the hour. Check your phone and email.</p>
          <a href="tel:+13138064952" className="mt-6 inline-flex items-center gap-2 text-primary font-bold text-sm">
            <Phone size={14} /> Call directly: (313) 806-4952
          </a>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-yellow-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Something went wrong.</h1>
          <p className="text-muted-foreground leading-relaxed mb-6">Our form had a hiccup. The fastest way to reach a local {trade} contractor is to call or text directly — we'll get you taken care of.</p>
          <a href="tel:+13138064952" className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 font-bold text-sm w-full mb-3">
            <Phone size={14} /> Call (313) 806-4952
          </a>
          <button onClick={() => setFailed(false)} className="text-sm text-muted-foreground underline">
            Try the form again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={`${copy.title} — ${city} | M² Lead Network`}
        description={copy.description}
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-lg mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">{city} — Local Service</p>
            <h1 className="text-2xl font-black text-foreground mb-3">{copy.title}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{copy.description}</p>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-2 gap-2 mb-8">
            {copy.checks.map((c) => (
              <div key={c} className="flex items-center gap-2 text-[12px] text-foreground">
                <CheckCircle size={13} className="text-primary flex-shrink-0" />
                {c}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">{copy.cta}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name *</label>
                <input
                  value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="John Smith" required
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone Number *</label>
                <input
                  type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  placeholder="(313) 555-0100" required
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
                <input
                  type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="you@email.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Project Type</label>
                <input
                  value={form.project_type} onChange={e => setForm(f => ({...f, project_type: e.target.value}))}
                  placeholder={trade === "roofing" ? "New roof, repair, inspection…" : trade === "hvac" ? "AC repair, furnace, new install…" : "Describe briefly"}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Additional Details</label>
                <textarea
                  value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))}
                  rows={3} placeholder="Any other details that will help the contractor prepare…"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full bg-primary text-primary-foreground py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Sending…" : copy.cta}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">By submitting you agree to be contacted by a local contractor. No spam.</p>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[12px] text-muted-foreground">Need to talk now?</p>
            <a href="tel:+13138064952" className="text-primary font-bold text-sm flex items-center justify-center gap-1.5 mt-1">
              <Phone size={13} /> (313) 806-4952
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
