import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SIGNAL_LABELS: Record<string, string> = {
  fsbo: "FSBO Listing",
  divorce_filing: "Divorce Filing",
  estate_sale: "Estate Sale",
  foreclosure: "Foreclosure",
  permit_pulled: "Permit Activity",
  new_llc: "New LLC Filed",
  job_change: "Job Change Signal",
};

const SIGNAL_ICON: Record<string, string> = {
  fsbo: "🏡", divorce_filing: "⚖️", estate_sale: "🏛️",
  foreclosure: "🔔", permit_pulled: "🔨", new_llc: "📋", job_change: "💼",
};

export default function MortgageRadarDemo() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["mortgage-radar-demo"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("mortgage_radar_leads")
        .select("id, signal_type, city, zip, score, signal_date, address")
        .gte("created_at", thirtyDaysAgo)
        .eq("status", "approved")
        .gte("score", 7)
        .order("score", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  // Group by signal type for heatmap
  const bySignal: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  for (const l of (leads as any[] || [])) {
    bySignal[l.signal_type] = (bySignal[l.signal_type] || 0) + 1;
    if (l.city) byCity[l.city] = (byCity[l.city] || 0) + 1;
  }
  const topCities = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 text-cyan-400 text-sm font-medium mb-6">
            Live Demo — Last 30 Days
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Mortgage Radar<br />
            <span className="text-cyan-400">Pre-Market Lead Intelligence</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            FSBO listings, divorces, estates, and foreclosures — before they hit Zillow.
            100% public records. No bureau trigger leads. FCRA-clean.
          </p>
          <a
            href="/mortgage-radar"
            className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-8 py-3 rounded-lg transition-colors mr-3"
          >
            Start Free Trial — 10 Leads Free
          </a>
          <a href="tel:3139921219" className="inline-block border border-gray-600 text-gray-300 hover:border-gray-400 px-8 py-3 rounded-lg transition-colors">
            Call Matt — (313) 992-1219
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Signal Breakdown */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Lead Signal Breakdown — Last 30 Days</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="bg-gray-800 rounded-xl h-24 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(bySignal).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center">
                  <div className="text-3xl mb-2">{SIGNAL_ICON[type] || "📍"}</div>
                  <div className="text-2xl font-bold text-cyan-400">{count}</div>
                  <div className="text-gray-400 text-sm mt-1">{SIGNAL_LABELS[type] || type.replace(/_/g, " ")}</div>
                </div>
              ))}
              {Object.keys(bySignal).length === 0 && (
                <div className="col-span-4 text-center py-12 text-gray-500">No approved leads in the demo yet — data updates daily.</div>
              )}
            </div>
          )}
        </div>

        {/* Hot Cities */}
        {topCities.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Hottest Markets Right Now</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topCities.map(([city, count], i) => (
                <div key={city} className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-5">#{i + 1}</span>
                    <span className="font-medium">{city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-cyan-500 rounded-full" style={{ width: `${Math.max(20, (count / topCities[0][1]) * 120)}px` }} />
                    <span className="text-cyan-400 font-bold text-sm w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Leads (anonymized) */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Recent Leads <span className="text-gray-500 text-base font-normal">(address anonymized in demo)</span></h2>
          <div className="space-y-3">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl h-16 animate-pulse" />
            )) : (leads as any[]).slice(0, 15).map((l: any) => (
              <div key={l.id} className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{SIGNAL_ICON[l.signal_type] || "📍"}</span>
                  <div>
                    <div className="font-medium text-sm">{l.zip} {l.city}</div>
                    <div className="text-gray-400 text-xs">{SIGNAL_LABELS[l.signal_type] || l.signal_type} · {l.signal_date || "recent"}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${l.score >= 9 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {l.score}/10
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gray-800 border border-gray-700 rounded-2xl p-10">
          <h2 className="text-3xl font-bold mb-3">Ready to see leads with full addresses?</h2>
          <p className="text-gray-400 mb-8">First 10 leads free. Card required, no charge until trial ends. Cancel anytime.</p>
          <a href="/mortgage-radar" className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition-colors">
            Start Free Trial — First 10 Leads on Us
          </a>
        </div>
      </div>
    </div>
  );
}
