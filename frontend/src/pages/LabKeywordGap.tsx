import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, TrendingUp, Target, Search, BarChart2 } from "lucide-react";

export default function LabKeywordGap() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [form, setForm] = useState({ customer_email: "", your_domain: "", competitor_domain: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.your_domain || !form.competitor_domain) {
      toast.error("All three fields are required."); return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-keyword-gap-checkout", {
        body: { customer_email: form.customer_email, your_domain: form.your_domain, competitor_domain: form.competitor_domain },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Text Matt: (313) 992-1219");
    } finally { setSubmitting(false); }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <div className="text-center space-y-4 p-8 max-w-sm">
          <CheckCircle size={52} className="mx-auto text-cyan-400" />
          <h1 className="text-2xl font-black text-white">Report Incoming</h1>
          <p className="text-slate-300 text-sm">Your keyword gap report will arrive within 2 minutes. Check spam if you don't see it.</p>
          <p className="text-slate-500 text-xs">Questions? Text Matt: (313) 992-1219</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a1628", fontFamily: "system-ui, sans-serif" }}>
      <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
        <div className="text-center mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff44" }}>
            Instant · $19 One-Time · No Subscription
          </span>
          <h1 className="text-3xl font-black text-white leading-tight mb-4">
            Your Competitor Ranks for<br />Keywords You Don't
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Enter your domain and a competitor's. We pull real keyword rankings from DataForSEO and show you exactly where they're winning — search volume, difficulty score, and AI-prioritized action items.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {[
            { icon: <Search size={15} />, text: "Every keyword they rank top-30 for that you don't" },
            { icon: <BarChart2 size={15} />, text: "Monthly search volume for each gap keyword" },
            { icon: <Target size={15} />, text: "Keyword difficulty score — what you can realistically win" },
            { icon: <TrendingUp size={15} />, text: "AI analysis of your top 5 fastest-opportunity keywords" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="shrink-0" style={{ color: "#00d4ff" }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 mb-6 text-center" style={{ background: "#00d4ff08", border: "1px solid #00d4ff22" }}>
          <p className="text-xs text-slate-400 mb-1">The alternative?</p>
          <p className="text-sm text-white"><strong style={{ color: "#00d4ff" }}>SEMrush = $129/mo</strong> · <strong style={{ color: "#00d4ff" }}>Ahrefs = $99/mo</strong></p>
          <p className="text-xs text-slate-500 mt-1">We give you a one-time snapshot for $19.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" required placeholder="Your domain (e.g. yourbusiness.com)"
            value={form.your_domain} onChange={e => setForm({ ...form, your_domain: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <input type="text" required placeholder="Competitor's domain (e.g. theircompany.com)"
            value={form.competitor_domain} onChange={e => setForm({ ...form, competitor_domain: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <input type="email" required placeholder="Your email (report delivered here)"
            value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "#00d4ff" }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            {submitting ? "Processing…" : "Get Keyword Gap Report — $19"}
          </button>
          <p className="text-center text-xs text-slate-500">Secure checkout · Report in ~2 min · One-time payment</p>
        </form>
      </div>

      <div className="max-w-lg mx-auto px-5 pb-12">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4ff88" }}>Sample Output</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-500 ml-2">Keyword Gap: yourbusiness.com vs competitor.com</span>
          </div>
          <div className="p-5" style={{ background: "#060c18" }}>
            <div className="p-3 rounded-lg mb-4" style={{ background: "#00d4ff15", border: "1px solid #00d4ff30" }}>
              <span className="text-xs" style={{ color: "#67e8f9" }}>🔍 <strong>47 keyword gaps found</strong> · competitor.com is winning search traffic you're not getting</span>
            </div>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1526" }}>
                  <th className="text-left p-2 text-slate-400">Keyword</th>
                  <th className="text-center p-2 text-slate-400">Volume/mo</th>
                  <th className="text-center p-2 text-slate-400">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { kw: "emergency hvac repair near me", vol: "2.4k", diff: 28, dc: "#22c55e" },
                  { kw: "furnace replacement cost michigan", vol: "880", diff: 34, dc: "#eab308" },
                  { kw: "best hvac company detroit", vol: "590", diff: 41, dc: "#eab308" },
                  { kw: "ac tune up grosse pointe", vol: "210", diff: 18, dc: "#22c55e" },
                ].map(row => (
                  <tr key={row.kw} style={{ borderBottom: "1px solid #1e2d4a" }}>
                    <td className="p-2 text-slate-300">{row.kw}</td>
                    <td className="p-2 text-center font-bold text-green-400">{row.vol}</td>
                    <td className="p-2 text-center font-bold" style={{ color: row.dc }}>{row.diff}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="text-center pb-8">
        <p className="text-xs text-slate-600">Detroit Web Agency · (313) 992-1219 · matt@detroitwebagent.com</p>
      </div>
    </div>
  );
}
