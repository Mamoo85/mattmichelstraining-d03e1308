import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Clock, Send, Users, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Complete Obituary in Under 2 Hours",
    desc: "Family fills out a simple intake form with names, dates, stories, and wishes. AI writes a full, polished obituary — typically 400-600 words — in under 2 hours. No phone tag.",
  },
  {
    icon: Send,
    title: "Three Formats, One Submission",
    desc: "Every obituary is delivered formatted for newspaper column-inch submission, your funeral home website, and a social media post. One intake, three ready-to-publish outputs.",
  },
  {
    icon: CheckCircle,
    title: "Family Review via Email",
    desc: "A review link goes to the family automatically. They click to approve, or leave revision notes. Changes come back to you finalized — no back-and-forth calls.",
  },
  {
    icon: Users,
    title: "Scales From 5 to 50+ Per Month",
    desc: "Whether you handle 5 services a month or 50, the price never changes. Unlimited obituaries are included. Your staff handles ceremonies, not writing.",
  },
  {
    icon: Clock,
    title: "Faster Than Any In-House Process",
    desc: "Your team currently spends 3-4 hours per obituary gathering information, writing, and revising. That time goes back to the families who need you most.",
  },
  {
    icon: Zap,
    title: "Consistent, Professional Quality",
    desc: "Every obituary follows your funeral home's tone and style. AI never has a bad day, never misses a detail from the intake form, and never calls in sick.",
  },
];

const COMPARISON = [
  { tool: "Freelance obituary writers", price: "$150–400 each", what: "Per-obituary cost, 24-48hr turnaround, inconsistent quality" },
  { tool: "In-house staff writing", price: "3-4 hrs per obit", what: "Staff time that should go to families and logistics" },
  { tool: "Writing services (online)", price: "$200+ per obit", what: "Generic templates, no funeral-specific expertise" },
  { tool: "M2 Obituary Service", price: "$199/mo unlimited", what: "AI-written in <2 hours, 3 formats, family review built in", highlight: true },
];

export default function ObituaryService() {
  const [form, setForm] = useState({ email: "", name: "", funeralHomeName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.funeralHomeName) {
      toast.error("Email and funeral home name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-obituary-service-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will reach out within 24 hours to complete setup. Your first intake form goes live within 48 hours — then every obituary runs on autopilot.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? Call or text{" "}
          <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="AI Obituary Writing for Funeral Homes — $199/mo Unlimited | M2 Training"
        description="Professional obituaries written by AI in under 2 hours. Formatted for newspaper, website, and social. Family review built in. $199/mo for unlimited obituaries."
        path="/obituary-service"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileText size={11} /> Obituary Service
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Your Staff Shouldn't Be<br />
              <span className="text-primary">Writing Obituaries.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Every hour your team spends writing is an hour they're not present with grieving families.
              AI writes complete, publish-ready obituaries in under 2 hours — formatted for print, web, and social — so your staff can focus on what only humans can do.
            </p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">
                $199<span className="text-xl text-muted-foreground font-normal">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited obituaries · 14-day free trial · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Pain Bridge */}
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              The average funeral home handles{" "}
              <span className="text-foreground font-bold">120+ services per year.</span>{" "}
              At 3-4 hours per obituary, that's{" "}
              <span className="text-foreground font-bold">400+ hours of staff time</span>{" "}
              that could be redirected to families — or just given back to your team.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
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

        {/* Comparison */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">The Real Cost of Alternatives</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">If you do 20 obituaries per month, a per-obituary service costs $3,000–$8,000. We're $199.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    c.highlight ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {c.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              No charge today. Matt sets up your intake form within 48 hours. Cancel anytime.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "funeralHomeName", label: "Funeral Home Name *", placeholder: "Michels Family Funeral Home" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Email Address *", placeholder: "john@yourfuneralhome.com", type: "email" },
                { key: "phone", label: "Phone Number *", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $199/mo After"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial. No card charged today.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
