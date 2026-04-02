import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, Calendar, MessageSquare, Zap } from "lucide-react";
import { trackFbEvent } from "@/lib/fbpixel";

function firePixel(event: string, data?: Record<string, any>) {
  trackFbEvent(event, data);
}

const SAMPLE_POSTS = `30 GOOGLE BUSINESS PROFILE POSTS
Business: Metro HVAC · Detroit, MI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POST #1 — What's New
"Summer's here and so is the heat. 🌡️ Our team is booking AC tune-ups now — before the rush hits. A 30-minute checkup could save you from a $2,400 emergency repair this July. Book online or call us today."

POST #2 — Offer
"JUNE SPECIAL: $79 AC Tune-Up (reg. $129)
✅ Full system inspection
✅ Filter check + replacement
✅ Refrigerant level check
Limited slots — first come, first served."

POST #3 — Tips
"3 signs your AC is about to fail:
1. Warm air even on 'cool' setting
2. Unusual grinding or clicking sounds
3. Spike in your electric bill
Don't wait for it to quit on you at 11pm. Call Metro HVAC before summer gets serious."

POST #4 — Behind the Scenes
"Meet Tony — 14 years installing HVAC systems across Metro Detroit. When he's not on a job, he's teaching our apprentices the trade. Family-run, locally owned. That's the Metro difference."

[Posts 5–30 continue in full report...]`;

export default function AdGbpPosts() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [form, setForm] = useState({ email: "", business_name: "", business_type: "", city: "", differentiators: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    firePixel("PageView");
  }, []);

  useEffect(() => {
    if (isSuccess) firePixel("Purchase", { value: 19, currency: "USD" });
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_type || !form.city) {
      toast.error("Email, business type, and city are required.");
      return;
    }
    setSubmitting(true);
    try {
      const utm_campaign = searchParams.get("utm_campaign") || "";
      const utm_source = searchParams.get("utm_source") || "";
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: {
          product_type: "gbp_post_pack",
          email: form.email,
          business_name: form.business_name,
          industry: form.business_type,
          city: form.city,
          business_info: form.differentiators,
          utm_campaign,
          utm_source,
        },
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
          <h1 className="text-2xl font-black text-white">Posts on the Way</h1>
          <p className="text-slate-300 text-sm">Your 30 Google Business Profile posts will arrive within 2 minutes. Check spam if needed.</p>
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
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">3 Months of Content · Done in 2 Min · $19</span>
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            Your Google Profile<br />Is a Ghost Town.
          </h1>
          <p className="text-slate-300 text-base">
            Get 30 done-for-you posts written specifically for your business — ready to copy-paste into Google Business Profile.
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-2.5 mb-6">
          {[
            { icon: <Calendar size={15} />, text: "3 months of posts (30 total) written for your specific business" },
            { icon: <MessageSquare size={15} />, text: "Promotions, tips, behind-the-scenes, and seasonal content" },
            { icon: <Zap size={15} />, text: "Ready to post — no editing needed, just copy-paste" },
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
              placeholder="Business type (e.g. HVAC)"
              value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-lg pl-8 pr-3 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="What makes you different? (optional)"
            value={form.differentiators}
            onChange={(e) => setForm({ ...form, differentiators: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "#e8621a" }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            {submitting ? "Processing…" : "Get My 30 Posts — $19"}
          </button>
          <p className="text-center text-xs text-slate-500">Secure checkout · Delivered in ~2 min · One-time fee · No subscription</p>
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
            <span className="text-xs text-slate-400 ml-1">Sample Posts Preview</span>
          </div>
          <pre className="px-4 py-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap overflow-hidden" style={{ maxHeight: 280 }}>
            {SAMPLE_POSTS}
          </pre>
          <div className="bg-gradient-to-t from-slate-800 to-transparent h-8 -mt-8 relative pointer-events-none" />
        </div>
        <p className="text-center text-xs text-slate-600 mt-4">
          M² Performance Training · mattmichelstraining.com · (313) 806-4952
        </p>
      </div>
    </div>
  );
}
