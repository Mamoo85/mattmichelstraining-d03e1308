import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyPaintingRadar() {
  return (
    <TradeRadarPortal
      vertical="painting"
      productLabel="Painting Radar"
      landingPath="/painting-radar"
      signalTypes={[
        { value: "sale_listing", label: "Sale Listing" },
        { value: "new_owner", label: "New Owner" },
        { value: "permit", label: "Permit" },
        { value: "storm_damage", label: "Storm Damage" },
        { value: "exterior_age", label: "Exterior Age" },
      ]}
    />
  );
}
