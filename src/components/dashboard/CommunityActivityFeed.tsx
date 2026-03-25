import { memo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedEntry {
  name: string;
  exercise: string;
  ago: string;
}

const CommunityActivityFeed = memo(() => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      // Get recent public logs from other users
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("user_id, exercise_name, logged_at")
        .neq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(20);

      if (!logs?.length) return;

      // Get profiles that are public
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const { data: profiles } = await (supabase
        .from("profiles_safe" as any)
        .select("user_id, full_name, athlete_name, random_alias, is_public_profile") as any)
        .in("user_id", userIds)
        .eq("is_public_profile", true);

      if (!profiles?.length) return;

      const publicIds = new Set(profiles.map((p) => p.user_id));
      const profileMap = new Map(
        profiles.map((p) => [p.user_id, p.athlete_name || p.full_name || p.random_alias || "Athlete"])
      );

      // Check privacy for show_name
      const { data: privacy } = await supabase
        .from("user_privacy_settings")
        .select("user_id, show_name")
        .in("user_id", [...publicIds]);

      const privacyMap = new Map((privacy ?? []).map((p) => [p.user_id, p.show_name]));

      const randomAliasMap = new Map(
        profiles.map((p) => [p.user_id, p.random_alias || "Athlete"])
      );

      const filtered = logs
        .filter((l) => publicIds.has(l.user_id))
        .slice(0, 3)
        .map((l) => {
          const showName = privacyMap.get(l.user_id) ?? true;
          return {
            name: showName ? (profileMap.get(l.user_id) || "Athlete") : (randomAliasMap.get(l.user_id) || "Athlete"),
            exercise: l.exercise_name,
            ago: formatDistanceToNow(new Date(l.logged_at), { addSuffix: true }),
          };
        });

      setEntries(filtered);
    })();
  }, [user]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Activity size={13} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Community</span>
      </div>
      <div className="space-y-1">
        {entries.map((e, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{e.name}</span> logged{" "}
            <span className="text-foreground">{e.exercise}</span> · {e.ago}
          </p>
        ))}
      </div>
    </div>
  );
});

CommunityActivityFeed.displayName = "CommunityActivityFeed";
export default CommunityActivityFeed;
