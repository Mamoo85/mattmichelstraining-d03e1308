import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function MortgageRadarROICalculator() {
  const [lostLeads, setLostLeads] = useState(15);

  const numbers = useMemo(() => {
    const triggerSpend = lostLeads * 30; // ~$30/lead avg trigger lead cost
    const conversion = 0.015; // 1.5% close rate
    const avgLoan = 300_000;
    const commissionPct = 0.008; // 80 bps
    const fundedLoans = lostLeads * conversion;
    const replacedRevenue = fundedLoans * avgLoan * commissionPct;
    const cost = 399;
    const net = replacedRevenue - cost;
    return { triggerSpend, fundedLoans, replacedRevenue, cost, net };
  }, [lostLeads]);

  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <div className="rounded-2xl border-2 border-[#00d4ff]/40 bg-gradient-to-br from-[#0a1628] to-[#030711] p-6 sm:p-10">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Replace your trigger-lead spend — see the ROI</h2>
        </div>
        <p className="text-[#94a3b8] text-sm mb-8">
          Slide to your old monthly trigger-lead volume. Mortgage Radar replaces that pipeline with FCRA-clean public-record signals — for a flat $399/mo.
        </p>

        <div className="space-y-3 mb-8">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-white">Lost trigger leads / month</label>
            <span className="text-3xl font-extrabold text-[#00d4ff]">{lostLeads}</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            value={lostLeads}
            onChange={(e) => setLostLeads(Number(e.target.value))}
            className="w-full accent-[#00d4ff]"
            aria-label="Lost trigger leads per month"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-[#64748b]">
            <span>0</span><span>25</span><span>50</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <Stat label="Old trigger-lead spend" value={`$${fmt(numbers.triggerSpend)}/mo`} muted />
          <Stat label="Funded loans replaced" value={numbers.fundedLoans.toFixed(2)} muted />
          <Stat label="Commission revenue replaced" value={`$${fmt(numbers.replacedRevenue)}`} highlight />
          <Stat label="Net vs Mortgage Radar ($399)" value={`$${fmt(numbers.net)}`} highlight />
        </div>
        <p className="text-[11px] text-[#64748b] mt-4">
          Assumptions: 1.5% close rate, $300k avg loan, 80 bps commission, $30/lead avg trigger cost. Your numbers will vary.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border ${highlight ? "border-[#00d4ff] bg-[#00d4ff]/5" : "border-[#1e3a5f] bg-[#0a1628]"}`}>
      <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-[#00d4ff]" : muted ? "text-[#94a3b8]" : "text-white"}`}>{value}</div>
    </div>
  );
}
