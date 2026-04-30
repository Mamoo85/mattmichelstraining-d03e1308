export default function MortgageRadarVsZillow() {
  const rows = [
    { feature: "Leads before property hits the MLS", mr: true, zillow: false },
    { feature: "FCRA-clean (no bureau trigger leads)", mr: true, zillow: false },
    { feature: "Divorce filing signals", mr: true, zillow: false },
    { feature: "Estate sale + probate signals", mr: true, zillow: false },
    { feature: "Permit pull activity (renovation = refi intent)", mr: true, zillow: false },
    { feature: "FSBO listings", mr: true, zillow: true },
    { feature: "No competing LO sees same lead simultaneously", mr: true, zillow: false },
    { feature: "ZIP-level territory targeting", mr: true, zillow: false },
    { feature: "National listing database", mr: false, zillow: true },
    { feature: "Buyer leads (not just refi/pre-list)", mr: false, zillow: true },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Mortgage Radar vs Zillow Leads<br />
            <span className="text-cyan-400">for Loan Officers</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Zillow sells the same lead to 3–5 LOs. Mortgage Radar surfaces homeowners
            before they list, from public records — so you're the only call they get.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-4 px-5 text-gray-400 font-medium border-b border-gray-700 w-1/2">Feature</th>
                <th className="py-4 px-5 border-b border-gray-700 text-center">
                  <div className="text-cyan-400 font-bold">Mortgage Radar</div>
                  <div className="text-gray-500 text-xs">$399/mo · first 10 free</div>
                </th>
                <th className="py-4 px-5 border-b border-gray-700 text-center">
                  <div className="text-gray-300 font-bold">Zillow Premier</div>
                  <div className="text-gray-500 text-xs">$300–$1,000+/mo</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-800/30" : ""}>
                  <td className="py-3 px-5 text-gray-300 border-b border-gray-800">{r.feature}</td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.mr ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.zillow ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 bg-gray-800 border border-cyan-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">First 10 leads free. No risk.</h2>
          <p className="text-gray-400 mb-6">Card required to start. No charge until your trial leads are delivered. Cancel anytime.</p>
          <a href="/mortgage-radar" className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition-colors">
            Try Mortgage Radar Free
          </a>
          <p className="text-gray-500 text-sm mt-4">FCRA-clean · Public records only · (313) 992-1219</p>
        </div>
      </div>
    </div>
  );
}
