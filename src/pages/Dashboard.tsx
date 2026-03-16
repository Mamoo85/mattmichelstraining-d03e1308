import AppNavbar from "@/components/AppNavbar";
import ProtocolTable from "@/components/ProtocolTable";
import ChallengeSystem from "@/components/ChallengeSystem";
import MyPrograms from "@/components/MyPrograms";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2 } from "lucide-react";

const TABS = [
  { key: "programs", label: "My Programs" },
  { key: "protocol", label: "Today's Protocol" },
  { key: "challenges", label: "Challenges" },
];

const Dashboard = () => {
  const { user, subscribed } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("programs");
  const [portalLoading, setPortalLoading] = useState(false);

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
            <h2 className="text-lg font-bold text-foreground">Welcome back, {athleteDisplay}</h2>
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

        {activeTab === "programs" && <MyPrograms />}
        {activeTab === "protocol" && <ProtocolTable />}
        {activeTab === "challenges" && <ChallengeSystem />}
      </div>
    </div>
  );
};

export default Dashboard;
