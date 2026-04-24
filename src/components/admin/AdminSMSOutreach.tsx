import ChannelOutreachTab from "./ChannelOutreachTab";
export default function AdminSMSOutreach() {
  return <ChannelOutreachTab config={{ channel: "sms", title: "💬 SMS Sniper", subtitle: "Twilio SMS to local trades — $0.0079/send · 30/day cap · TCPA-checked via shared sendSMS", offerKey: "sms_outreach", cap: 30, costPerSend: "$0.0079", targetLabel: "Phone" }} />;
}
