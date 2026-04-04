import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, Loader2, Search, MapPin, TrendingUp, Eye } from "lucide-react";
import { trackFbEvent } from "@/lib/fbpixel";

function firePixel(event: string, data?: Record<string, any>) {
  trackFbEvent(event, data);
}

const SAMPLE_EXCERPT = `COMPETITOR ANALYSIS: Apex Roofing — Detroit Metro

TOP COMPETITORS FOUND (14 scanned):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Metro Roof Pro ⭐ 4.8 (312 reviews)
   Gap: No financing mentioned. Opportunity: Offer 0% financing CTA.

2. Detroit Roofing Co ⭐ 4.6 (198 reviews)
   Gap: Slow review response time (avg 11 days). Opportunity: Same-day replies.

3. All-Star Roofing ⭐ 4.3 (87 reviews)
   Gap: No before/after gallery. Opportunity: Photo-first content strategy.

KEY OPPORTUNITIES:
• 9 of 14 competitors have no Spanish-language content
• Only 2 competitors post consistently to Google Business Profile
• Average response time to reviews: 8.4 days (beat this easily)

YOUR POSITIONING ADVANTAGE:
Position around speed + transparency. Competitors are slow and impersonal.
Lead with "We respond within 2 hours" messaging across all channels.`;

export default function AdCompetitorReport() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [form, setForm] = useState({ email: "", business_name: "", industry: "", city: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    firePixel("PageView");
  }, []);

  useEffect(() => {
    if (isSuccess) firePixel("Purchase", { value: 49, currency: "USD" });
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.industry || !form.city) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      const utm_campaign = searchParams.get("utm_campaign") || "";
      const utm_source = searchParams.get("utm_source") || "";
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: { product_type: "competitor_report", ...form, utm_campaign, utm_source },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Call/text Matt: (313) 806-4952");
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1e293b" }}>
        <div className="text-center space-y-4 p-8 max-w-sm">
          <CheckCircle size={52} className="mx-auto text-green-400" />
          <h1 className="text-2xl font-black text-white">Report on the Way</h1>
          <p className="text-slate-300 text-sm">Check your inbox — your competitor analysis will arrive within 2 minutes. Check spam if needed.</p>
          <p className="text-slate-500 text-xs">Questions? Text Matt: (313) 806-4952</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#1e293b", fontFamily: "system-ui, sans-serif" }}>
      {/* Above fold */}
      <div className="max-w-lg mx-auto px-5 pt-10 pb-6">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Detroit · Michigan · 50-Mile Radius</span>
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            What Are Your Competitors<br />Doing That You're Not?
          </h1>
          <p className="text-slate-300 text-base">
            Enter your business type and city. We scan your 14 closest competitors and email you a full breakdown in 2 minutes.
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-2.5 mb-6">
          {[
            { icon: <Eye size={15} />, text: "14 competitors scanned — reviews, gaps, and positioning" },
            { icon: <TrendingUp size={15} />, text: "Exact opportunities where you can take their customers" },
            { icon: <MapPin size={15} />, text: "Your local market only — no generic national noise" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-slate-200">
              <span className="text-orange-400 shrink-0">{icon}</span>
              {text}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Your email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="text"
            placeholder="Business name (optional)"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Industry (e.g. Roofing)"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="text"
              required
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "#e8621a" }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {submitting ? "Processing…" : "Get My Competitor Report — $9"}
          </button>
          <p className="text-center text-xs text-slate-500">Secure checkout · Delivered to your inbox in ~2 min · One-time fee</p>
        </form>
      </div>

      {/* Sample output */}
      <div className="max-w-lg mx-auto px-5 pb-12">
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="bg-white/5 px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
            </div>
            <span className="text-xs text-slate-400 ml-1">Sample Report Preview</span>
          </div>
          <pre className="px-4 py-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 260 }}>
            {SAMPLE_EXCERPT}
          </pre>
          <div className="bg-gradient-to-t from-slate-800 to-transparent h-8 -mt-8 relative pointer-events-none" />
        </div>
        <p className="text-center text-xs text-slate-600 mt-4">
          M2 Development · mattmichelstraining.com · (313) 806-4952
        </p>
      </div>
    </div>
  );
}
