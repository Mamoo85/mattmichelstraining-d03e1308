import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyElectricalRadar() {
  return (
    <TradeRadarPortal
      vertical="electrical"
      productLabel="Electrical Radar"
      landingPath="/electrical-radar"
      signalTypes={[
        { value: "electrical_permit", label: "Electrical Permit" },
        { value: "panel_upgrade", label: "Panel Upgrade" },
        { value: "ev_charger", label: "EV Charger" },
        { value: "outage", label: "Outage" },
        { value: "solar_install", label: "Solar Install" },
      ]}
    />
  );
}
