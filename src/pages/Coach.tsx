import AppNavbar from "@/components/AppNavbar";
import CoachMessaging from "@/components/CoachMessaging";
import PaywallGate from "@/components/PaywallGate";

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
