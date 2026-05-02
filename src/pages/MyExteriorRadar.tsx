import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyExteriorRadar() {
  return (
    <TradeRadarPortal
      vertical="exterior"
      productLabel="Exterior Radar"
      landingPath="/exterior-radar"
      signalTypes={[
        { value: "storm_siding_damage", label: "Storm/Hail Siding Damage" },
        { value: "exterior_permit", label: "Exterior Permit" },
        { value: "siding_window_permit", label: "Siding/Window Permit" },
        { value: "fsbo_exterior", label: "FSBO Listing" },
        { value: "foreclosure_exterior", label: "Foreclosure Notice" },
        { value: "new_owner_exterior", label: "New Homeowner" },
      ]}
    />
  );
}
