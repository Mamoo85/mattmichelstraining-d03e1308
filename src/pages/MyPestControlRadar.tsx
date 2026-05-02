import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyPestControlRadar() {
  return (
    <TradeRadarPortal
      vertical="pest_control"
      productLabel="Pest Control Radar"
      landingPath="/pest-control-radar"
      signalTypes={[
        { value: "pest_sighting", label: "Pest Sighting" },
        { value: "code_violation", label: "Code Violation" },
        { value: "storm_damage", label: "Storm Damage" },
        { value: "seasonal", label: "Seasonal" },
        { value: "new_owner", label: "New Owner" },
      ]}
    />
  );
}
