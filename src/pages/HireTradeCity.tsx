import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

type Target = {
  trade: string;
  city: string;
  state: string;
  active: boolean;
};

// URL-slug helpers (single source of truth so internal links match the route shape)
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bHvac\b/g, "HVAC").replace(/\bAc\b/g, "AC");

// Trade-specific copy. Easy to expand without redeploying the route.
const TRADE_COPY: Record<string, { plural: string; jobAvg: number; pains: string[] }> = {
  "roofer": {
    plural: "roofers",
    jobAvg: 12000,
    pains: ["storm damage", "hail repair", "leak detection", "full replacement"],
  },
  "hvac-contractor": {
    plural: "HVAC contractors",
    jobAvg: 5500,
    pains: ["AC not cooling", "furnace replacement", "no heat", "duct issues"],
  },
  "plumber": {
    plural: "plumbers",
    jobAvg: 1800,
    pains: ["water heater replacement", "burst pipe", "drain backup", "sewer line"],
  },
  "electrician": {
    plural: "electricians",
    jobAvg: 2200,
    pains: ["panel upgrade", "rewiring", "outage", "EV charger install"],
  },
};

export default function HireTradeCity() {
  const { trade: tradeSlug = "", city: citySlug = "" } = useParams<{ trade: string; city: string }>();
  const [target, setTarget] = useState<Target | null>(null);
  const [siblings, setSiblings] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 1) Find the row by slug-matching trade + city (case-insensitive on city, fuzzy on trade).
      const { data, error } = await supabase
        .from("prospector_targets")
        .select("trade, city, state, active");
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const match = data.find(
        (r: Target) => toSlug(r.trade).replace("-contractor", "") === tradeSlug.replace("-contractor", "")
          && toSlug(r.city) === citySlug,
      );
      if (!match) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTarget(match);
      // 2) Sibling pages: other cities with the same trade in the same state.
      const sibs = data.filter(
        (r: Target) => toSlug(r.trade) === toSlug(match.trade) && r.state === match.state && toSlug(r.city) !== toSlug(match.city),
      ).slice(0, 8);
      setSiblings(sibs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tradeSlug, citySlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !target) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col items-center justify-center px-6 text-center">
        <SEOHead title="Page not found" description="That market isn't live yet." noindex />
        <h1 className="text-2xl font-black mb-3">That market isn't live yet.</h1>
        <p className="text-white/50 text-sm mb-6">We cover dozens of trade × city combos. Check our coverage map or call (313) 992-1219.</p>
        <Link to="/" className="text-[#00d4ff] underline">Back home</Link>
      </div>
    );
  }

  const tradeNice = titleCase(target.trade); // e.g. "HVAC Contractor"
  const cityNice = titleCase(target.city);
  const stateNice = target.state;
  const copy = TRADE_COPY[toSlug(target.trade).replace("-contractor", "")] || TRADE_COPY[toSlug(target.trade)] || {
    plural: `${target.trade}s`,
    jobAvg: 3000,
    pains: ["repair", "installation", "service"],
  };

  const pageTitle = `Hire ${tradeNice}s in ${cityNice}, ${stateNice} — Vetted Crews`;
  const pageDesc = `Looking to hire a ${tradeNice.toLowerCase()} in ${cityNice}, ${stateNice}? Get matched with vetted, licensed local crews — most respond within 1 hour.`;

  // JSON-LD Service schema for organic SERP enrichment.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": tradeNice,
    "provider": {
      "@type": "LocalBusiness",
      "name": "Detroit Web Agency",
      "telephone": "+1-313-992-1219",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Grosse Pointe",
        "addressRegion": "MI",
        "addressCountry": "US",
      },
    },
    "areaServed": {
      "@type": "City",
      "name": `${cityNice}, ${stateNice}`,
    },
    "description": pageDesc,
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEOHead
        title={pageTitle}
        description={pageDesc}
        path={`/hire-${tradeSlug}-in-${citySlug}`}
        jsonLd={jsonLd}
      />

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-black text-lg tracking-tight">
          <span className="text-white">DETROIT</span>{" "}
          <span className="text-[#00d4ff]">WEB AGENCY</span>
        </Link>
        <a href="tel:+13139921219" className="text-sm text-white/60 hover:text-white">
          📞 (313) 992-1219
        </a>
      </nav>

      {/* Hero — single H1 */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-4 py-1.5 text-[#00d4ff] text-xs font-bold uppercase tracking-widest mb-6">
          {cityNice}, {stateNice}
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Hire a Vetted{" "}
          <span className="text-[#00d4ff]">{tradeNice}</span>
          <br />
          in {cityNice}, {stateNice}
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
          Most {copy.plural} in {cityNice} are booked solid. We connect you with vetted, licensed local crews who actually answer the phone — most respond within an hour.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="tel:+13139921219"
            className="inline-block bg-[#00d4ff] text-[#0a0f1a] font-bold text-base px-6 py-3 rounded-xl hover:bg-[#00d4ff]/90 transition-colors"
          >
            📞 Call (313) 992-1219
          </a>
          <Link
            to="/contractor-marketplace"
            className="inline-block bg-white/10 hover:bg-white/15 text-white font-semibold text-base px-6 py-3 rounded-xl border border-white/20 transition-colors"
          >
            Browse Live Leads
          </Link>
        </div>
      </section>

      {/* Common services */}
      <section className="bg-white/5 border-y border-white/10 py-10">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-6">
            Common {tradeNice} Jobs in {cityNice}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {copy.pains.map((p) => (
              <div key={p} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-white text-sm font-semibold capitalize">{p}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/40 text-xs mt-6">
            Average job value in {stateNice}: <strong className="text-white">${copy.jobAvg.toLocaleString()}</strong>
          </p>
        </div>
      </section>

      {/* Why us */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black text-center mb-8">Why homeowners in {cityNice} call us first</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { t: "Vetted & licensed", d: `Every ${target.trade} we recommend is licensed in ${stateNice} and has been background-checked.` },
            { t: "1-hour response", d: "Most calls returned in under 60 minutes — even on weekends." },
            { t: "No upfront fees", d: "You don't pay to be matched. The contractor pays us only if you hire them." },
          ].map((s) => (
            <div key={s.t} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-bold text-white mb-2">{s.t}</h3>
              <p className="text-white/50 text-sm">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Internal linking — neighboring cities for the same trade. SEO juice. */}
      {siblings.length > 0 && (
        <section className="bg-white/5 border-y border-white/10 py-10">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-6">
              Other {stateNice} cities we serve
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {siblings.map((s) => (
                <Link
                  key={`${s.trade}-${s.city}`}
                  to={`/hire-${toSlug(s.trade).replace("-contractor", "")}-in-${toSlug(s.city)}`}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00d4ff]/40 text-white/70 hover:text-white text-sm px-4 py-2 rounded-full transition-colors"
                >
                  {tradeNice} in {titleCase(s.city)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-black mb-3">Need a {tradeNice.toLowerCase()} today?</h2>
        <p className="text-white/50 text-sm mb-6">
          Call now and we'll connect you with a vetted {target.trade} in {cityNice} within the hour.
        </p>
        <a
          href="tel:+13139921219"
          className="inline-block bg-[#00d4ff] text-[#0a0f1a] font-bold text-lg px-8 py-4 rounded-xl hover:bg-[#00d4ff]/90 transition-colors"
        >
          📞 (313) 992-1219
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-white/30 text-xs">
        <p>Detroit Web Agency · Grosse Pointe, MI · {target.active ? "Live" : "Coming soon"} in {cityNice}, {stateNice}</p>
      </footer>
    </div>
  );
}
