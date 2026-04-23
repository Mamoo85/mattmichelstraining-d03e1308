import { useMemo, useState } from "react";
import { Calculator, TrendingDown } from "lucide-react";

/**
 * Talent Radar (TechAlert) interactive ROI calculator.
 * Drops on /hire-alert above the static "The Math" anchor.
 * Inputs: trade dropdown, open positions, hours/week recruiting.
 * Output: annual vacancy cost vs $1,788/yr — savings number.
 *
 * No new deps. Inline useState. Reuses existing scroll-to-pricing CTA.
 */

const ACCENT = "#00d4ff";

interface TradeProfile {
  key: string;
  label: string;
  /** weekly billable revenue lost while position is unfilled */
  weeklyLoss: number;
  /** typical weeks-to-fill via traditional channels */
  weeksToFill: number;
  /** typical staffing-agency placement fee */
  agencyFee: number;
}

const TRADES: TradeProfile[] = [
  { key: "hvac",      label: "HVAC Technician",       weeklyLoss: 2400, weeksToFill: 10, agencyFee: 14000 },
  { key: "plumber",   label: "Plumber / Master Plumber", weeklyLoss: 2200, weeksToFill: 12, agencyFee: 13000 },
  { key: "electric",  label: "Electrician",           weeklyLoss: 2100, weeksToFill: 11, agencyFee: 13500 },
  { key: "boiler",    label: "Boiler Operator (1st/2nd Class)", weeklyLoss: 3000, weeksToFill: 16, agencyFee: 18000 },
  { key: "cna_rn",    label: "CNA / LPN / RN",        weeklyLoss: 1800, weeksToFill: 8,  agencyFee: 9500 },
];

const ANNUAL_PRICE = 1788; // $149 × 12

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function TechAlertROICalculator() {
  const [tradeKey, setTradeKey] = useState<string>("hvac");
  const [openPositions, setOpenPositions] = useState<number>(2);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(6);

  const calc = useMemo(() => {
    const trade = TRADES.find(t => t.key === tradeKey) ?? TRADES[0];
    const positions = Math.max(0, Math.min(20, openPositions || 0));
    const hours = Math.max(0, Math.min(40, hoursPerWeek || 0));

    // Vacancy revenue loss: weekly loss × weeks to fill × open positions
    const vacancyLoss = trade.weeklyLoss * trade.weeksToFill * positions;

    // Recruiting time cost: hours/week × $75/hr (loaded ops cost) × 52 weeks
    const recruiterCost = hours * 75 * 52;

    // Plus typical 1 placement via staffing agency to plug the gap
    const agencyCost = positions > 0 ? trade.agencyFee : 0;

    const annualCost = vacancyLoss + recruiterCost + agencyCost;
    const savings = Math.max(0, annualCost - ANNUAL_PRICE);
    const roiMultiple = ANNUAL_PRICE > 0 ? annualCost / ANNUAL_PRICE : 0;

    return { trade, vacancyLoss, recruiterCost, agencyCost, annualCost, savings, roiMultiple };
  }, [tradeKey, openPositions, hoursPerWeek]);

  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 60px" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #0a1628, #0d2137)",
          border: `2px solid ${ACCENT}40`,
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: `0 0 60px ${ACCENT}10`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: `${ACCENT}1a`,
              border: `1px solid ${ACCENT}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Calculator className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <p style={{ color: ACCENT, fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
              Your Numbers, Live
            </p>
            <h3 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#fff" }}>Talent Radar ROI Calculator</h3>
          </div>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          Plug in your real numbers. See what hiring is actually costing you — versus a flat $149/mo.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label htmlFor="trade-select" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Trade you hire
              </label>
              <select
                id="trade-select"
                value={tradeKey}
                onChange={(e) => setTradeKey(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "#001a33",
                  border: "1px solid #1e3a5f",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {TRADES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label htmlFor="positions-input" style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1 }}>
                  Open positions
                </label>
                <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>{openPositions}</span>
              </div>
              <input
                id="positions-input"
                type="range"
                min={0}
                max={10}
                value={openPositions}
                onChange={(e) => setOpenPositions(Number(e.target.value))}
                style={{ width: "100%", accentColor: ACCENT }}
                aria-label="Open positions"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 2 }}>
                <span>0</span><span>10</span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label htmlFor="hours-input" style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1 }}>
                  Hours/wk recruiting
                </label>
                <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>{hoursPerWeek}h</span>
              </div>
              <input
                id="hours-input"
                type="range"
                min={0}
                max={20}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                style={{ width: "100%", accentColor: ACCENT }}
                aria-label="Hours per week recruiting"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 2 }}>
                <span>0</span><span>20</span>
              </div>
            </div>
          </div>

          {/* Output */}
          <div
            style={{
              background: "#001a33",
              border: "1px solid #1e3a5f",
              borderRadius: 12,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Vacancy revenue lost</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{fmtCurrency(calc.vacancyLoss)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Your recruiting time</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{fmtCurrency(calc.recruiterCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 10, borderBottom: "1px solid #1e3a5f" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Agency placement fee</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{fmtCurrency(calc.agencyCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4 }}>
                <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 600 }}>Annual hiring cost</span>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{fmtCurrency(calc.annualCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 600 }}>Talent Radar ($149/mo)</span>
                <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 16 }}>{fmtCurrency(ANNUAL_PRICE)}</span>
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${ACCENT}40` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingDown className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <p style={{ margin: 0, color: ACCENT, fontWeight: 700, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  Estimated Annual Savings
                </p>
              </div>
              <div style={{ color: "#fff", fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
                {fmtCurrency(calc.savings)}
              </div>
              <p style={{ color: "#64748b", fontSize: 11, margin: "6px 0 0" }}>
                {calc.roiMultiple >= 1
                  ? `${calc.roiMultiple.toFixed(1)}× return on every dollar spent on Talent Radar`
                  : "Adjust your inputs to see your real savings."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => document.getElementById("hire-alert-pricing")?.scrollIntoView({ behavior: "smooth" })}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "12px 16px",
                background: ACCENT,
                color: "#001a33",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Lock in these numbers →
            </button>
          </div>
        </div>

        <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          Estimates based on Metro Detroit skilled trade & licensed healthcare averages. Loaded recruiter cost = $75/hr.
          Your results will vary based on local wage rates and time-to-fill.
        </p>
      </div>
    </section>
  );
}
