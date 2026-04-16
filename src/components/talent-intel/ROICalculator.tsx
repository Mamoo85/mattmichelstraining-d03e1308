import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";

/**
 * Interactive placement-fee ROI calculator for /talent-intelligence.
 * Inputs: monthly placements + avg salary + fee %.
 * Output: annual gross fees vs $3K/yr cost. Drives the "obviously profitable" anchor.
 */
export default function ROICalculator() {
  const [placements, setPlacements] = useState(3);
  const [salary, setSalary] = useState(75000);
  const [feePct, setFeePct] = useState(20);
  const [model, setModel] = useState<"performance" | "annual">("performance");

  const calc = useMemo(() => {
    const feePerPlacement = (salary * feePct) / 100;
    const monthlyGross = feePerPlacement * placements;
    const annualGross = monthlyGross * 12;
    // Performance: $250 × ~3 interviews per placement
    const interviewsPerPlacement = 3;
    const monthlyCost = model === "performance" ? placements * interviewsPerPlacement * 250 : 25000 / 12;
    const annualCost = monthlyCost * 12;
    const annualNet = annualGross - annualCost;
    const roiMultiple = annualCost > 0 ? annualGross / annualCost : 0;
    return { feePerPlacement, monthlyGross, annualGross, monthlyCost, annualCost, annualNet, roiMultiple };
  }, [placements, salary, feePct, model]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-[#0f1f35] border border-[#00d4ff]/30 rounded-2xl p-6 md:p-8 shadow-[0_0_60px_rgba(0,212,255,0.08)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">ROI Calculator</h3>
          <p className="text-slate-500 text-xs">See your numbers before you sign</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-slate-300 text-xs uppercase tracking-wider">Placements / month</label>
              <span className="text-[#00d4ff] font-bold text-lg">{placements}</span>
            </div>
            <input
              type="range" min={1} max={15} value={placements}
              onChange={(e) => setPlacements(+e.target.value)}
              className="w-full accent-[#00d4ff]"
              aria-label="Placements per month"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1"><span>1</span><span>15</span></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-slate-300 text-xs uppercase tracking-wider">Avg candidate salary</label>
              <span className="text-[#00d4ff] font-bold text-lg">{fmt(salary)}</span>
            </div>
            <input
              type="range" min={45000} max={140000} step={5000} value={salary}
              onChange={(e) => setSalary(+e.target.value)}
              className="w-full accent-[#00d4ff]"
              aria-label="Average candidate salary"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1"><span>$45K</span><span>$140K</span></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-slate-300 text-xs uppercase tracking-wider">Placement fee %</label>
              <span className="text-[#00d4ff] font-bold text-lg">{feePct}%</span>
            </div>
            <input
              type="range" min={10} max={30} value={feePct}
              onChange={(e) => setFeePct(+e.target.value)}
              className="w-full accent-[#00d4ff]"
              aria-label="Placement fee percentage"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1"><span>10%</span><span>30%</span></div>
          </div>

          <div>
            <label className="text-slate-300 text-xs uppercase tracking-wider mb-2 block">Pricing model</label>
            <div className="grid grid-cols-2 gap-2">
              {(["performance", "annual"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    model === m
                      ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]"
                      : "bg-[#0a1628] text-slate-400 border-white/10 hover:border-[#00d4ff]/40"
                  }`}
                >
                  {m === "performance" ? "$250/interview" : "$25K/yr lock"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-[#0a1628] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-sm">Fee per placement</span>
              <span className="text-white font-bold">{fmt(calc.feePerPlacement)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-sm">Monthly gross fees</span>
              <span className="text-white font-bold">{fmt(calc.monthlyGross)}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/5 pb-3">
              <span className="text-slate-400 text-sm">Annual gross fees</span>
              <span className="text-white font-bold text-lg">{fmt(calc.annualGross)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-sm">Annual cost ({model === "performance" ? "$250/int" : "prepay"})</span>
              <span className="text-amber-300 font-semibold">{fmt(calc.annualCost)}</span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#00d4ff]/30">
            <div className="text-[#00d4ff] text-xs uppercase tracking-wider font-bold mb-1">Net Annual Profit</div>
            <div className="text-white text-3xl md:text-4xl font-bold">{fmt(calc.annualNet)}</div>
            <div className="text-slate-500 text-xs mt-1">
              {calc.roiMultiple.toFixed(1)}× return on every dollar spent
            </div>
          </div>

          <a
            href="#request-form"
            className="mt-5 block text-center py-3 rounded-lg bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 transition-colors text-sm font-bold"
          >
            Lock in these numbers →
          </a>
        </div>
      </div>

      <p className="text-slate-600 text-[11px] text-center mt-5">
        Estimates based on Metro Detroit skilled trade & licensed healthcare placement averages. Your results will vary.
      </p>
    </div>
  );
}
