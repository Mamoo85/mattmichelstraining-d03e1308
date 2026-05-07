import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyFoundationRadar() {
  return (
    <TradeRadarPortal
      vertical="foundation"
      productLabel="Foundation Radar"
      landingPath="/start-trial"
      signalTypes={[
        { value: "cofc_foundation_inspection", label: "🔴 Rental License Expiring" },
        { value: "foundation_flood_risk", label: "💧 Flood Zone — Foundation Risk" },
        { value: "heavy_rain_foundation", label: "🌧️ Heavy Rain Event" },
        { value: "fema_flood_foundation", label: "🌊 FEMA Flood Declaration" },
        { value: "usgs_flood_gauge", label: "📊 Active Flood Gauge" },
        { value: "seismic_event", label: "🪨 Seismic Event Nearby" },
        { value: "drought_clay_heave", label: "☀️ Drought — Clay Soil Heave" },
        { value: "demo_vibration_neighbor", label: "🏗️ Neighboring Demo Vibration" },
        { value: "nfip_foundation", label: "📋 NFIP Repeat Loss Zone" },
      ]}
    />
  );
}
