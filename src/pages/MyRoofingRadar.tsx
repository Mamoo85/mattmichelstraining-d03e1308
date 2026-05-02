import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyRoofingRadar() {
  return (
    <TradeRadarPortal
      vertical="roofing"
      productLabel="Roofing Radar"
      landingPath="/roofing-radar"
      signalTypes={[
        { value: "hail_event", label: "Hail Event" },
        { value: "roof_permit", label: "Roof Permit" },
        { value: "fema_disaster", label: "FEMA Disaster" },
        { value: "storm_damage", label: "Storm Damage" },
        { value: "insurance_claim", label: "Insurance Claim" },
      ]}
    />
  );
}
