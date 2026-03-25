import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  current_value: number;
  joined_at: string;
  athlete_name: string | null;
  full_name: string | null;
  random_alias: string | null;
  show_name: boolean;
}

interface ChallengeLeaderboardProps {
  challengeId: string;
  currentUserId?: string;
}

const ChallengeLeaderboard = ({ challengeId, currentUserId }: ChallengeLeaderboardProps) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      // Get public participants
      const { data: participants } = await supabase
        .from("challenge_participants" as any)
        .select("id, user_id, current_value, joined_at")
        .eq("challenge_id", challengeId)
        .eq("is_public", true)
        .order("current_value", { ascending: false });

      if (!participants || participants.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Get profile names for all participants
      const userIds = (participants as any[]).map((p) => p.user_id);
      const { data: profiles } = await (supabase
        .from("profiles_public" as any)
        .select("user_id, athlete_name, full_name, random_alias") as any)
        .in("user_id", userIds);
      const { data: privacyData } = await supabase
        .from("user_privacy_settings" as any)
        .select("user_id, show_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        ((profiles || []) as any[]).map((p) => [p.user_id, p])
      );
      const privacyMap = new Map(
        ((privacyData || []) as any[]).map((p) => [p.user_id, p])
      );

      setEntries(
        (participants as any[]).map((p) => ({
          ...p,
          athlete_name: profileMap.get(p.user_id)?.athlete_name || null,
          full_name: profileMap.get(p.user_id)?.full_name || null,
          random_alias: profileMap.get(p.user_id)?.random_alias || null,
          show_name: privacyMap.get(p.user_id)?.show_name ?? true,
        }))
      );
      setLoading(false);
    };

    fetchLeaderboard();
  }, [challengeId]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-4">
        <div className="h-4 w-32 bg-muted animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-card border border-border p-5 text-center">
        <Trophy size={24} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">
          No public leaderboard entries yet. Join the challenge and set your numbers to public to appear here.
        </p>
      </div>
    );
  }

  const rankIcon = (rank: number) => {
    if (rank === 0) return <Trophy size={14} className="text-primary" />;
    if (rank === 1) return <Medal size={14} className="text-foreground" />;
    if (rank === 2) return <Award size={14} className="text-muted-foreground" />;
    return <span className="text-[10px] font-mono font-bold text-muted-foreground w-3.5 text-center">{rank + 1}</span>;
  };

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
        <Trophy size={12} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leaderboard</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{entries.length} public</span>
      </div>
      <div className="divide-y divide-border">
        {entries.map((entry, idx) => {
          const isYou = entry.user_id === currentUserId;
          const name = isYou ? (entry.athlete_name || entry.full_name || "Athlete") : (entry.show_name ? (entry.athlete_name || entry.full_name || "Athlete") : (entry.random_alias || "Athlete"));
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-2.5 transition-all ${
                isYou ? "bg-primary/5 border-l-2 border-primary" : ""
              } ${idx === 0 ? "bg-yellow-400/5" : ""}`}
            >
              <div className="w-5 flex justify-center">{rankIcon(idx)}</div>
              <span className={`text-sm font-bold flex-1 ${isYou ? "text-primary" : "text-foreground"}`}>
                {name}
                {isYou && <span className="text-[9px] text-primary ml-1.5 font-mono uppercase">(you)</span>}
              </span>
              <span
                className="text-lg font-mono font-bold text-primary"
              >
                {entry.current_value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChallengeLeaderboard;
