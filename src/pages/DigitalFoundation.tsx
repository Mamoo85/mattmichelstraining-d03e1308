import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe,
  Phone,
  MessageSquare,
  MapPin,
  CheckCircle,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";

const INCLUDED = [
  {
    icon: Globe,
    title: "Custom Website",
    desc: "Mobile-first, fast-loading site built for your trade. Not a template — built around YOUR business.",
  },
  {
    icon: MapPin,
    title: "Google Auto-Posts",
    desc: "Automated system writes and publishes to your Google Business Profile 3x/week. You show up more in local search — automatically.",
  },
  {
    icon: MessageSquare,
    title: "Missed Call Text-Back",
    desc: "Miss a call? The caller gets an instant text: \"Sorry I missed you, I'll call right back.\" Never lose a lead again.",
  },
  {
    icon: Shield,
    title: "Hosting & Maintenance",
    desc: "SSL, security updates, uptime monitoring, and unlimited edits. Your site stays fast and fresh.",
  },
];

const RESULTS = [
  { stat: "78%", label: "of customers call the first business that responds" },
  { stat: "3x", label: "more leads from weekly Google Business posts" },
  { stat: "62%", label: "of contractor calls go unanswered" },
];

export default function DigitalFoundation() {
  const [params] = useSearchParams();
  const success = params.get("success") === "1";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    website: "",
  });
  const [plan, setPlan] = useState<"standard" | "starter">("standard");
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <>
        <SEOHead
          title="Welcome to Detroit Web Agency"
          description="Your Digital Foundation is being built."
          path="/digital-foundation"
        />
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0a0a0f" }}>
          <div className="max-w-md text-center">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <h1 className="text-3xl font-black mb-3" style={{ color: "#f8fafc" }}>You're In!</h1>
            <p className="mb-6" style={{ color: "#94a3b8" }}>
              Matt will reach out within a few hours to start building your site.
              Your 7-day free trial has started — you won't be charged until day 8.
            </p>
            <a
              href="tel:+13138064952"
              className="inline-flex items-center gap-2 font-bold"
              style={{ color: "#22d3ee" }}
            >
              <Phone size={16} /> (313) 806-4952
            </a>
          </div>
        </div>
      </>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) {
      toast.error("Email and business name are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-foundation-checkout",
        { body: { ...form, plan } }
      );
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong. Call (313) 806-4952");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Digital Foundation — Website + Google Posts + Missed Call Text-Back | Detroit Web Agency"
        description="Stop losing customers to missed calls and an outdated website. Custom site, automatic Google posts, and instant text-back for missed calls. One package, one price."
        path="/digital-foundation"
      />

      <div className="min-h-screen" style={{ background: "#0a0a0f", color: "#e2e8f0" }}>
        {/* Hero */}
        <section className="relative pt-20 pb-20 px-4 overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0a0f 100%)" }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase mb-6" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}>
              <TrendingUp size={11} /> Everything You Need to Win Local
            </div>

            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5" style={{ color: "#f8fafc" }}>
              Stop Losing Customers to{" "}
              <span style={{ color: "#22d3ee" }}>Missed Calls</span> and an{" "}
              <span style={{ color: "#22d3ee" }}>Outdated Website</span>
            </h1>

            <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8" style={{ color: "#94a3b8" }}>
              A custom website, automatic Google posts 3x/week, and instant
              text-back for every missed call. One package. One monthly price.
              Zero manual work.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="#get-started"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all duration-300"
                style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
              >
                Get Started — 7 Days Free <ArrowRight size={16} />
              </a>
              <a
                href="tel:+13138064952"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition hover:bg-white/5"
                style={{ border: "1px solid rgba(148,163,184,0.25)", color: "#e2e8f0" }}
              >
                <Phone size={14} /> (313) 806-4952
              </a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-4 py-12" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {RESULTS.map((r) => (
              <div key={r.stat}>
                <p className="text-3xl font-black" style={{ color: "#22d3ee" }}>{r.stat}</p>
                <p className="text-sm mt-1" style={{ color: "#64748b" }}>{r.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What's Included */}
        <section className="px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-4" style={{ color: "#f1f5f9" }}>
              Everything in One Package
            </h2>
            <p className="text-center max-w-xl mx-auto mb-12" style={{ color: "#64748b" }}>
              No piecing together 5 different tools. No managing vendors. One
              setup, and it runs itself.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {INCLUDED.map((item) => (
                <Card
                  key={item.title}
                  className="border-0"
                  style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}
                >
                  <CardContent className="p-6">
                    <item.icon
                      className="mb-3"
                      size={28}
                      style={{ color: "#22d3ee" }}
                    />
                    <h3 className="font-bold text-lg mb-2" style={{ color: "#e2e8f0" }}>{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="px-4 py-16" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-black mb-6" style={{ color: "#f1f5f9" }}>Built by a Local Engineer</h2>
            <div className="flex items-center justify-center gap-4 mb-6">
              <img
                src="/images/matt-boat.jpg"
                alt="Matt Michels"
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="font-bold" style={{ color: "#e2e8f0" }}>Matt Michels</p>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Grosse Pointe, MI — 10+ years in B2B sales
                </p>
              </div>
            </div>
            <p className="max-w-lg mx-auto" style={{ color: "#94a3b8" }}>
              I build websites and automation systems for contractors and local
              service businesses. No call centers, no overseas teams. Just me,
              building your digital foundation and making sure it works.
            </p>
          </div>
        </section>

        {/* Pricing + Form */}
        <section id="get-started" className="px-4 py-20">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-4" style={{ color: "#f1f5f9" }}>
              Pick Your Plan
            </h2>
            <p className="text-center mb-10" style={{ color: "#64748b" }}>
              7-day free trial on both. Cancel anytime.
            </p>

            {/* Plan Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <button
                onClick={() => setPlan("standard")}
                className="p-5 rounded-xl text-left transition"
                style={{
                  border: plan === "standard" ? "2px solid #22d3ee" : "2px solid rgba(148,163,184,0.1)",
                  background: plan === "standard" ? "rgba(34,211,238,0.05)" : "transparent",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#22d3ee" }}>
                  Most Popular
                </p>
                <p className="text-xl font-black" style={{ color: "#f1f5f9" }}>$1,500 setup + $99/mo</p>
                <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                  Lower monthly — best for established businesses
                </p>
              </button>

              <button
                onClick={() => setPlan("starter")}
                className="p-5 rounded-xl text-left transition"
                style={{
                  border: plan === "starter" ? "2px solid #22d3ee" : "2px solid rgba(148,163,184,0.1)",
                  background: plan === "starter" ? "rgba(34,211,238,0.05)" : "transparent",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>
                  Lower Upfront
                </p>
                <p className="text-xl font-black" style={{ color: "#f1f5f9" }}>$499 setup + $149/mo</p>
                <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                  Lower barrier — best for new businesses
                </p>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-slate-300">Your Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Matt Michels"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-slate-300">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@business.com"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName" className="text-slate-300">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    required
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Stewart Orthopedics"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-slate-300">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(313) 555-1234"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website" className="text-slate-300">Current Website (if any)</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="www.mybusiness.com"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-6 text-lg font-bold border-0"
                style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
              >
                {submitting ? (
                  <Clock className="animate-spin mr-2" size={18} />
                ) : null}
                {submitting
                  ? "Setting up..."
                  : `Start 7-Day Free Trial — ${plan === "starter" ? "$499 + $149/mo" : "$1,500 + $99/mo"}`}
              </Button>

              <p className="text-xs text-center" style={{ color: "#64748b" }}>
                7-day free trial. Cancel anytime. Setup fee billed separately.
                <br />
                Questions? Call{" "}
                <a
                  href="tel:+13138064952"
                  className="font-medium"
                  style={{ color: "#22d3ee" }}
                >
                  (313) 806-4952
                </a>
              </p>
            </form>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="px-4 py-16 text-center" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
          <h2 className="text-2xl font-black mb-3" style={{ color: "#f1f5f9" }}>
            Ready to Stop Losing Leads?
          </h2>
          <p className="mb-6 max-w-lg mx-auto" style={{ color: "#94a3b8" }}>
            Every missed call is a customer calling your competitor instead.
            Let's fix that this week.
          </p>
          <a
            href="tel:+13138064952"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
          >
            <Phone size={16} /> Call Matt — (313) 806-4952
          </a>
        </section>
      </div>
    </>
  );
}
