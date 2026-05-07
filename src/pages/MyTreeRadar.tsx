import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyTreeRadar() {
  return (
    <TradeRadarPortal
      vertical="tree"
      productLabel="Tree Service Radar"
      landingPath="/start-trial?product=tree_radar"
      signalTypes={[
        { value: "cofc_tree_inspection", label: "🔴 Rental License Expiring" },
        { value: "storm_tree_damage", label: "🌲 Storm Tree Damage" },
        { value: "tree_hazard_area", label: "⚠️ Tree Hazard Area Alert" },
        { value: "tree_removal_permit", label: "🪓 Tree Removal Permit" },
        { value: "tree_311_request", label: "📞 311 Tree Service Request" },
        { value: "tree_drought_stress", label: "☀️ Drought Stress Zone" },
        { value: "fema_disaster", label: "🌊 FEMA Disaster Zone" },
      ]}
    />
  );
}
