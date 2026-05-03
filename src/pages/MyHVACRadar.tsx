import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyHVACRadar() {
  return (
    <TradeRadarPortal
      vertical="hvac"
      productLabel="HVAC Radar"
      landingPath="/hvac-radar"
      signalTypes={[
        { value: "cofc_hvac_inspection", label: "🔴 Rental License Expiring" },
        { value: "bseed_trades_permits_hvac", label: "🔧 Mechanical Permit Filed" },
        { value: "extreme_weather_hvac", label: "🌡️ Extreme Weather Incoming" },
        { value: "aging_system_proxy", label: "⏰ System Past Useful Life" },
        { value: "nfip_flood_hvac", label: "💧 Flood Zone — HVAC Damage" },
        { value: "homeowner_equity_area", label: "💰 Homeowner Equity Signal" },
        { value: "home_improvement_loan_area", label: "🏦 Home Improvement Loan Area" },
      ]}
    />
  );
}
