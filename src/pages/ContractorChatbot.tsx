import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";

export default function ContractorChatbot() {
  return (
    <>
      <SEOHead
        title="AI Chatbot for Contractors — Coming Soon | M² Development"
        description="AI-powered chat widget for contractor websites. Qualifies leads 24/7. Coming soon."
      />
      <WaitlistGate
        productName="AI Chatbot for Contractors"
        price="$149/mo"
        description="An AI chat widget that qualifies visitors 24/7, captures their name and phone number, and sends you the lead automatically. We build it, configure it for your trade and city, and install it on your website. Currently in development — join the waitlist to be first in line."
      />
    </>
  );
}
