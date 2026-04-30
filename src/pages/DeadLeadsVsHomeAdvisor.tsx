export default function DeadLeadsVsHomeAdvisor() {
  const rows = [
    { feature: "Works on leads you already own", dl: true, ha: false },
    { feature: "No new lead cost", dl: true, ha: false },
    { feature: "Pay only when someone replies ($50/reply)", dl: true, ha: false },
    { feature: "No monthly fee", dl: true, ha: false },
    { feature: "Reactivates leads up to 18 months old", dl: true, ha: false },
    { feature: "White-labeled as your business name", dl: true, ha: false },
    { feature: "TCPA-compliant opt-out handling", dl: true, ha: false },
    { feature: "New homeowner leads", dl: false, ha: true },
    { feature: "National lead database", dl: false, ha: true },
    { feature: "Shared leads (sold to 3+ contractors)", dl: false, ha: true },
  ];

  const math = [
    { label: "Avg old lead list size", value: "400 contacts" },
    { label: "Average reply rate", value: "5% (20 replies)" },
    { label: "Your cost", value: "$1,000 (20 × $50)" },
    { label: "Average roofing job value", value: "$12,000" },
    { label: "Revenue if you close 30%", value: "$72,000" },
    { label: "ROI", value: "72x" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Dead Lead Reactivation vs HomeAdvisor<br />
            <span className="text-cyan-400">for Contractors</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            HomeAdvisor sells you leads that 3 other contractors are calling right now.
            Dead Lead Reactivation texts the people who already called <em>you</em> — at $50 per reply, zero monthly fee.
          </p>
          <a href="/dead-lead-intake?pilot=1" className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-3 rounded-lg transition-colors">
            Prove It for $1 →
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Math */}
        <div className="mb-12 bg-gray-800 border border-orange-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-orange-400">The Math (Roofing Example)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {math.map(m => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-white">{m.value}</div>
                <div className="text-gray-400 text-sm mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="overflow-x-auto mb-12">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-4 px-5 text-gray-400 font-medium border-b border-gray-700 w-1/2">Feature</th>
                <th className="py-4 px-5 border-b border-gray-700 text-center">
                  <div className="text-orange-400 font-bold">Dead Lead Reactivation</div>
                  <div className="text-gray-500 text-xs">$50/reply only</div>
                </th>
                <th className="py-4 px-5 border-b border-gray-700 text-center">
                  <div className="text-gray-300 font-bold">HomeAdvisor</div>
                  <div className="text-gray-500 text-xs">$15–80/lead</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-800/30" : ""}>
                  <td className="py-3 px-5 text-gray-300 border-b border-gray-800">{r.feature}</td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.dl ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.ha ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center bg-gray-800 border border-orange-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-3">Zero risk. We prove it for $1.</h2>
          <p className="text-gray-400 mb-6">We text your old leads this week. You only pay $50 when someone replies. The $1 pilot proves it works — then $50/reply after that.</p>
          <a href="/dead-leads-roofing-texas" className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors mr-3">
            Start $1 Pilot
          </a>
          <a href="tel:3139921219" className="inline-block border border-gray-600 text-gray-300 hover:border-gray-400 px-10 py-4 rounded-xl text-lg transition-colors">
            Call Matt — (313) 992-1219
          </a>
        </div>
      </div>
    </div>
  );
}
