import TradeRadarPortal from "@/components/trade-radar/TradeRadarPortal";

export default function MyDemoJunkRadar() {
  return (
    <TradeRadarPortal
      vertical="demo_junk"
      productLabel="Demo & Junk Radar"
      landingPath="/demo-junk-radar"
      signalTypes={[
        { value: "demo_permit", label: "Demo Permit" },
        { value: "estate_clearout", label: "Estate Sale" },
        { value: "probate_clearout", label: "Probate Filing" },
        { value: "foreclosure_clearout", label: "Foreclosure Notice" },
      ]}
    />
  );
}
