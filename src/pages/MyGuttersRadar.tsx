import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyGuttersRadar() {
  return (
    <TradeRadarPortal
      vertical="gutters"
      productLabel="Gutters Radar"
      landingPath="/gutters-radar"
      signalTypes={[
        { value: "cofc_gutter_inspection", label: "🔴 Rental License Expiring" },
        { value: "historical_hail_county", label: "📊 County Wind/Hail History" },
        { value: "historic_district_violation", label: "🚨 Historic Violation: Gutters" },
        { value: "storm_gutter_damage", label: "💨 Storm Gutter Damage" },
        { value: "fema_gutter_damage", label: "🌊 FEMA Disaster Zone" },
        { value: "roof_permit_upsell", label: "🔨 Roof Permit — Gutter Upsell" },
        { value: "homeowner_equity_area", label: "💰 Equity Tap Signal" },
      ]}
    />
  );
}
