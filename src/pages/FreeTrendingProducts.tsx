import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, Zap, BarChart3, ArrowRight, CheckCircle, Loader2, Star } from "lucide-react";

const SAMPLE_PRODUCTS = [
  { rank: 1, name: "Portable Blender Pro", category: "Kitchen", trend: "+340%", margin: "$18.50", score: 94 },
  { rank: 2, name: "LED Sunset Lamp", category: "Home Decor", trend: "+280%", margin: "$14.20", score: 91 },
  { rank: 3, name: "Magnetic Phone Mount", category: "Auto", trend: "+210%", margin: "$11.80", score: 88 },
  { rank: 4, name: "Scalp Massager 2.0", category: "Beauty", trend: "+195%", margin: "$9.40", score: 85 },
  { rank: 5, name: "█████████████", category: "███████", trend: "+███%", margin: "$██.██", score: "??" },
  { rank: 6, name: "█████████████", category: "███████", trend: "+███%", margin: "$██.██", score: "??" },
];

export default function FreeTrendingProducts() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Enter your email"); return; }
    setSubmitting(true);
    try {
      await supabase.from("marketing_leads").upsert({
        email,
        first_name: name || null,
        source: "free_trending_products",
        service_interested: "trending_product_finder",
      }, { onConflict: "email" });

      await supabase.from("newsletter_subscribers").upsert({
        email,
        source: "free_trending_products",
      }, { onConflict: "email" });

      await supabase.functions.invoke("deliver-sample-report", {
        body: { email, name, report_type: "trending_products" },
      });

      setSubmitted(true);
      toast.success("Check your inbox!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Free AI Trending Product Report — Top Sellers This Week"
        description="Get a free AI-powered trending product report with profit margins, trend velocity, and sourcing data. Updated weekly. No credit card required."
        path="/free-trending-products"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "AI Trending Product Finder — Free Sample",
          description: "Weekly AI-curated report of trending products with profit margins and sourcing data.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-3 rounded-xl">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Free Sample Report</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            See What's Trending<br />Before Everyone Else
          </h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Our AI scans thousands of products weekly to find <strong className="text-white">breakout sellers</strong> with high margins.
            Get the top 4 free — unlock all 20+ with a subscription.
          </p>
        </div>

        {/* Sample Report Preview */}
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> This Week's Sample Report
          </h2>
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="bg-primary/10 px-4 py-2 flex text-xs font-bold text-muted-foreground">
              <span className="w-8">#</span>
              <span className="flex-1">Product</span>
              <span className="w-20 text-center">Trend</span>
              <span className="w-20 text-center">Margin</span>
              <span className="w-16 text-center">Score</span>
            </div>
            {SAMPLE_PRODUCTS.map((p) => (
              <div key={p.rank} className={`px-4 py-3 flex items-center text-sm border-t border-border ${p.rank > 4 ? "opacity-40 blur-[2px] select-none" : ""}`}>
                <span className="w-8 font-black text-primary">{p.rank}</span>
                <div className="flex-1">
                  <p className="font-bold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <span className="w-20 text-center text-emerald-400 font-bold text-xs">{p.trend}</span>
                <span className="w-20 text-center font-semibold text-foreground text-xs">{p.margin}</span>
                <span className="w-16 text-center">
                  {typeof p.score === "number" ? (
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{p.score}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">🔒</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Full report includes 20+ products with sourcing links, competition analysis, and ad copy suggestions.
          </p>
        </div>

        {/* Email Capture */}
        <div className="bg-muted/30 px-6 py-12" id="signup">
          <div className="max-w-md mx-auto text-center">
            {submitted ? (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-black text-foreground">Check Your Inbox!</h3>
                <p className="text-muted-foreground text-sm">Your free trending product report is on its way. Want the full 20+ product report every week?</p>
                <a href="/get-started?service=trending_products" className="inline-block bg-primary text-white px-6 py-3 font-bold text-sm rounded-lg hover:opacity-90">
                  Unlock Full Reports — $29/mo →
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-black text-foreground mb-2">Get Your Free Report</h3>
                <p className="text-muted-foreground text-sm mb-6">No credit card. No spam. Just data.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="bg-card" />
                  <Input placeholder="Your email *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card" />
                  <Button type="submit" disabled={submitting} className="w-full font-bold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Send My Free Report
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Social Proof */}
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <h3 className="text-lg font-black text-foreground text-center">Why Sellers Trust This Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Zap className="w-5 h-5" />, title: "AI-Powered", desc: "Scans 10,000+ products across Amazon, TikTok Shop, and trending platforms." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Profit-First", desc: "Every product includes estimated margins, not just hype." },
              { icon: <Star className="w-5 h-5" />, title: "Weekly Fresh", desc: "New report every Monday. Never sell yesterday's trends." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-primary mb-2 flex justify-center">{f.icon}</div>
                <p className="font-bold text-sm text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div className="bg-[#1e293b] text-white px-6 py-10 text-center">
          <p className="text-sm text-slate-400 mb-2">Ready for the full report?</p>
          <a href="/get-started?service=trending_products" className="inline-block bg-primary text-white px-8 py-3 font-bold rounded-lg hover:opacity-90 transition-all">
            Unlock All 20+ Products — $29/mo
          </a>
          <p className="text-xs text-slate-500 mt-3">Cancel anytime. No contracts.</p>
        </div>
      </div>
    </>
  );
}
