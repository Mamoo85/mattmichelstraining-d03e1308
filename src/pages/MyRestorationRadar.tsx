import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyRestorationRadar() {
  return (
    <TradeRadarPortal
      vertical="restoration"
      productLabel="Restoration Radar"
      landingPath="/restoration-radar"
      signalTypes={[
        { value: "fire_smoke_restoration", label: "🔥 Fire Incident — Today" },
        { value: "cofc_mold_water_inspection", label: "🔴 Rental License Expiring" },
        { value: "water_damage_permit", label: "💧 Water Damage Permit" },
        { value: "blight_water_structural", label: "🏚️ Structural Blight Violation" },
        { value: "historic_district_violation", label: "🚨 Historic District Violation" },
        { value: "fema_disaster", label: "🌊 FEMA Disaster Zone" },
        { value: "usgs_flood_gauge", label: "🌊 Active Flood Gauge" },
        { value: "fema_public_assistance", label: "🏛️ FEMA Public Assistance Project" },
      ]}
    />
  );
}
