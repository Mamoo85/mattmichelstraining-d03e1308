import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Home, MapPin, ArrowRight, CheckCircle, Loader2, TrendingUp, BarChart3, Shield } from "lucide-react";

const SAMPLE_MARKETS = [
  { market: "Austin, TX", median: "$485,000", change: "+4.2%", inventory: "Low", hotness: 95 },
  { market: "Nashville, TN", median: "$420,000", change: "+3.8%", inventory: "Medium", hotness: 91 },
  { market: "Boise, ID", median: "$395,000", change: "-1.2%", inventory: "High", hotness: 72 },
  { market: "█████████", median: "$███,███", change: "+█.█%", inventory: "███", hotness: "??" },
  { market: "█████████", median: "$███,███", change: "+█.█%", inventory: "███", hotness: "??" },
];

export default function FreeRealEstateDigest() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
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
        industry: "real_estate",
        source: "free_real_estate_digest",
        service_interested: "real_estate_digest",
        utm_source: market || null,
      }, { onConflict: "email" });

      await supabase.from("newsletter_subscribers").upsert({
        email,
        source: "free_real_estate_digest",
      }, { onConflict: "email" });

      await supabase.functions.invoke("deliver-sample-report", {
        body: { email, name, report_type: "real_estate_digest", market },
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
        title="Free AI Real Estate Market Report — Housing Trends & Price Data"
        description="Get a free AI-powered real estate market digest with pricing trends, inventory data, and investment scoring. Updated weekly for any US market."
        path="/free-real-estate-digest"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "AI Real Estate Market Digest — Free Sample",
          description: "Weekly AI-curated real estate market report with pricing trends and investment scores.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-3 rounded-xl">
              <Home className="w-8 h-8 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Free Sample Report</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            Know Your Market<br />Before You Invest
          </h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            AI-analyzed <strong className="text-white">market trends, pricing data, and investment scores</strong> for any US metro.
            See 3 markets free — get your custom digest weekly for $39/mo.
          </p>
        </div>

        {/* Sample Preview */}
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Sample Market Snapshot
          </h2>
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="bg-primary/10 px-4 py-2 flex text-xs font-bold text-muted-foreground">
              <span className="flex-1">Market</span>
              <span className="w-24 text-center">Median Price</span>
              <span className="w-16 text-center">YoY</span>
              <span className="w-20 text-center">Inventory</span>
              <span className="w-16 text-center">Score</span>
            </div>
            {SAMPLE_MARKETS.map((m, i) => (
              <div key={i} className={`px-4 py-3 flex items-center text-sm border-t border-border ${i >= 3 ? "opacity-40 blur-[2px] select-none" : ""}`}>
                <div className="flex-1">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary" />{m.market}
                  </p>
                </div>
                <span className="w-24 text-center font-semibold text-foreground text-xs">{m.median}</span>
                <span className={`w-16 text-center font-bold text-xs ${m.change.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                <span className="w-20 text-center text-xs text-muted-foreground">{m.inventory}</span>
                <span className="w-16 text-center">
                  {typeof m.hotness === "number" ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.hotness >= 90 ? "bg-red-500/20 text-red-400" : m.hotness >= 80 ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                      {m.hotness}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">🔒</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Full digest includes 15+ markets with rental yield data, days-on-market trends, and AI investment recommendations.
          </p>
        </div>

        {/* Email Capture */}
        <div className="bg-muted/30 px-6 py-12" id="signup">
          <div className="max-w-md mx-auto text-center">
            {submitted ? (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-black text-foreground">Check Your Inbox!</h3>
                <p className="text-muted-foreground text-sm">Your free market snapshot is on its way. Want full weekly digests?</p>
                <a href="/get-started?service=real_estate_digest" className="inline-block bg-primary text-white px-6 py-3 font-bold text-sm rounded-lg hover:opacity-90">
                  Unlock Full Digest — $39/mo →
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-black text-foreground mb-2">Get Your Free Market Report</h3>
                <p className="text-muted-foreground text-sm mb-6">Tell us which market and we'll send a sample digest.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="bg-card" />
                  <Input placeholder="Your email *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card" />
                  <Input placeholder="Target market (e.g., Austin TX, Miami FL)" value={market} onChange={(e) => setMarket(e.target.value)} className="bg-card" />
                  <Button type="submit" disabled={submitting} className="w-full font-bold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Send My Free Report
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Trust Signals */}
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <h3 className="text-lg font-black text-foreground text-center">Data-Driven Real Estate Intelligence</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp className="w-5 h-5" />, title: "Trend Analysis", desc: "AI tracks pricing, inventory, and days-on-market across 200+ US metros." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Investment Scoring", desc: "Each market gets a 0-100 hotness score based on 12+ data signals." },
              { icon: <Shield className="w-5 h-5" />, title: "No Spam", desc: "Just your weekly digest. Unsubscribe anytime." },
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
          <p className="text-sm text-slate-400 mb-2">Stop guessing. Start knowing.</p>
          <a href="/get-started?service=real_estate_digest" className="inline-block bg-primary text-white px-8 py-3 font-bold rounded-lg hover:opacity-90 transition-all">
            Get Full Weekly Digest — $39/mo
          </a>
          <p className="text-xs text-slate-500 mt-3">Cancel anytime. No contracts.</p>
        </div>
      </div>
    </>
  );
}
