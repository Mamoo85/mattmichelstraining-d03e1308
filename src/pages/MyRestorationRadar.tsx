import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyRestorationRadar() {
  return (
    <TradeRadarPortal
      vertical="restoration"
      productLabel="Restoration Radar"
      landingPath="/restoration-radar"
      signalTypes={[
        { value: "flood_warning", label: "Flood Warning" },
        { value: "heavy_rain_event", label: "Heavy Rain Event" },
        { value: "fema_disaster", label: "FEMA Disaster" },
        { value: "fire_incident_area", label: "Fire Incident Area" },
        { value: "water_damage_permit", label: "Water Damage Permit" },
        { value: "fire_damage_permit", label: "Fire Damage Permit" },
        { value: "mold_remediation_permit", label: "Mold Remediation Permit" },
      ]}
    />
  );
}
