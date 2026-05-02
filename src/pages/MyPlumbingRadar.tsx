import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyPlumbingRadar() {
  return (
    <TradeRadarPortal
      vertical="plumbing"
      productLabel="Plumbing Radar"
      landingPath="/plumbing-radar"
      signalTypes={[
        { value: "plumbing_permit", label: "Plumbing Permit" },
        { value: "water_main_break", label: "Water Main Break" },
        { value: "leak_report", label: "Leak Report" },
        { value: "sewer_backup", label: "Sewer Backup" },
        { value: "water_heater_age", label: "Water Heater Age" },
      ]}
    />
  );
}
