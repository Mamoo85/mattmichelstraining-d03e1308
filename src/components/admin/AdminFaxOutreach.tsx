import ChannelOutreachTab from "./ChannelOutreachTab";
export default function AdminFaxOutreach() {
  return <ChannelOutreachTab config={{ channel: "fax", title: "📠 Fax Drip", subtitle: "Cold-fax cover sheets to local trades — Phaxio · $0.07/send · 80/day cap · statewide MI", offerKey: "fax_outreach", cap: 80, costPerSend: "$0.07", targetLabel: "Fax #" }} />;
}
