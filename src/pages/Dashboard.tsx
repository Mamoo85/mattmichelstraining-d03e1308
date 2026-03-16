import AppNavbar from "@/components/AppNavbar";
import ProtocolTable from "@/components/ProtocolTable";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, Target } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);

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
          <p className="text-xs text-muted-foreground">Your training portal · Real training, real results</p>
        </div>
        <ProtocolTable />
      </div>
    </div>
  );
};

export default Dashboard;
