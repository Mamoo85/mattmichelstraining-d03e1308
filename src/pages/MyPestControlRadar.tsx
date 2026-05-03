import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyPestControlRadar() {
  return (
    <TradeRadarPortal
      vertical="pest_control"
      productLabel="Pest Control Radar"
      landingPath="/pest-control-radar"
      signalTypes={[
        { value: "cofc_pest_inspection", label: "🔴 Rental License Expiring" },
        { value: "foreclosure_vacant", label: "🏦 Vacant/Foreclosed Property" },
        { value: "blight_pest_harborage", label: "🐀 Blight Violation — Pest Risk" },
        { value: "demo_neighbor_pest", label: "🏚️ Neighboring Demo — Displacement" },
        { value: "new_homeowner_pest", label: "🏠 New Homeowner Discovery" },
      ]}
    />
  );
}
