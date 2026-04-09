const caseStudies = [
  {
    industry: "Roofing Contractor",
    problem: "Mobile site scoring 19/100. No click-to-call. Missing from Google Local Pack entirely.",
    fix: "Rebuilt mobile-first site with click-to-call CTAs, local SEO optimization, and automated review requests.",
    results: [
      { label: "PageSpeed", before: "19", after: "94" },
      { label: "Monthly Leads", before: "3", after: "27" },
      { label: "Google Rank", before: "#47", after: "#4" },
    ],
  },
  {
    industry: "HVAC Company",
    problem: "Missing 40% of after-hours calls. No voicemail follow-up system. Competitors answering 24/7.",
    fix: "Deployed 24/7 Call Routing Engine with automated text-back and lead qualification.",
    results: [
      { label: "Calls Captured", before: "60%", after: "98%" },
      { label: "Response Time", before: "4hrs", after: "< 30s" },
      { label: "Monthly Revenue", before: "$12K", after: "$31K" },
    ],
  },
  {
    industry: "Dental Practice",
    problem: "No online booking. Review score at 3.2 stars. Website built in 2018, not mobile-friendly.",
    fix: "New site with online booking widget, automated review requests, and Google Business posting.",
    results: [
      { label: "Google Rating", before: "3.2★", after: "4.8★" },
      { label: "Online Bookings", before: "0/mo", after: "45/mo" },
      { label: "New Patients", before: "8/mo", after: "22/mo" },
    ],
  },
];

const CaseStudyAuditTrail = () => (
  <section className="py-20">
    <div className="container max-w-5xl mx-auto px-4">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
          Real Results. Real Businesses.
        </h2>
        <p style={{ color: "#64748b" }}>Anonymized audits showing the exact problems we found and the measurable results of our fixes.</p>
      </div>

      <div className="space-y-6">
        {caseStudies.map((cs) => (
          <div key={cs.industry} className="rounded-xl overflow-hidden" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <div className="px-6 py-4" style={{ background: "rgba(6,182,212,0.04)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#22d3ee" }}>{cs.industry}</span>
            </div>

            <div className="p-6 space-y-4">
              {/* Problem */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: "#f87171" }}>PROBLEM DETECTED</div>
                <p className="text-sm font-mono" style={{ color: "#94a3b8" }}>{cs.problem}</p>
              </div>
              {/* Fix */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: "#22c55e" }}>FIX APPLIED</div>
                <p className="text-sm font-mono" style={{ color: "#94a3b8" }}>{cs.fix}</p>
              </div>
              {/* Results */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {cs.results.map((r) => (
                  <div key={r.label} className="text-center p-3 rounded-lg" style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "#475569" }}>{r.label}</div>
                    <div className="text-sm line-through mb-1" style={{ color: "#f87171" }}>{r.before}</div>
                    <div className="text-lg font-black" style={{ color: "#22d3ee" }}>{r.after}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CaseStudyAuditTrail;
