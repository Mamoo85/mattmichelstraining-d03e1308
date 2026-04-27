import ChannelOutreachTab from "./ChannelOutreachTab";
export default function AdminSMSOutreach() {
  return <ChannelOutreachTab config={{ channel: "sms", title: "💬 SMS Sniper", subtitle: "Twilio SMS to local trades — $0.0079/send · 150/day cap · statewide MI · TCPA-checked", offerKey: "sms_outreach", cap: 150, costPerSend: "$0.0079", targetLabel: "Phone" }} />;
}
