import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyRoofingRadar() {
  return (
    <TradeRadarPortal
      vertical="roofing"
      productLabel="Roofing Radar"
      landingPath="/roofing-radar"
      signalTypes={[
        { value: "cofc_roof_inspection", label: "🔴 Rental License Expiring" },
        { value: "spc_storm_report_today", label: "☁️ Same-Day Storm Report" },
        { value: "hail_damage_area", label: "⛈️ Hail Damage Area" },
        { value: "spc_hail_archive", label: "⛈️ Recent Hail Archive" },
        { value: "storm_wind_damage", label: "💨 Wind Damage Area" },
        { value: "historic_district_violation", label: "🚨 Historic Violation: Roof" },
        { value: "historical_hail_county", label: "📊 County Hail History" },
        { value: "roof_permit_upsell", label: "🔨 Roof Permit — Neighbor Signal" },
        { value: "new_homeowner_roof", label: "🏠 New Homeowner" },
        { value: "fema_disaster", label: "🌊 FEMA Disaster Zone" },
      ]}
    />
  );
}
