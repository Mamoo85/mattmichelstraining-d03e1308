import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyHVACRadar() {
  return (
    <TradeRadarPortal
      vertical="hvac"
      productLabel="HVAC Radar"
      landingPath="/hvac-radar"
      signalTypes={[
        { value: "hvac_permit", label: "HVAC Permit" },
        { value: "heat_wave", label: "Heat Wave" },
        { value: "cold_snap", label: "Cold Snap" },
        { value: "system_age", label: "System Age" },
        { value: "furnace_age", label: "Furnace Age" },
      ]}
    />
  );
}
