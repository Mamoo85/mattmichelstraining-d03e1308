import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyDemoJunkRadar() {
  return (
    <TradeRadarPortal
      vertical="demo_junk"
      productLabel="Demo & Junk Radar"
      landingPath="/start-trial"
      signalTypes={[
        { value: "cofc_debris_inspection", label: "🔴 Rental License Expiring" },
        { value: "demo_permit", label: "🏚️ Demolition Order Issued" },
        { value: "completed_demo_lot", label: "🏗️ Completed Demo — Lot Cleanup" },
        { value: "estate_clearout", label: "📦 Estate Sale — Full Cleanout" },
        { value: "foreclosure_vacant", label: "🏦 Bank-Owned / Vacant" },
        { value: "blight_debris_vacant", label: "🗑️ Blight: Debris / Overgrown" },
        { value: "dlba_property", label: "🏙️ DLBA City-Owned Property" },
        { value: "osm_abandoned", label: "🏚️ Abandoned Structure" },
      ]}
    />
  );
}
