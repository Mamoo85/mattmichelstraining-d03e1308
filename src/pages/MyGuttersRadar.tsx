import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyGuttersRadar() {
  return (
    <TradeRadarPortal
      vertical="gutters"
      productLabel="Gutters Radar"
      landingPath="/gutters-radar"
      signalTypes={[
        { value: "storm_damage", label: "Storm Damage" },
        { value: "roof_permit", label: "Roof Permit" },
        { value: "heavy_rain", label: "Heavy Rain" },
        { value: "fema_disaster", label: "FEMA Disaster" },
        { value: "gutter_permit", label: "Gutter Permit" },
      ]}
    />
  );
}
