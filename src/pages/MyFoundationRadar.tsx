import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyFoundationRadar() {
  return (
    <TradeRadarPortal
      vertical="foundation"
      productLabel="Foundation Radar"
      landingPath="/foundation-radar"
      signalTypes={[
        { value: "foundation_flood_risk", label: "Flood Zone Risk" },
        { value: "heavy_rain_foundation", label: "Heavy Rain Event" },
        { value: "fema_flood_foundation", label: "FEMA Flood Declaration" },
        { value: "nfip_foundation", label: "NFIP Flood Claims" },
        { value: "foundation_repair_permit", label: "Foundation Repair Permit" },
        { value: "structural_permit", label: "Structural Permit" },
      ]}
    />
  );
}
