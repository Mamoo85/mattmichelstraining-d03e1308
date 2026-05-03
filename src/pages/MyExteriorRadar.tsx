import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyExteriorRadar() {
  return (
    <TradeRadarPortal
      vertical="exterior"
      productLabel="Exterior Radar"
      landingPath="/exterior-radar"
      signalTypes={[
        { value: "cofc_exterior_inspection", label: "🔴 Rental License Expiring" },
        { value: "spc_storm_report_today", label: "☁️ Same-Day Storm — Siding" },
        { value: "historic_district_violation", label: "🚨 Historic Violation: Exterior" },
        { value: "historical_hail_county", label: "📊 County Hail/Wind History" },
        { value: "new_homeowner_exterior", label: "🏠 New Homeowner" },
        { value: "home_improvement_loan_area", label: "🏦 Home Improvement Loan Area" },
        { value: "homeowner_equity_area", label: "💰 Homeowner Equity Signal" },
      ]}
    />
  );
}
