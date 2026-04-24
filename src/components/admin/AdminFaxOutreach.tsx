import ChannelOutreachTab from "./ChannelOutreachTab";
export default function AdminFaxOutreach() {
  return <ChannelOutreachTab config={{ channel: "fax", title: "📠 Fax Drip", subtitle: "Cold-fax cover sheets to local trades — Phaxio · $0.07/send · 20/day cap", offerKey: "fax_outreach", cap: 20, costPerSend: "$0.07", targetLabel: "Fax #" }} />;
}
