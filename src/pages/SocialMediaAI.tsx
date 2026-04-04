import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Zap, Clock, Megaphone, RefreshCw, Share2 } from "lucide-react";

const PLANS = [
  {
    key: "standard",
    name: "Standard",
    price: "$99",
    originalPrice: "$199",
    launchPrice: "$74.25",
    per: "/month",
    badge: "🚀 Launch Special — 25% off first 3 months",
    description: "Facebook + LinkedIn posting, 3x per week — fully automated.",
    includes: [
      "Facebook + LinkedIn",
      "3 AI-written posts per week",
      "Branded to your business voice",
      "No contracts, cancel anytime",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$149",
    originalPrice: "$299",
    launchPrice: "$111.75",
    per: "/month",
    badge: "🚀 Launch Special — 25% off first 3 months",
    description: "Everything + Instagram + Google Business Profile + TikTok, 5 posts/week.",
    includes: [
      "Everything in Standard",
      "Instagram + GBP + TikTok",
      "5 posts per week",
      "Monthly analytics report",
    ],
    featured: true,
  },
];

const PLATFORM_OPTIONS = ["Facebook", "Instagram", "LinkedIn", "Google Business Profile", "TikTok"];

const FEATURES = [
  { icon: Zap, label: "AI-written posts", sub: "Content generated fresh for your industry and voice" },
  { icon: Clock, label: "Consistent posting schedule", sub: "3–5 times per week, every week, without you lifting a finger" },
  { icon: Megaphone, label: "Brand voice trained on your business", sub: "Posts sound like you, not a generic robot" },
  { icon: RefreshCw, label: "No contracts", sub: "Cancel anytime — no questions asked" },
  { icon: Share2, label: "Direct publishing", sub: "No scheduling apps or dashboards needed" },
];

export default function SocialMediaAI() {
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [form, setForm] = useState({
    business_name: "",
    name: "",
    email: "",
    phone: "",
    business_type: "",
    city: "",
    state: "",
    brand_voice: "professional",
    content_focus: "",
    content_avoid: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to connect your social accounts and get your first posts scheduled.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-social-media-checkout", {
        body: { ...form, plan: selectedPlan, platforms },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPlan = PLANS.find(p => p.key === selectedPlan)!;

  return (
    <>
      <SEOHead
        title="AI Social Media Management — From $74.25/mo Launch Special | M2"
        description="Your business posts itself. AI writes and publishes to Facebook, Instagram, and LinkedIn — 3x a week. Launch special: 25% off first 3 months, from $74.25/mo."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M2 Social Media AI</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            Your business posts itself.
          </h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            AI writes and publishes to Facebook, Instagram, and LinkedIn — 3x a week, every week. Your brand stays active online while you focus on running your business.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5">
                <Icon size={20} className="text-primary mb-3" />
                <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                <p className="text-[12px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Plan cards */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Choose a plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {PLANS.map(plan => (
              <button
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={`text-left p-5 border-2 transition-all ${
                  selectedPlan === plan.key
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {plan.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded mb-2 inline-block">
                    {plan.badge}
                  </span>
                )}
                {plan.featured && !plan.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded mb-2 inline-block">
                    Most Popular
                  </span>
                )}
                <div className="flex items-end justify-between mb-2">
                  <p className="font-black text-foreground text-base">{plan.name}</p>
                  <div className="text-right">
                    {plan.originalPrice && (
                      <p className="text-xs text-muted-foreground line-through">{plan.originalPrice}{plan.per}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-through">{plan.price}{plan.per}</p>
                    <p className="text-xl font-black text-green-500">
                      {(plan as any).launchPrice}<span className="text-xs text-muted-foreground font-normal">{plan.per}</span>
                    </p>
                    <p className="text-[10px] text-green-400 font-medium">first 3 months</p>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground mb-3">{plan.description}</p>
                <div className="space-y-1.5">
                  {plan.includes.map(item => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-foreground">
                      <CheckCircle size={11} className="text-primary flex-shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Signup form */}
          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">
              Get Started — {currentPlan.price}/month
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                  <input
                    required
                    value={form.business_name}
                    onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                    placeholder="Smith Plumbing Co."
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="John Smith"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@business.com"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Type</label>
                  <input
                    value={form.business_type}
                    onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
                    placeholder="Plumber, Restaurant, Gym…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Detroit, Warren, Troy…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">State</label>
                  <input
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="MI"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Platform checkboxes */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 text-xs font-bold border transition-all ${
                        platforms.includes(p)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {platforms.includes(p) && <CheckCircle size={10} className="inline mr-1" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Preferences */}
              <div className="border-t border-border pt-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Brand Preferences (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Brand Voice</label>
                    <select value={form.brand_voice} onChange={e => setForm(f => ({...f, brand_voice: e.target.value}))}
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none">
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="casual">Casual</option>
                      <option value="authoritative">Authoritative</option>
                      <option value="bold">Bold & Edgy</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Content Focus</label>
                    <input value={form.content_focus} onChange={e => setForm(f => ({...f, content_focus: e.target.value}))} placeholder="e.g. Before/after, tips, testimonials"
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Topics to Avoid</label>
                    <input value={form.content_avoid} onChange={e => setForm(f => ({...f, content_avoid: e.target.value}))} placeholder="e.g. Politics, competitor names"
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>
              </div>

              {/* Plan selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Plan</label>
                <div className="flex gap-3">
                  {PLANS.map(plan => (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => setSelectedPlan(plan.key)}
                      className={`flex-1 py-2 text-xs font-bold border transition-all ${
                        selectedPlan === plan.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {plan.name} — {plan.price}/mo
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : `Start ${currentPlan.name} Plan →`}
              </button>
            </form>
          </div>

          {/* Founder credibility */}
          <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
            <img
              src="/images/matt-family-summer.jpg"
              alt="Matt Michels"
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">I'm Matt Michels — Grosse Pointe, MI.</span>{" "}
              I built this after clients kept asking me to manage their social media. Now AI does it — I just review the results.
            </p>
          </div>

          <p className="text-[12px] text-muted-foreground text-center">
            Questions? Email{" "}
            <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>{" "}
            or text{" "}
            <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
          </p>
        </div>
      </div>
    </>
  );
}
