import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function WebsitePlusFieldDesk() {
  const [params] = useSearchParams();
  const company = params.get("company") ?? "";
  const email = params.get("email") ?? "";
  const canceled = params.get("canceled") === "1";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Website + FieldDesk Bundle — $499 launches in 7 days | Detroit Web Agency";
  }, []);

  const bookHref = useMemo(() => {
    const q = new URLSearchParams({ source: "bundle-page" });
    if (company) q.set("company", company);
    if (email) q.set("email", email);
    return `/book-demo?${q.toString()}`;
  }, [company, email]);

  async function buyNow() {
    setErr(null); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-bundle-90day-checkout", {
        body: { email: email || undefined, company: company || undefined },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed. Text Matt at (313) 992-1219.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white font-sans">
      {/* Hero */}
      <section className="px-5 pt-12 pb-10 sm:px-8 sm:pt-20 sm:pb-16 max-w-5xl mx-auto">
        <div className="text-[#00d4ff] text-xs sm:text-sm font-bold tracking-[0.2em] uppercase">Detroit Web Agency · Bundle Offer</div>
        <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-[1.1]">
          $499 launches your <span className="text-[#00d4ff]">new website + FieldDesk</span> in 7 days.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl">
          Mobile-first website, dispatch dashboard, missed-call recovery, and visitor tracking — all set up by us, all live within a week. {company && <>Built for <strong className="text-white">{company}</strong>.</>}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button onClick={buyNow} disabled={loading} className="bg-[#00d4ff] hover:bg-[#00b8df] disabled:opacity-60 text-[#0a1628] font-bold text-base sm:text-lg px-6 py-4 rounded-lg transition">
            {loading ? "Loading checkout…" : "Lock in $499 now →"}
          </button>
          <Link to={bookHref} className="border border-[#1e3a5f] hover:border-[#00d4ff] text-white font-bold text-base sm:text-lg px-6 py-4 rounded-lg text-center transition">
            Book a 15-min demo first
          </Link>
        </div>
        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
        {canceled && <div className="mt-3 text-yellow-300 text-sm">Checkout canceled — no charge made. Try again or text (313) 992-1219.</div>}
      </section>

      {/* What's included */}
      <section className="px-5 sm:px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">What's in the box</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { t: "New website", d: "Mobile-first, SEO-baked, lead capture forms, your branding. Built in 7 days." },
            { t: "FieldDesk dashboard", d: "Jobs, customers, dispatch, history. One screen for the whole office." },
            { t: "Missed-Call Catch", d: "Auto-text every missed call within 30 seconds. Recovers ~40% of lost jobs." },
            { t: "SiteRadar visitor ID", d: "See which businesses visit your site — even when they don't fill out a form." },
            { t: "White-glove onboarding", d: "We do the setup. You approve. No DIY headaches." },
            { t: "Direct line to Matt", d: "Text or call (313) 992-1219 anytime — real human, not a ticket queue." },
          ].map((x) => (
            <div key={x.t} className="border border-[#1e3a5f] bg-[#0c1a2e] rounded-xl p-5">
              <div className="text-[#00d4ff] font-bold text-sm uppercase tracking-wider">{x.t}</div>
              <div className="mt-2 text-slate-200 text-[15px] leading-relaxed">{x.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-5 sm:px-8 py-12 max-w-3xl mx-auto">
        <div className="border-2 border-[#00d4ff] rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[#0c1a2e] to-[#0a1628]">
          <div className="text-[#00d4ff] text-xs font-bold uppercase tracking-[0.2em]">First 90 days</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl sm:text-6xl font-extrabold">$499</span>
            <span className="text-slate-400 text-base">one-time</span>
          </div>
          <p className="mt-4 text-slate-300">Everything above, fully set up. No setup fees, no contracts, no surprises.</p>
          <div className="mt-6 pt-6 border-t border-[#1e3a5f]">
            <div className="text-slate-400 text-xs uppercase tracking-wider font-bold">After 90 days</div>
            <ul className="mt-3 space-y-1.5 text-slate-200 text-[15px]">
              <li>• <strong>$199/mo</strong> FieldDesk</li>
              <li>• <strong>$99/mo</strong> Missed-Call Catch</li>
              <li>• <strong>$49/mo</strong> SiteRadar</li>
            </ul>
            <p className="mt-3 text-slate-400 text-sm">Cancel anything anytime. No penalties.</p>
          </div>
          <button onClick={buyNow} disabled={loading} className="mt-6 w-full bg-[#00d4ff] hover:bg-[#00b8df] disabled:opacity-60 text-[#0a1628] font-bold text-lg px-6 py-4 rounded-lg transition">
            {loading ? "Loading…" : "Lock in $499 now →"}
          </button>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-5 sm:px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">Why this beats the alternatives</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:text-base border-collapse">
            <thead>
              <tr className="border-b border-[#1e3a5f]">
                <th className="text-left py-3 pr-3 text-slate-400 font-semibold"></th>
                <th className="text-left py-3 px-3 text-slate-400 font-semibold">DIY (Wix/Squarespace)</th>
                <th className="text-left py-3 px-3 text-slate-400 font-semibold">Hire an agency</th>
                <th className="text-left py-3 px-3 text-[#00d4ff] font-bold">DWA Bundle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]">
              {[
                ["Time to live", "4–8 weeks", "8–16 weeks", "7 days"],
                ["Upfront cost", "$0–$300", "$5,000–$25,000", "$499"],
                ["Dispatch software", "Not included", "Extra $$$", "Included"],
                ["Missed-call recovery", "No", "Rarely", "Included"],
                ["Visitor tracking", "No", "Maybe", "Included"],
                ["You build it yourself", "Yes", "No", "No — we do it"],
              ].map(([k, a, b, c]) => (
                <tr key={k}>
                  <td className="py-3 pr-3 font-semibold">{k}</td>
                  <td className="py-3 px-3 text-slate-400">{a}</td>
                  <td className="py-3 px-3 text-slate-400">{b}</td>
                  <td className="py-3 px-3 text-white font-semibold">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 sm:px-8 py-12 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">Common questions</h2>
        <div className="space-y-4">
          {[
            { q: "How long does it actually take?", a: "7 business days from kickoff. We send you the site for approval on day 5, dispatch dashboard on day 6, and go live on day 7." },
            { q: "Can I cancel after 90 days?", a: "Yes. Month-to-month after the bundle. Cancel any product anytime — no early termination fees." },
            { q: "Who actually builds the site?", a: "Matt Michels and the DWA team — based in Grosse Pointe, MI. No outsourcing, no offshore agencies." },
            { q: "Will it integrate with my existing phone/CRM?", a: "Most likely yes. We support Twilio, RingCentral, HubSpot, Salesforce, Jobber, ServiceTitan, and more. Ask on the demo." },
            { q: "Are there contracts?", a: "No. The $499 is a one-time charge for setup. Monthly products are pay-as-you-go." },
          ].map((x) => (
            <details key={x.q} className="border border-[#1e3a5f] bg-[#0c1a2e] rounded-lg p-4 group">
              <summary className="font-bold text-white cursor-pointer list-none flex justify-between items-center">
                <span>{x.q}</span>
                <span className="text-[#00d4ff] group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="mt-3 text-slate-300 leading-relaxed">{x.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-5 sm:px-8 py-16 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold">Ready to launch in 7 days?</h2>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={buyNow} disabled={loading} className="bg-[#00d4ff] hover:bg-[#00b8df] disabled:opacity-60 text-[#0a1628] font-bold text-lg px-6 py-4 rounded-lg transition">
            {loading ? "Loading…" : "Lock in $499 now →"}
          </button>
          <Link to={bookHref} className="border border-[#1e3a5f] hover:border-[#00d4ff] text-white font-bold text-lg px-6 py-4 rounded-lg text-center transition">
            Book a demo first
          </Link>
        </div>
        <p className="mt-6 text-slate-400 text-sm">Questions? Text Matt: <a href="sms:+13139921219" className="text-[#00d4ff]">(313) 992-1219</a></p>
      </section>
    </div>
  );
}
