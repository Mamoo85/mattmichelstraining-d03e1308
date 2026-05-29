import { memo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

interface Participant {
  name: string;
  score: number;
}

interface Props {
  onViewChallenge: () => void;
}

const MEDALS = ["🏆", "🥈", "🥉"];

const DashboardChallengePreview = memo(({ onViewChallenge }: Props) => {
  const [title, setTitle] = useState("");
  const [top3, setTop3] = useState<Participant[]>([]);

  useEffect(() => {
    (async () => {
      // Get active challenge
      const { data: challenge } = await supabase
        .from("monthly_challenges")
        .select("id, title")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!challenge) return;
      setTitle(challenge.title);

      // Get top 3 participants
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("current_value, user_id")
        .eq("monthly_challenge_id", challenge.id)
        .eq("is_public", true)
        .order("current_value", { ascending: false })
        .limit(3);

      if (!participants?.length) return;

      // Get names
      const userIds = participants.map((p) => p.user_id);
      const { data: profiles } = await supabase.rpc("get_public_profiles", { user_ids: userIds });

      const profileMap = new Map(
        ((profiles ?? []) as any[]).map((p: any) => [p.user_id, p.athlete_name || p.full_name || p.random_alias || "Athlete"])
      );

      setTop3(
        participants.map((p) => ({
          name: profileMap.get(p.user_id) || "Athlete",
          score: p.current_value,
        }))
      );
    })();
  }, []);

  if (!title || top3.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            <span className="text-sm font-bold text-foreground">{title}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {top3.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {MEDALS[i]} {p.name}
              </span>
              <span className="font-bold text-foreground tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full text-[10px] uppercase tracking-widest" onClick={onViewChallenge}>
          View Full Leaderboard →
        </Button>
      </CardContent>
    </Card>
  );
});

DashboardChallengePreview.displayName = "DashboardChallengePreview";
export default DashboardChallengePreview;
