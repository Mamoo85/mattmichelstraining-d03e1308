export default function TechAlertVsIndeed() {
  const rows = [
    { feature: "Finds candidates before they job search", ta: true, indeed: false },
    { feature: "Licensed trades only (HVAC, Electrical, Plumbing...)", ta: true, indeed: false },
    { feature: "Michigan state license verification", ta: true, indeed: false },
    { feature: "Candidate intent score (1–10)", ta: true, indeed: false },
    { feature: "No per-post fee", ta: true, indeed: false },
    { feature: "No competing employers see your leads", ta: true, indeed: false },
    { feature: "Unlimited alerts per month", ta: true, indeed: false },
    { feature: "Candidate posts job ad themselves", ta: false, indeed: true },
    { feature: "Massive general job seeker database", ta: false, indeed: true },
    { feature: "National reach beyond Michigan", ta: false, indeed: true },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            TechAlert vs Indeed<br />
            <span className="text-cyan-400">for Trades Hiring in Michigan</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Indeed shows you candidates who are actively job hunting. TechAlert finds licensed tradespeople
            before they even start looking — from license issuances, permit activity, and professional signals.
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
                  <div className="text-cyan-400 font-bold">TechAlert</div>
                  <div className="text-gray-500 text-xs">$149/mo</div>
                </th>
                <th className="py-4 px-5 border-b border-gray-700 text-center">
                  <div className="text-gray-300 font-bold">Indeed</div>
                  <div className="text-gray-500 text-xs">$5–$15/click</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-800/30" : ""}>
                  <td className="py-3 px-5 text-gray-300 border-b border-gray-800">{r.feature}</td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.ta ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                  <td className="py-3 px-5 text-center border-b border-gray-800">
                    {r.indeed ? <span className="text-green-400 text-xl">✓</span> : <span className="text-gray-600 text-xl">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 bg-gray-800 border border-cyan-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Stop waiting for the right résumé to show up.</h2>
          <p className="text-gray-400 mb-6">TechAlert monitors Michigan license records daily. You get the alert. You make the call. No bidding wars.</p>
          <a href="/hire-alert" className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition-colors">
            Start TechAlert — $149/mo
          </a>
          <p className="text-gray-500 text-sm mt-4">No contract. Cancel anytime. (313) 992-1219</p>
        </div>
      </div>
    </div>
  );
}
