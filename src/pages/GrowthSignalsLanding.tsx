import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, MapPin, TrendingUp, ShieldCheck } from "lucide-react";

/**
 * Channel 4 — Google Ads landing page
 * Bidded keywords: "detroit manufacturing leads", "michigan industrial sales prospects"
 * Goal: low-friction free dossier capture → upsell to $50 / $199.
 */
export default function GrowthSignalsLanding() {
  return (
    <>
      <Helmet>
        <title>42 Metro Detroit Manufacturers Hiring This Week | Free Sample Dossier</title>
        <meta
          name="description"
          content="Names, addresses, predicted spend. Real Metro Detroit manufacturers about to buy. $50 per dossier or $199/mo. Free sample."
        />
      </Helmet>

      <div className="min-h-screen bg-[#0a1628] text-white">
        {/* Hero */}
        <section className="container mx-auto px-4 pt-16 pb-10 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm mb-6">
              <TrendingUp className="w-4 h-4" /> Updated weekly
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="text-cyan-400">42 Metro Detroit Manufacturers</span>
              <br />
              Hiring This Week
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Names. Addresses. Predicted equipment spend. Built for industrial supply houses,
              distributors, and B2B sales reps who sell into Metro Detroit manufacturing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/get-dossier">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-[#0a1628] font-bold text-lg px-8 py-6">
                  Get a free sample dossier <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/industrial-pulse">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6">
                  See pricing
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-sm text-gray-500">No credit card required for the sample.</p>
          </div>

          {/* 3 anonymized example cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { trade: "Welding contractor", city: "Macomb County", count: 8, role: "TIG welders" },
              { trade: "HVAC fabricator", city: "Warren", count: 12, role: "sheet-metal techs" },
              { trade: "Industrial electrical", city: "Sterling Heights", count: 5, role: "journeymen" },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 relative">
                <div className="absolute top-3 right-3 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sample
                </div>
                <Building2 className="w-5 h-5 text-cyan-400 mb-2" />
                <div className="font-semibold blur-sm select-none">▓▓▓▓▓▓▓▓▓▓ Inc.</div>
                <div className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" /> {s.city}
                </div>
                <div className="mt-3 text-sm">
                  <span className="text-cyan-300 font-semibold">{s.count}</span> {s.role} posted this week
                </div>
                <div className="mt-1 text-xs text-gray-500">{s.trade}</div>
              </div>
            ))}
          </div>

          {/* Why */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
            <h2 className="text-2xl font-bold mb-4">Why supply houses use this</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <span>Hiring = consumables order coming. We surface companies <em>before</em> the PO is cut.</span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <span>Sourced from public Michigan data: MIOSHA, BSEED permits, SAM.gov contracts. No scraped LinkedIn.</span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <span>Pay per dossier ($50 each, 5-pack) or get the firehose ($199/mo, all signals).</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-3">Try one for free</h3>
            <p className="text-gray-300 mb-6">
              Drop your work email. We'll send you one fully-unredacted dossier in under a minute.
            </p>
            <Link to="/get-dossier">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-[#0a1628] font-bold text-lg px-10 py-6">
                Get my free dossier <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
