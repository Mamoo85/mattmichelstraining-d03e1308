import AppNavbar from "@/components/AppNavbar";
import ChallengeSystem from "@/components/ChallengeSystem";
import MyPrograms from "@/components/MyPrograms";
import WorkoutLogger from "@/components/workout/WorkoutLogger";
import IntervalTimer from "@/components/workout/IntervalTimer";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Crown, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { key: "log", label: "Log Workout" },
  { key: "programs", label: "My Programs" },
  { key: "challenges", label: "Challenge & Focus" },
];

const Dashboard = () => {
  const { user, subscribed, subscriptionTier } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("log");
  const [portalLoading, setPortalLoading] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, athlete_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e) {
      console.error("Portal error:", e);
    } finally {
      setPortalLoading(false);
    }
  };

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Welcome back, {athleteDisplay}</h2>
              {subscriptionTier ? (
                <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest">
                  <Crown size={10} />
                  {TIERS[subscriptionTier].name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Free</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Your training portal · Real training, real results</p>
          </div>
          {subscribed && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50 flex-shrink-0"
            >
              {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Manage Plan
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-m2 ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "log" && <WorkoutLogger />}
        {activeTab === "programs" && <MyPrograms />}
        {activeTab === "challenges" && <ChallengeSystem />}
      </div>

      {/* Floating timer button */}
      {!showTimer && (
        <button
          onClick={() => setShowTimer(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-all rounded-full"
          aria-label="Open interval timer"
        >
          <Timer size={24} />
        </button>
      )}

      {/* Timer overlay */}
      {showTimer && <IntervalTimer onClose={() => setShowTimer(false)} />}
    </div>
  );
};

export default Dashboard;
