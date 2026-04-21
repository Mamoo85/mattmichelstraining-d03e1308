import { useParams, Navigate, Link } from "react-router-dom";
import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";

const TRADE_LABELS: Record<string, string> = {
  hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical", roofing: "Roofing",
  electrician: "Electrician", electricians: "Electrical",
};

function titleize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ContractorQuoteLanding() {
  const { trade: rawTrade, city: rawCity } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", description: "" });

  if (!rawTrade || !rawCity) return <Navigate to="/" replace />;

  const tradeKey = rawTrade.toLowerCase();
  const trade = TRADE_LABELS[tradeKey] || titleize(rawTrade);
  const city = titleize(rawCity);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone) {
      setError("Name and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await (supabase as any).from("contractor_leads").insert({
        homeowner_name: form.name,
        homeowner_phone: form.phone,
        homeowner_email: form.email || null,
        project_description: form.description || `${trade} request from ${city}`,
        trade,
        city,
        state: "MI",
        source: "google_search_ad",
        status: "new",
      });
      if (insertErr) throw insertErr;
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Submission failed. Call (313) 992-1219.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead
        title={`${trade} in ${city} — Free Quote | Detroit Web Agency Lead Network`}
        description={`Get a fast, free quote from a vetted local ${trade.toLowerCase()} contractor in ${city}, MI. Same-day response.`}
      />
      <div className="max-w-xl mx-auto px-4 py-10">
        <header className="mb-6">
          <Link to="/" className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold">Detroit Lead Network</Link>
          <h1 className="text-3xl sm:text-4xl font-black mt-2 leading-tight">
            {trade} in {city}? <span className="text-[#00d4ff]">Get a Free Quote</span>
          </h1>
          <p className="text-white/70 mt-3">Vetted local {trade.toLowerCase()} contractor. Same-day response. No obligation.</p>
        </header>

        {done ? (
          <div className="rounded-xl bg-[#0d1f3c] border border-[#00d4ff]/30 p-6">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold">Got it. A {trade.toLowerCase()} pro will call you shortly.</h2>
            <p className="text-white/60 text-sm mt-2">Most calls happen within 5 minutes. Questions? (313) 992-1219.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl bg-[#0d1f3c] border border-white/10 p-5 space-y-3">
            <input
              required placeholder="Your name"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              required type="tel" placeholder="Phone number"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              type="email" placeholder="Email (optional)"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <textarea
              rows={3} placeholder="Brief description (optional)"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit" disabled={submitting}
              className="w-full bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-[#0a1628] font-bold py-4 rounded-lg disabled:opacity-50"
            >
              {submitting ? "Sending…" : `Get My Free ${trade} Quote`}
            </button>
            <p className="text-white/40 text-xs text-center">By submitting, you agree to be contacted by SMS/phone about your project. Reply STOP to opt out.</p>
          </form>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="bg-[#0d1f3c]/60 rounded-lg p-3"><div className="text-[#00d4ff] text-xl font-black">5min</div><div className="text-white/50 text-xs mt-1">Avg response</div></div>
          <div className="bg-[#0d1f3c]/60 rounded-lg p-3"><div className="text-[#00d4ff] text-xl font-black">Vetted</div><div className="text-white/50 text-xs mt-1">Local pros</div></div>
          <div className="bg-[#0d1f3c]/60 rounded-lg p-3"><div className="text-[#00d4ff] text-xl font-black">Free</div><div className="text-white/50 text-xs mt-1">No obligation</div></div>
        </div>
      </div>
    </div>
  );
}
