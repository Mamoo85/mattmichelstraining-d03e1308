import { Zap, TrendingUp, Eye, EyeOff, ChevronRight } from "lucide-react";
import { usePoints, getLevelInfo, getNextLevel, LEVELS } from "@/hooks/usePoints";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import LevelUpCelebration from "@/components/LevelUpCelebration";

interface PointsWidgetProps {
  onViewLeaderboard?: () => void;
}

const PointsWidget = ({ onViewLeaderboard }: PointsWidgetProps) => {
  const { user } = useAuth();
  const { points, transactions, toggleVisibility, loading, levelUp, dismissLevelUp } = usePoints();

  if (loading || !points) return null;

  const level = getLevelInfo(points.total_points);
  const next = getNextLevel(points.total_points);
  const progressPct = next
    ? Math.min(100, ((points.total_points - level.min) / (next.min - level.min)) * 100)
    : 100;

  return (
    <>
      <LevelUpCelebration levelKey={levelUp} onDismiss={dismissLevelUp} />
      <div className="space-y-3">
      {/* Points Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">M² Points</span>
      </div>

      <div className="bg-card border border-border p-4 space-y-4">
        {/* Total + Level */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-mono font-black text-primary">{points.total_points.toLocaleString()}</div>
            <div className={`text-xs font-bold uppercase tracking-widest ${level.color}`}>
              {level.label}
            </div>
          </div>
          <div className="text-right">
            {points.weekly_streak > 0 && (
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp size={12} />
                <span className="text-xs font-bold font-mono">{points.weekly_streak}wk streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Level Progress */}
        {next && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>{level.label}</span>
              <span>{next.label} — {next.min.toLocaleString()} pts</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="text-[10px] text-muted-foreground text-right font-mono">
              {(next.min - points.total_points).toLocaleString()} pts to go
            </div>
          </div>
        )}

        {/* Visibility Toggle */}
        <div className="flex items-center justify-between bg-muted p-2.5">
          <div className="flex items-center gap-2">
            {points.is_public ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-muted-foreground" />}
            <span className="text-[10px] font-bold text-foreground">
              {points.is_public ? "On leaderboard" : "Hidden"}
            </span>
          </div>
          <Switch checked={points.is_public} onCheckedChange={toggleVisibility} />
        </div>

        {/* View Leaderboard */}
        {onViewLeaderboard && (
          <button
            onClick={onViewLeaderboard}
            className="w-full flex items-center justify-between bg-primary/10 border border-primary/20 px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/15 transition-all"
          >
            View Leaderboard
            <ChevronRight size={14} />
          </button>
        )}

        {/* Recent Activity */}
        {transactions.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Recent</span>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate flex-1">{t.description}</span>
                  <span className="font-mono font-bold text-primary ml-2">+{t.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsWidget;
