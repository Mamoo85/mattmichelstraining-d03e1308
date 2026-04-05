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
    desc: "AI writes and publishes to your Google Business Profile 3x/week. You show up more in local search — automatically.",
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
          title="Welcome to M² Development"
          description="Your Digital Foundation is being built."
          path="/digital-foundation"
        />
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <h1 className="text-3xl font-black mb-3">You're In!</h1>
            <p className="text-muted-foreground mb-6">
              Matt will reach out within a few hours to start building your site.
              Your 7-day free trial has started — you won't be charged until day 8.
            </p>
            <a
              href="tel:+13138064952"
              className="inline-flex items-center gap-2 text-[#e8621a] font-bold"
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
        title="Digital Foundation — Website + Google Posts + Missed Call Text-Back | M² Development"
        description="Stop losing customers to missed calls and an outdated website. Custom site, automatic Google posts, and instant text-back for missed calls. One package, one price."
        path="/digital-foundation"
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="relative pt-20 pb-20 px-4 bg-[#1e293b] text-white overflow-hidden">
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8621a]/20 text-[#e8621a] text-[11px] font-bold tracking-widest uppercase mb-6">
              <TrendingUp size={11} /> Everything You Need to Win Local
            </div>

            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Stop Losing Customers to{" "}
              <span className="text-[#e8621a]">Missed Calls</span> and an{" "}
              <span className="text-[#e8621a]">Outdated Website</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              A custom website, automatic Google posts 3x/week, and instant
              text-back for every missed call. One package. One monthly price.
              Zero manual work.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="#get-started"
                className="inline-flex items-center justify-center gap-2 bg-[#e8621a] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#d4570f] transition"
              >
                Get Started — 7 Days Free <ArrowRight size={16} />
              </a>
              <a
                href="tel:+13138064952"
                className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition"
              >
                <Phone size={14} /> (313) 806-4952
              </a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-4 py-12 bg-[#f8fafc] dark:bg-card/30 border-b border-border/40">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {RESULTS.map((r) => (
              <div key={r.stat}>
                <p className="text-3xl font-black text-[#e8621a]">{r.stat}</p>
                <p className="text-sm text-muted-foreground mt-1">{r.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What's Included */}
        <section className="px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-4">
              Everything in One Package
            </h2>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12">
              No piecing together 5 different tools. No managing vendors. One
              setup, and it runs itself.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {INCLUDED.map((item) => (
                <Card
                  key={item.title}
                  className="border-border/40 bg-card/60"
                >
                  <CardContent className="p-6">
                    <item.icon
                      className="text-[#e8621a] mb-3"
                      size={28}
                    />
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="px-4 py-16 bg-[#f8fafc] dark:bg-card/30 border-y border-border/40">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-black mb-6">Built by a Local Guy</h2>
            <div className="flex items-center justify-center gap-4 mb-6">
              <img
                src="/images/matt-boat.jpg"
                alt="Matt Michels"
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="font-bold">Matt Michels</p>
                <p className="text-sm text-muted-foreground">
                  Grosse Pointe, MI — 10+ years in B2B sales
                </p>
              </div>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              I build websites and automation tools for contractors and local
              service businesses. No call centers, no overseas teams. Just me,
              building your digital foundation and making sure it works.
            </p>
          </div>
        </section>

        {/* Pricing + Form */}
        <section id="get-started" className="px-4 py-20">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-4">
              Pick Your Plan
            </h2>
            <p className="text-muted-foreground text-center mb-10">
              7-day free trial on both. Cancel anytime.
            </p>

            {/* Plan Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <button
                onClick={() => setPlan("standard")}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  plan === "standard"
                    ? "border-[#e8621a] bg-[#e8621a]/5"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#e8621a] mb-1">
                  Most Popular
                </p>
                <p className="text-xl font-black">$1,500 setup + $99/mo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lower monthly — best for established businesses
                </p>
              </button>

              <button
                onClick={() => setPlan("starter")}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  plan === "starter"
                    ? "border-[#e8621a] bg-[#e8621a]/5"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Lower Upfront
                </p>
                <p className="text-xl font-black">$499 setup + $149/mo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lower barrier — best for new businesses
                </p>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Matt Michels"
                  />
                </div>
                <div>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="you@business.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    required
                    value={form.businessName}
                    onChange={(e) =>
                      setForm({ ...form, businessName: e.target.value })
                    }
                    placeholder="Stewart Orthopedics"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="(313) 555-1234"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Current Website (if any)</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  placeholder="www.mybusiness.com"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#e8621a] hover:bg-[#d4570f] text-white py-6 text-lg font-bold"
              >
                {submitting ? (
                  <Clock className="animate-spin mr-2" size={18} />
                ) : null}
                {submitting
                  ? "Setting up..."
                  : `Start 7-Day Free Trial — ${plan === "starter" ? "$499 + $149/mo" : "$1,500 + $99/mo"}`}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                7-day free trial. Cancel anytime. Setup fee billed separately.
                <br />
                Questions? Call{" "}
                <a
                  href="tel:+13138064952"
                  className="text-[#e8621a] font-medium"
                >
                  (313) 806-4952
                </a>
              </p>
            </form>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="px-4 py-16 bg-[#1e293b] text-white text-center">
          <h2 className="text-2xl font-black mb-3">
            Ready to Stop Losing Leads?
          </h2>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">
            Every missed call is a customer calling your competitor instead.
            Let's fix that this week.
          </p>
          <a
            href="tel:+13138064952"
            className="inline-flex items-center gap-2 bg-[#e8621a] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#d4570f] transition"
          >
            <Phone size={16} /> Call Matt — (313) 806-4952
          </a>
        </section>
      </div>
    </>
  );
}
