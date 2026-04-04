import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const POINT_VALUES = {
  studio_checkin: 50,
  workout_log: 25,
  challenge_entry: 10,
  community_workout: 30,
  referral: 200,
  program_purchase: 100,
  membership_monthly: 50,
  merch_purchase: 75,
  weekly_streak: 50,
  share_workout: 25,
} as const;

export const LEVELS = [
  { key: "rookie", label: "Rookie", min: 0, color: "text-muted-foreground" },
  { key: "grinder", label: "Grinder", min: 500, color: "text-foreground" },
  { key: "competitor", label: "Competitor", min: 1500, color: "text-primary" },
  { key: "beast", label: "Beast", min: 4000, color: "text-primary" },
  { key: "legend", label: "M2 Legend", min: 10000, color: "text-primary" },
] as const;

export type PointAction = keyof typeof POINT_VALUES;

export interface UserPointsData {
  total_points: number;
  level: string;
  weekly_streak: number;
  is_public: boolean;
}

// Track previous level to detect level-ups
let previousLevelKey: string | null = null;

export interface PointTransaction {
  id: string;
  action: string;
  points: number;
  description: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  total_points: number;
  level: string;
  athlete_name: string | null;
  full_name: string | null;
  random_alias: string | null;
  show_name: boolean;
}

export const getLevelInfo = (points: number) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
};

export const getNextLevel = (points: number) => {
  for (const level of LEVELS) {
    if (points < level.min) return level;
  }
  return null;
};

export const usePoints = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState<UserPointsData | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const dismissLevelUp = useCallback(() => setLevelUp(null), []);

  const loadPoints = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_points")
      .select("total_points, level, weekly_streak, is_public")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const newLevel = getLevelInfo((data as any).total_points);
      // Detect level-up: compare against previous known level
      if (previousLevelKey && newLevel.key !== previousLevelKey) {
        const prevIdx = LEVELS.findIndex(l => l.key === previousLevelKey);
        const newIdx = LEVELS.findIndex(l => l.key === newLevel.key);
        if (newIdx > prevIdx) {
          setLevelUp(newLevel.key);
        }
      }
      previousLevelKey = newLevel.key;
      setPoints(data as any);
    } else {
      previousLevelKey = "rookie";
      setPoints({ total_points: 0, level: "rookie", weekly_streak: 0, is_public: true });
    }
    setLoading(false);
  }, [user]);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("point_transactions")
      .select("id, action, points, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setTransactions(data as any);
  }, [user]);

  const loadLeaderboard = useCallback(async () => {
    const { data: pts } = await supabase
      .from("user_points")
      .select("user_id, total_points, level, is_public")
      .eq("is_public", true)
      .order("total_points", { ascending: false })
      .limit(50);
    if (!pts || pts.length === 0) { setLeaderboard([]); return; }
    const userIds = (pts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, athlete_name, full_name, random_alias")
      .in("user_id", userIds);
    const { data: privacyData } = await supabase
      .from("user_privacy_settings" as any)
      .select("user_id, show_name")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const privacyMap = new Map(((privacyData || []) as any[]).map(p => [p.user_id, p]));
    setLeaderboard((pts as any[]).map(p => ({
      user_id: p.user_id,
      total_points: p.total_points,
      level: p.level,
      athlete_name: profileMap.get(p.user_id)?.athlete_name || null,
      full_name: profileMap.get(p.user_id)?.full_name || null,
      random_alias: profileMap.get(p.user_id)?.random_alias || null,
      show_name: privacyMap.get(p.user_id)?.show_name ?? true,
    })));
  }, []);

  const awardPoints = useCallback(async (action: PointAction, description?: string, referenceId?: string) => {
    if (!user) return;
    const pts = POINT_VALUES[action];
    const { data } = await supabase.rpc("award_points", {
      _user_id: user.id,
      _action: action,
      _points: pts,
      _description: description || action.replace(/_/g, " "),
      _reference_id: referenceId || null,
    });
    loadPoints();
    return data;
  }, [user, loadPoints]);

  const toggleVisibility = useCallback(async (val: boolean) => {
    if (!user) return;
    // Use SECURITY DEFINER function — no direct UPDATE on user_points
    await supabase.rpc("toggle_points_visibility", { _is_public: val });
    setPoints(prev => prev ? { ...prev, is_public: val } : prev);
    loadLeaderboard();
  }, [user, loadLeaderboard]);

  useEffect(() => {
    loadPoints();
    loadTransactions();
    loadLeaderboard();
  }, [loadPoints, loadTransactions, loadLeaderboard]);

  return {
    points,
    transactions,
    leaderboard,
    loading,
    awardPoints,
    toggleVisibility,
    loadPoints,
    loadTransactions,
    loadLeaderboard,
    levelUp,
    dismissLevelUp,
  };
};
