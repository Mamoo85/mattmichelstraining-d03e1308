import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TRADES = ["All", "HVAC", "Electrician", "Plumber", "Boiler Operator", "Welder", "Pipefitter", "Machinist"];
const BADGE_COLOR: Record<number, string> = { 9: "bg-green-500", 8: "bg-green-400", 7: "bg-yellow-400" };

export default function CandidateJobBoard() {
  const [trade, setTrade] = useState("All");
  const [city, setCity] = useState("");

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["public-candidates", trade, city],
    queryFn: async () => {
      let q = supabase
        .from("hire_alert_candidates" as any)
        .select("id, trade, city, state, score, license_type, years_experience, current_title")
        .eq("do_not_contact", false)
        .eq("is_company_name", false)
        .gte("score", 7)
        .order("score", { ascending: false })
        .limit(48);
      if (trade !== "All") q = q.ilike("trade", `%${trade}%`);
      if (city) q = q.ilike("city", `%${city}%`);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 text-cyan-400 text-sm font-medium mb-6">
            Michigan Licensed Trades — Live Availability
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find <span className="text-cyan-400">Licensed Tradespeople</span><br />Before They Post on Indeed
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            TechAlert monitors license issuance, professional movement, and availability signals across Michigan.
            These candidates are available <em>now</em>.
          </p>
          <a
            href="/hire-alert"
            className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-8 py-3 rounded-lg transition-colors"
          >
            Get Hiring Alerts — $149/mo
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-wrap">
            {TRADES.map(t => (
              <button
                key={t}
                onClick={() => setTrade(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  trade === t
                    ? "bg-cyan-500 text-gray-900"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="Filter by city..."
            className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-40"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl h-36 animate-pulse" />
            ))}
          </div>
        ) : candidates?.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg">No candidates found for those filters.</p>
            <button onClick={() => { setTrade("All"); setCity(""); }} className="mt-4 text-cyan-400 hover:underline text-sm">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(candidates as any[]).map((c: any) => {
              const score = c.score ?? 7;
              const badgeBg = BADGE_COLOR[score] ?? "bg-gray-500";
              return (
                <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-cyan-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-white">{c.trade || "Tradesperson"}</div>
                      <div className="text-gray-400 text-sm">{c.city}, {c.state || "MI"}</div>
                    </div>
                    <span className={`${badgeBg} text-gray-900 text-xs font-bold px-2 py-1 rounded-full`}>
                      {score}/10
                    </span>
                  </div>
                  {c.license_type && (
                    <div className="text-xs text-cyan-400 mb-2">🪪 {c.license_type}</div>
                  )}
                  {c.years_experience && (
                    <div className="text-xs text-gray-400 mb-3">{c.years_experience} yrs experience</div>
                  )}
                  <a
                    href="/hire-alert"
                    className="block w-full text-center bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    Hire this person →
                  </a>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Showing top candidates. Subscribe to TechAlert for full names, contact info, and daily new alerts.
          </p>
          <a href="/hire-alert" className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-8 py-3 rounded-lg transition-colors">
            Start Hiring Smarter — $149/mo
          </a>
        </div>
      </div>
    </div>
  );
}
