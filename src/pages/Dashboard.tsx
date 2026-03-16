import AppNavbar from "@/components/AppNavbar";
import ProtocolTable from "@/components/ProtocolTable";
import ChallengeSystem from "@/components/ChallengeSystem";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABS = [
  { key: "protocol", label: "My Program" },
  { key: "challenges", label: "Challenges" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("protocol");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, athlete_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">Welcome back, {athleteDisplay}</h2>
          <p className="text-sm text-muted-foreground">Your training portal · Real training, real results</p>
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

        {activeTab === "protocol" && <ProtocolTable />}
        {activeTab === "challenges" && <ChallengeSystem />}
      </div>
    </div>
  );
};

export default Dashboard;
