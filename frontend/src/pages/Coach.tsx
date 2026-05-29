import AppNavbar from "@/components/layout/AppNavbar";
import CoachMessaging from "@/components/sessions/CoachMessaging";
import PaywallGate from "@/components/billing/PaywallGate";

const Coach = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12 space-y-8">
      <PaywallGate featureKey="coach_messaging" featureName="Direct Messaging">
        <CoachMessaging />
      </PaywallGate>
    </div>
  </div>
);

export default Coach;
