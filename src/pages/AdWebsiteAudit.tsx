import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Globe, AlertTriangle, Star, Zap } from "lucide-react";
import { trackFbEvent } from "@/lib/fbpixel";

function firePixel(event: string, data?: Record<string, any>) {
  trackFbEvent(event, data);
}

const SAMPLE_EXCERPT = `WEBSITE AUDIT: detroitroofingpro.com

OVERALL SCORE: 61/100 — Needs Work

❌ CRITICAL ISSUES (fix these first):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• No SSL certificate on contact form page (kills conversions + Google ranking)
• Page load: 8.4 seconds on mobile (benchmark: under 3s)
• Missing meta descriptions on 7 of 9 pages
• No Google Business Profile link visible on homepage

⚠️ SEO GAPS:
• Target keyword "roofing contractor Detroit" not in H1 or title tag
• 0 blog posts in 14 months — competitors posting 2x/week
• Local schema markup missing — you won't show in map pack

✅ STRENGTHS:
• Strong review count (214 reviews, 4.7 avg)
• Clear phone number above the fold
• Mobile-responsive layout

TOP PRIORITY ACTION:
Fix mobile load speed first. A 1-second improvement = 7% more conversions.
Use image compression + remove 3 unused JavaScript plugins.`;

export default function AdWebsiteAudit() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [form, setForm] = useState({ email: "", business_name: "", business_url: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    firePixel("PageView");
  }, []);

  useEffect(() => {
    if (isSuccess) firePixel("Purchase", { value: 29, currency: "USD" });
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_url) {
      toast.error("Email and website URL are required.");
      return;
    }
    const url = form.business_url.startsWith("http") ? form.business_url : `https://${form.business_url}`;
    setSubmitting(true);
    try {
      const utm_campaign = searchParams.get("utm_campaign") || "";
      const utm_source = searchParams.get("utm_source") || "";
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: { product_type: "website_audit", email: form.email, business_name: form.business_name, business_url: url, utm_campaign, utm_source },
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
          <h1 className="text-2xl font-black text-white">Audit on the Way</h1>
          <p className="text-slate-300 text-sm">Your full website audit report will arrive within 2 minutes. Check spam if you don't see it.</p>
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
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Instant · AI-Powered · $9</span>
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            Is Your Website<br />Costing You Customers?
          </h1>
          <p className="text-slate-300 text-base">
            We audit your entire site in 60 seconds — SEO, speed, mobile, trust signals — and email you exactly what to fix.
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-2.5 mb-6">
          {[
            { icon: <AlertTriangle size={15} />, text: "Every SEO error that's hiding you from Google" },
            { icon: <Zap size={15} />, text: "Speed and mobile issues costing you conversions" },
            { icon: <Star size={15} />, text: "Prioritized fix list — biggest impact first" },
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
          <div className="relative">
            <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              required
              placeholder="yourwebsite.com"
              value={form.business_url}
              onChange={(e) => setForm({ ...form, business_url: e.target.value })}
              className="w-full rounded-lg pl-9 pr-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <input
            type="text"
            placeholder="Business name (optional)"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "#e8621a" }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            {submitting ? "Processing…" : "Get My Website Audit — $9"}
          </button>
          <p className="text-center text-xs text-slate-500">Secure checkout · Report in ~60 sec · No agency fees · One-time</p>
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
            <span className="text-xs text-slate-400 ml-1">Sample Audit Preview</span>
          </div>
          <pre className="px-4 py-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 280 }}>
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
