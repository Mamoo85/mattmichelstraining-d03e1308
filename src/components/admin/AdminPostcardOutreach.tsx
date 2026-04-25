import ChannelOutreachTab from "./ChannelOutreachTab";
export default function AdminPostcardOutreach() {
  return <ChannelOutreachTab config={{ channel: "postcard", title: "✉️ Postcard Drip", subtitle: "6×4 postcards via Lob — $0.85/send · 25/day cap · D0 + D14 retarget", offerKey: "postcard_outreach", cap: 25, costPerSend: "$0.85", targetLabel: "Address" }} />;
}
