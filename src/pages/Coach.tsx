import AppNavbar from "@/components/AppNavbar";
import CoachMessaging from "@/components/CoachMessaging";

const Coach = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12 space-y-8">
      <CoachMessaging />
    </div>
  </div>
);

export default Coach;
