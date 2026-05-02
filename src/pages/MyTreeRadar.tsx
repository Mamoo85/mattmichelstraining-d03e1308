import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyTreeRadar() {
  return (
    <TradeRadarPortal
      vertical="tree"
      productLabel="Tree Service Radar"
      landingPath="/tree-radar"
      signalTypes={[
        { value: "storm_tree_damage", label: "Storm Tree Damage" },
        { value: "tree_hazard_area", label: "Tree Hazard Area Alert" },
        { value: "fema_disaster", label: "FEMA Disaster" },
        { value: "tree_removal_permit", label: "Tree Removal Permit" },
        { value: "tree_311_request", label: "311 Tree Request" },
      ]}
    />
  );
}
