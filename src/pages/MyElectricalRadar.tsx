import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyElectricalRadar() {
  return (
    <TradeRadarPortal
      vertical="electrical"
      productLabel="Electrical Radar"
      landingPath="/electrical-radar"
      signalTypes={[
        { value: "cofc_electrical_inspection", label: "🔴 Rental License Expiring" },
        { value: "bseed_trades_permits_elec", label: "⚡ Electrical Permit Filed" },
        { value: "panel_upgrade_permit", label: "⚡ Panel Upgrade Permit" },
        { value: "renovation_electrical", label: "🔌 Renovation — Electrical" },
        { value: "aging_panel_area", label: "🏚️ Pre-1960 Panel Zone" },
        { value: "storm_panel_check", label: "⛈️ Storm Surge Check" },
        { value: "home_improvement_loan_area", label: "🏦 Home Improvement Loan Area" },
      ]}
    />
  );
}
