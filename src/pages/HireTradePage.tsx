import { useParams } from "react-router-dom";

const TRADE_COPY: Record<string, { title: string; desc: string; signal: string; price: string }> = {
  hvac: {
    title: "HVAC Technicians",
    desc: "Licensed HVAC techs — new certifications, permit activity, and professional movement signals.",
    signal: "R-410A, EPA 608, boiler operator certifications",
    price: "$149/mo",
  },
  electrician: {
    title: "Licensed Electricians",
    desc: "Journeyman and master electricians identified from state license issuances before they post on Indeed.",
    signal: "State electrical license issuances, permit pulls",
    price: "$149/mo",
  },
  plumber: {
    title: "Licensed Plumbers",
    desc: "Plumbing contractors and journeymen — license renewals, new issuances, and job-change signals.",
    signal: "Master and journeyman plumber license events",
    price: "$149/mo",
  },
  "boiler-operator": {
    title: "Boiler Operators",
    desc: "Stationary engineers and boiler operators with fresh license activity in your area.",
    signal: "MIOSHA boiler certifications, state license issuances",
    price: "$149/mo",
  },
  welder: {
    title: "Certified Welders",
    desc: "AWS-certified welders and pipefitters identified from certification and employment signals.",
    signal: "AWS certification events, trade association signals",
    price: "$149/mo",
  },
  roofer: {
    title: "Roofing Contractors",
    desc: "Roofing contractors identified from permit pulls, license issuances, and supplier account signals.",
    signal: "Roofing permit activity, contractor license events",
    price: "$149/mo",
  },
  pipefitter: {
    title: "Pipefitters & Steamfitters",
    desc: "Union and non-union pipefitters identified from apprenticeship completions and license events.",
    signal: "UA union signals, state license issuances",
    price: "$149/mo",
  },
  machinist: {
    title: "CNC Machinists",
    desc: "CNC operators and machinists from manufacturing employment signals and certification events.",
    signal: "NIMS certifications, manufacturing employment signals",
    price: "$149/mo",
  },
};

const CITY_COPY: Record<string, { label: string; state: string }> = {
  detroit: { label: "Metro Detroit", state: "MI" },
  "grand-rapids": { label: "Grand Rapids", state: "MI" },
  lansing: { label: "Lansing", state: "MI" },
  flint: { label: "Flint", state: "MI" },
  "ann-arbor": { label: "Ann Arbor", state: "MI" },
  dallas: { label: "Dallas–Fort Worth", state: "TX" },
  houston: { label: "Houston Metro", state: "TX" },
  austin: { label: "Austin Metro", state: "TX" },
  miami: { label: "Miami Metro", state: "FL" },
  tampa: { label: "Tampa Bay", state: "FL" },
  orlando: { label: "Orlando Metro", state: "FL" },
  phoenix: { label: "Phoenix Metro", state: "AZ" },
  atlanta: { label: "Atlanta Metro", state: "GA" },
  chicago: { label: "Chicago Metro", state: "IL" },
  nashville: { label: "Nashville Metro", state: "TN" },
};

export default function HireTradePage() {
  const { trade = "", city = "" } = useParams<{ trade: string; city: string }>();
  const t = TRADE_COPY[trade] ?? {
    title: `${trade.charAt(0).toUpperCase() + trade.slice(1).replace(/-/g, " ")} Professionals`,
    desc: "Licensed tradespeople identified from state license records, permit activity, and professional signals.",
    signal: "State license issuances, permit pulls, professional movement",
    price: "$149/mo",
  };
  const c = CITY_COPY[city] ?? { label: city.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()), state: "" };
  const locationStr = `${c.label}${c.state ? `, ${c.state}` : ""}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 text-cyan-400 text-sm font-medium mb-6">
            TechAlert · {locationStr}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Hire <span className="text-cyan-400">{t.title}</span><br />
            in {locationStr}
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            {t.desc} TechAlert alerts you the moment a qualified candidate appears in {c.label} — before they post on Indeed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/hire-alert"
              className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              Start Hiring Alerts — {t.price}
            </a>
            <a
              href="tel:3139921219"
              className="inline-block border border-gray-600 text-gray-300 hover:border-cyan-500 hover:text-cyan-400 px-8 py-4 rounded-xl text-lg transition-colors"
            >
              Call Matt — (313) 992-1219
            </a>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">How TechAlert Works in {c.label}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "1", title: "We Monitor Daily", body: `TechAlert scans ${t.signal} across ${locationStr} every morning.` },
            { step: "2", title: "You Get Alerted", body: `When a new ${t.title.toLowerCase()} appears in ${c.label}, you get an email or SMS alert the same day.` },
            { step: "3", title: "You Make the Call", body: "You reach out before the candidate posts on job boards. No bidding wars, no competing employers on the same lead." },
          ].map(s => (
            <div key={s.step} className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
              <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500/40 rounded-full flex items-center justify-center text-cyan-400 font-bold text-lg mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-gray-400 text-sm">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Signal sources */}
        <div className="mt-12 bg-gray-800 border border-gray-700 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4">Signal Sources for {t.title} in {locationStr}</h3>
          <p className="text-gray-400 mb-4">TechAlert combines multiple proprietary data sources to identify candidates before they start job hunting:</p>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex gap-2"><span className="text-cyan-400">✓</span> {t.signal}</li>
            <li className="flex gap-2"><span className="text-cyan-400">✓</span> MIOSHA and state labor database signals</li>
            <li className="flex gap-2"><span className="text-cyan-400">✓</span> Federal contract award activity (SAM.gov)</li>
            <li className="flex gap-2"><span className="text-cyan-400">✓</span> Professional association membership changes</li>
            <li className="flex gap-2"><span className="text-cyan-400">✓</span> LinkedIn employment movement signals</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to hire {t.title.toLowerCase()} in {c.label}?</h2>
          <p className="text-gray-400 mb-6">No contract. Cancel anytime. Alerts start within 24 hours of signup.</p>
          <a
            href="/hire-alert"
            className="inline-block bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition-colors"
          >
            Start TechAlert — {t.price}
          </a>
        </div>
      </div>
    </div>
  );
}
