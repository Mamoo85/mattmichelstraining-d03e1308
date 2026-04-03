import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, BarChart2, TrendingUp, DollarSign, Star, AlertTriangle, ChefHat } from "lucide-react";

const FEATURES = [
  {
    icon: BarChart2,
    title: "BCG Matrix Analysis",
    desc: "Every item on your menu gets classified: Stars (high margin, high volume — promote these), Plowhorses (high volume, low margin — reprice), Puzzles (high margin, low volume — better placement), Dogs (low margin, low volume — cut).",
  },
  {
    icon: DollarSign,
    title: "Revenue Leak Report",
    desc: "AI calculates exactly how much revenue you're leaving on the table each month from underpriced Stars, Dogs taking up menu real estate, and Plowhorses that should cost $3 more.",
  },
  {
    icon: TrendingUp,
    title: "Price Optimization Recommendations",
    desc: "Which items can absorb a $1-2 price increase without hurting volume? Which are overpriced for the perceived value? Specific recommendations backed by industry benchmark data.",
  },
  {
    icon: Star,
    title: "Menu Placement Strategy",
    desc: "The upper-right of a menu is prime real estate. AI tells you exactly which items belong where based on margin and volume — so the right items get ordered more often.",
  },
  {
    icon: ChefHat,
    title: "Industry Benchmark Comparisons",
    desc: "How does your food cost percentage compare to similar restaurants? Your average check size? Your item mix? Know where you stand vs. industry benchmarks — and what to do about gaps.",
  },
  {
    icon: AlertTriangle,
    title: "Monthly Report, Every Month",
    desc: "Sales data changes. Costs change. Seasonality shifts your mix. You get a fresh analysis every month — not a one-time audit that collects dust.",
  },
];

const COMPARISON = [
  { tool: "Menu Engineering Consultant", price: "$2,000–5,000/engagement", what: "One-time analysis, no ongoing monitoring, expensive, slow" },
  { tool: "Restaurant Consultant", price: "$150–300/hr", what: "Hourly billing — a full analysis costs thousands and takes weeks" },
  { tool: "Doing nothing", price: "$0 up front", what: "60% of US restaurants fail within 3 years. Most never analyze their menu." },
  { tool: "M² Menu Engineering", price: "$99/mo", what: "Monthly AI-powered BCG analysis + revenue leak report + pricing recommendations — 14-day trial", highlight: true },
];

const MATRIX_ITEMS = [
  { category: "Stars", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", desc: "High margin, high volume. Your best items. Feature them prominently. Never discount them." },
  { category: "Plowhorses", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", desc: "High volume, low margin. Customers love them but they're not making you money. Reprice or simplify." },
  { category: "Puzzles", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", desc: "High margin, low volume. Great items nobody orders. Fix placement, rename, or bundle them." },
  { category: "Dogs", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", desc: "Low margin, low volume. Taking up menu space and kitchen complexity. Cut them." },
];

export default function MenuEngineering() {
  const [form, setForm] = useState({ email: "", name: "", restaurantName: "", phone: "", cuisineType: "", locationCount: "1" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.restaurantName) {
      toast.error("Email and restaurant name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-menu-engineering-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Let's engineer your menu.</h1>
        <p className="text-muted-foreground">Matt will reach out within 24 hours to collect your menu and sales data. Your first BCG matrix analysis and revenue leak report will be ready within 5 business days.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Restaurant Menu Engineering — AI-Powered BCG Analysis + Revenue Optimization | $99/mo"
        description="Upload your menu and sales data. AI runs BCG matrix analysis and tells you which items to feature, reprice, and cut. Monthly reports. 14-day trial."
        path="/menu-engineering"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <ChefHat size={11} /> Menu Engineering
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Which Items on Your Menu<br />
              <span className="text-primary">Are Killing Your Margins?</span><br />
              We'll Tell You.
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              60% of US restaurants fail within 3 years. Most never run a single menu analysis. They just keep serving the same items at the same prices until the math stops working.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload your menu and monthly sales data. AI runs a full BCG matrix — identifies your Stars, Plowhorses, Puzzles, and Dogs — and tells you exactly what to reprice, reposition, and cut.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$99<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">14-day free trial · Monthly analysis · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start 14-Day Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* BCG Matrix explainer */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-3 uppercase tracking-tight">The BCG Matrix for Restaurants</h2>
            <p className="text-center text-muted-foreground text-sm mb-10">Every item on your menu falls into one of four categories. Most restaurants have no idea which is which.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {MATRIX_ITEMS.map((item) => (
                <div key={item.category} className={`p-5 border rounded-lg ${item.bg}`}>
                  <div className={`font-black text-lg mb-2 ${item.color}`}>{item.category}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What Others Charge</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">A one-time consultant analysis costs thousands. M² does it every month for $99.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-lg font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              We'll collect your menu and sales data after signup. First report ready within 5 business days.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "restaurantName", label: "Restaurant Name *", placeholder: "Tony's Trattoria" },
                { key: "name", label: "Your Name *", placeholder: "Tony Romano" },
                { key: "email", label: "Email *", placeholder: "tony@tonys.com", type: "email" },
                { key: "phone", label: "Phone *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "cuisineType", label: "Cuisine Type *", placeholder: "Italian, Mexican, American, etc." },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                  />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Number of Locations</label>
                <input
                  type="number"
                  min="1"
                  value={form.locationCount}
                  onChange={(e) => setForm((p) => ({ ...p, locationCount: e.target.value }))}
                  placeholder="1"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                {loading ? "Redirecting…" : "Analyze My Menu — $99/mo"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
