import { useState, useEffect, useRef } from "react";

const COMPETITORS = [
  { name: "ServiceTitan", perTech: 398, note: "Per-tech pricing, annual contract required", color: "#ef4444" },
  { name: "Housecall Pro", perTech: 65.8, note: "$329/mo for 5 users, scales with headcount", color: "#f97316" },
  { name: "Jobber", perTech: 69.8, note: "$349/mo for 5 users, per-user above that", color: "#eab308" },
  { name: "eWay CRM", perTech: 40, note: "$40/user/mo, Outlook plugin — not field-ready", color: "#a855f7" },
];

const FIELDDESK_MONTHLY = 199; // flat, unlimited users

function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

export default function TechTaxCalculator() {
  const [techCount, setTechCount] = useState(8);
  const [animatedSavings, setAnimatedSavings] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const years = 3;
  const fieldDesk3yr = FIELDDESK_MONTHLY * 12 * years;

  const worstCompetitor = COMPETITORS.reduce((max, c) =>
    c.perTech * techCount * 12 * years > max.perTech * techCount * 12 * years ? c : max
  );
  const worstTotal = worstCompetitor.perTech * techCount * 12 * years;
  const maxSavings = worstTotal - fieldDesk3yr;

  // Animate savings counter
  useEffect(() => {
    if (!isVisible) return;
    const target = maxSavings;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedSavings(target);
        clearInterval(timer);
      } else {
        setAnimatedSavings(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [techCount, isVisible, maxSavings]);

  // Intersection observer for animation trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="py-16 px-6 border-t border-white/10 bg-gradient-to-b from-[#0a1628] to-[#0f1a2e]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-widest px-3 py-1 mb-4">
            Tech-Tax Calculator
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3">
            How much is your current software <span className="text-red-400">really</span> costing you?
          </h2>
          <p className="text-white/50 text-sm max-w-xl mx-auto">
            Most field service companies overpay by 5–20x. Drag the slider to see what you'd save with FieldDesk over 3 years.
          </p>
        </div>

        {/* Slider */}
        <div className="max-w-md mx-auto mb-10 text-center">
          <label className="text-white/60 text-sm font-semibold block mb-3">
            How many field technicians do you have?
          </label>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-xs w-6 text-right">1</span>
            <input
              type="range"
              min={1}
              max={30}
              value={techCount}
              onChange={(e) => setTechCount(Number(e.target.value))}
              className="flex-1 h-2 appearance-none bg-white/10 rounded-full cursor-pointer accent-[#00d4ff]"
              style={{ accentColor: "#00d4ff" }}
            />
            <span className="text-white/40 text-xs w-6">30</span>
          </div>
          <div className="mt-3">
            <span className="text-[#00d4ff] text-4xl font-black">{techCount}</span>
            <span className="text-white/50 text-sm ml-2">technician{techCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Cost Bars */}
        <div className="space-y-3 mb-8">
          {COMPETITORS.map((c) => {
            const total3yr = c.perTech * techCount * 12 * years;
            const barWidth = Math.min((total3yr / worstTotal) * 100, 100);
            return (
              <div key={c.name} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/80">{c.name}</span>
                    <span className="text-[10px] text-white/30">{c.note}</span>
                  </div>
                  <span className="text-sm font-black" style={{ color: c.color }}>
                    {formatMoney(total3yr)}
                  </span>
                </div>
                <div className="h-8 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-700 ease-out flex items-center pl-3"
                    style={{
                      width: isVisible ? `${barWidth}%` : "0%",
                      background: `linear-gradient(90deg, ${c.color}40, ${c.color}20)`,
                      borderRight: `3px solid ${c.color}`,
                    }}
                  >
                    <span className="text-[11px] font-bold text-white/60">
                      {formatMoney(c.perTech * techCount)}/mo
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* FieldDesk bar */}
          <div className="relative mt-4 pt-4 border-t border-[#00d4ff]/20">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#00d4ff]">FieldDesk (DWA)</span>
                <span className="text-[10px] text-[#00d4ff]/50">$199/mo flat — unlimited techs</span>
              </div>
              <span className="text-sm font-black text-[#00d4ff]">
                {formatMoney(fieldDesk3yr)}
              </span>
            </div>
            <div className="h-8 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700 ease-out flex items-center pl-3"
                style={{
                  width: isVisible ? `${Math.min((fieldDesk3yr / worstTotal) * 100, 100)}%` : "0%",
                  background: "linear-gradient(90deg, #00d4ff40, #00d4ff20)",
                  borderRight: "3px solid #00d4ff",
                  minWidth: "60px",
                }}
              >
                <span className="text-[11px] font-bold text-white/60">$199/mo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Callout */}
        <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#00d4ff]/5 border-2 border-[#00d4ff]/30 rounded-xl p-6 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-2">
            Your 3-year savings vs {worstCompetitor.name}
          </p>
          <div className="text-[#00d4ff] text-5xl sm:text-6xl font-black mb-2">
            {formatMoney(animatedSavings)}
          </div>
          <p className="text-white/50 text-sm mb-4">
            That's <strong className="text-white">{formatMoney(maxSavings / years)}/year</strong> back in your pocket —
            or <strong className="text-white">{formatMoney(maxSavings / (years * 12))}/month</strong> you're currently lighting on fire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#pricing"
              className="bg-[#00d4ff] text-[#0a1628] font-black px-8 py-3 text-sm uppercase tracking-wide hover:bg-[#00d4ff]/90 transition-colors inline-block"
            >
              Stop Overpaying →
            </a>
            <a
              href="sms:+13139921219"
              className="text-[#00d4ff] text-sm font-bold hover:underline"
            >
              Text Matt: (313) 992-1219
            </a>
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-white/20 text-[11px] mt-4">
          Pricing sourced from public websites as of 2025. ServiceTitan requires annual contract.
          Jobber & Housecall Pro prices reflect their published "Grow" tier.
          FieldDesk is a flat $199/mo with unlimited users — no per-tech fees, no contracts.
        </p>
      </div>
    </div>
  );
}
