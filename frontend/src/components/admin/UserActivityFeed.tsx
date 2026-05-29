import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronUp, Dumbbell, MessageCircle, Trophy, Target, ClipboardList, UserPlus, ShoppingBag, Camera, Star, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ActivityItemNotes from "./ActivityItemNotes";

interface ActivityItem {
  id: string;
  rawId: string;
  type: string;
  label: string;
  detail: string;
  timestamp: string;
  userId: string;
  userName?: string;
}

const ICON_MAP: Record<string, any> = {
  workout_log: Dumbbell,
  message: MessageCircle,
  pr_submission: Trophy,
  challenge_entry: Target,
  progress_log: ClipboardList,
  program_enrollment: ShoppingBag,
  posture_request: Camera,
  community_workout: Star,
  custom_request: UserPlus,
  activity_log: Activity,
};

const TYPE_COLORS: Record<string, string> = {
  workout_log: "text-green-400",
  message: "text-blue-400",
  pr_submission: "text-yellow-400",
  challenge_entry: "text-orange-400",
  progress_log: "text-primary",
  program_enrollment: "text-purple-400",
  posture_request: "text-cyan-400",
  community_workout: "text-pink-400",
  custom_request: "text-emerald-400",
  activity_log: "text-lime-400",
};

interface Props {
  targetUserId?: string;
  limit?: number;
}

const UserActivityFeed = ({ targetUserId, limit = 100 }: Props) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadActivities();
  }, [targetUserId]);

  const loadActivities = async () => {
    setLoading(true);
    const items: ActivityItem[] = [];

    const queries = [
      (() => {
        let q = supabase.from("workout_logs").select("id, user_id, date, session_notes, created_at").order("created_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `wl-${r.id}`, rawId: r.id, type: "workout_log", label: "Logged workout",
            detail: r.session_notes ? r.session_notes.slice(0, 60) : new Date(r.date).toLocaleDateString(),
            timestamp: r.created_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("coach_direct_messages").select("id, user_id, sender_role, message, created_at").order("created_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `dm-${r.id}`, rawId: r.id, type: "message", label: `${r.sender_role === "coach" ? "Coach replied" : "Sent message"}`,
            detail: r.message.slice(0, 60),
            timestamp: r.created_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("pr_submissions" as any).select("id, user_id, exercise_name, weight, reps, status, submitted_at").order("submitted_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `pr-${r.id}`, rawId: r.id, type: "pr_submission", label: `PR: ${r.exercise_name}`,
            detail: `${r.weight}lb × ${r.reps} · ${r.status}`,
            timestamp: r.submitted_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("challenge_entries").select("id, user_id, value, logged_at").order("logged_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `ce-${r.id}`, rawId: r.id, type: "challenge_entry", label: "Challenge entry",
            detail: `+${r.value}`,
            timestamp: r.logged_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("progress_logs" as any).select("id, user_id, exercise_name, logged_at").order("logged_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `pl-${r.id}`, rawId: r.id, type: "progress_log", label: `Logged ${r.exercise_name}`,
            detail: "",
            timestamp: r.logged_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("community_workouts").select("id, user_id, title, is_public, created_at").order("created_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `cw-${r.id}`, rawId: r.id, type: "community_workout", label: r.is_public ? "Shared workout" : "Saved workout",
            detail: r.title,
            timestamp: r.created_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("posture_requests").select("id, user_id, status, created_at").order("created_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `pos-${r.id}`, rawId: r.id, type: "posture_request", label: "Posture check",
            detail: r.status,
            timestamp: r.created_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("custom_program_requests").select("id, user_id, name, status, created_at").order("created_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `cpr-${r.id}`, rawId: r.id, type: "custom_request", label: "Custom program request",
            detail: `${r.name} · ${r.status}`,
            timestamp: r.created_at, userId: r.user_id,
          }));
        });
      })(),
      (() => {
        let q = supabase.from("activity_logs").select("id, user_id, description, activity_type, intensity, duration_minutes, ai_summary, logged_at").order("logged_at", { ascending: false }).limit(limit);
        if (targetUserId) q = q.eq("user_id", targetUserId);
        return q.then(({ data }) => {
          (data || []).forEach((r: any) => items.push({
            id: `al-${r.id}`, rawId: r.id, type: "activity_log", label: r.activity_type ? `Activity: ${r.activity_type}` : "Activity logged",
            detail: r.ai_summary ? r.ai_summary.slice(0, 80) : r.description?.slice(0, 80) || "",
            timestamp: r.logged_at || r.created_at, userId: r.user_id,
          }));
        });
      })(),
    ];

    await Promise.all(queries);

    if (!targetUserId && items.length > 0) {
      const uniqueIds = [...new Set(items.map(i => i.userId))];
      const { data: profiles } = await supabase.rpc("get_public_profiles", { user_ids: uniqueIds });
      const nameMap = new Map<string, string>();
      (profiles || []).forEach((p: any) => {
        nameMap.set(p.user_id, p.athlete_name || p.full_name || p.random_alias || "Unknown");
      });
      items.forEach(item => { item.userName = nameMap.get(item.userId) || "Unknown"; });
    }

    // Sort oldest first (chronological)
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setActivities(items.slice(-limit));
    setLoading(false);

    // Auto-expand today
    const today = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    setExpandedDays(new Set([today]));
  };

  // Group by day - oldest days first
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    activities.forEach(a => {
      const day = new Date(a.timestamp).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    });
    return map;
  }, [activities]);

  const toggleDay = (day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Activity Feed
        </h3>
        <p className="text-[10px] text-muted-foreground">{activities.length} actions · {grouped.size} days</p>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="divide-y divide-border">
          {Array.from(grouped.entries()).map(([day, items]) => (
            <Collapsible
              key={day}
              open={expandedDays.has(day)}
              onOpenChange={() => toggleDay(day)}
            >
              <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{day}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                    {items.length}
                  </span>
                  {expandedDays.has(day) ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-2 space-y-1">
                  {items.map(item => {
                    const Icon = ICON_MAP[item.type] || ClipboardList;
                    const color = TYPE_COLORS[item.type] || "text-muted-foreground";
                    return (
                      <div key={item.id} className="py-1.5">
                        <div className="flex items-start gap-2.5">
                          <Icon size={12} className={`${color} mt-0.5 shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                              {item.userName && (
                                <span className="text-[9px] text-muted-foreground shrink-0">— {item.userName}</span>
                              )}
                            </div>
                            {item.detail && (
                              <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        {/* Notes / Flags / Questions */}
                        <div className="ml-[22px]">
                          <ActivityItemNotes
                            activityType={item.type}
                            activityId={item.rawId}
                            userId={item.userId}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default UserActivityFeed;
