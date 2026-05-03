import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyPlumbingRadar() {
  return (
    <TradeRadarPortal
      vertical="plumbing"
      productLabel="Plumbing Radar"
      landingPath="/plumbing-radar"
      signalTypes={[
        { value: "cofc_plumbing_inspection", label: "🔴 Rental License Expiring" },
        { value: "bseed_trades_permits_plumb", label: "🚿 Plumbing Permit Filed" },
        { value: "plumbing_permit_major", label: "🔧 Major Plumbing Permit" },
        { value: "water_main_area", label: "💧 Water Main Break Area" },
        { value: "lead_line_area", label: "⚠️ Lead Line Replacement Zone" },
        { value: "home_improvement_loan_area", label: "🏦 Home Improvement Loan Area" },
      ]}
    />
  );
}
