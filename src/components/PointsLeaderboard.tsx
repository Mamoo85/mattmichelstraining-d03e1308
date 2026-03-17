import { Trophy, Medal, Award, Zap, Eye, EyeOff, TrendingUp } from "lucide-react";
import { usePoints, getLevelInfo, LEVELS } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";

const getMedalIcon = (rank: number) => {
  if (rank === 0) return <Trophy size={14} className="text-primary" />;
  if (rank === 1) return <Medal size={14} className="text-muted-foreground" />;
  if (rank === 2) return <Award size={14} className="text-primary/70" />;
  return <span className="text-[10px] font-mono font-bold text-muted-foreground w-3.5 text-center">{rank + 1}</span>;
};

const getLevelBadgeColor = (level: string) => {
  switch (level) {
    case "legend": return "bg-primary text-primary-foreground";
    case "beast": return "bg-primary/80 text-primary-foreground";
    case "competitor": return "bg-primary/20 text-primary";
    case "grinder": return "bg-muted text-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const PointsLeaderboard = () => {
  const { user } = useAuth();
  const { leaderboard, points, transactions, toggleVisibility, loading } = usePoints();

  return (
    <div className="space-y-6">
      {/* My Points Summary */}
      {points && (
        <div className="bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Your M² Points</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-mono font-black text-primary">{points.total_points.toLocaleString()}</div>
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 ${getLevelBadgeColor(points.level)}`}>
                {getLevelInfo(points.total_points).label}
              </span>
              {points.weekly_streak > 0 && (
                <div className="flex items-center gap-1 text-primary mt-1">
                  <TrendingUp size={10} />
                  <span className="text-[10px] font-bold font-mono">{points.weekly_streak}wk streak</span>
                </div>
              )}
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between bg-muted p-2.5">
            <div className="flex items-center gap-2">
              {points.is_public ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-muted-foreground" />}
              <span className="text-[10px] font-bold text-foreground">
                {points.is_public ? "Visible on leaderboard" : "Hidden from leaderboard"}
              </span>
            </div>
            <Switch checked={points.is_public} onCheckedChange={toggleVisibility} />
          </div>
        </div>
      )}

      {/* How to Earn */}
      <div className="bg-card border border-border p-5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-3">How to Earn Points</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Studio Check-In", pts: 50 },
            { label: "Log Workout", pts: 25 },
            { label: "Challenge Entry", pts: 10 },
            { label: "Share a Workout", pts: 30 },
            { label: "Referral", pts: 200 },
            { label: "Buy a Program", pts: 100 },
            { label: "Monthly Member", pts: 50 },
            { label: "Merch Purchase", pts: 75 },
            { label: "Weekly Streak", pts: 50 },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between bg-muted px-2.5 py-1.5">
              <span className="text-[10px] text-foreground">{item.label}</span>
              <span className="text-[10px] font-mono font-bold text-primary">+{item.pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Levels */}
      <div className="bg-card border border-border p-5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-3">Levels</span>
        <div className="space-y-1.5">
          {LEVELS.map(l => {
            const isCurrent = points && getLevelInfo(points.total_points).key === l.key;
            return (
              <div
                key={l.key}
                className={`flex items-center justify-between px-3 py-2 ${isCurrent ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}
              >
                <span className={`text-xs font-bold uppercase tracking-widest ${isCurrent ? "text-primary" : "text-foreground"}`}>
                  {l.label}
                  {isCurrent && <span className="text-[9px] text-primary ml-1.5 font-mono">(you)</span>}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{l.min.toLocaleString()}+ pts</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-card border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
          <Trophy size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">M² Leaderboard</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{leaderboard.length} athletes</span>
        </div>
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center">
            <Zap size={24} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Be the first on the board! Earn points to show up here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaderboard.map((entry, idx) => {
              const name = entry.athlete_name || entry.full_name || "Athlete";
              const isYou = entry.user_id === user?.id;
              const levelInfo = getLevelInfo(entry.total_points);
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-all ${isYou ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div className="w-5 flex justify-center">{getMedalIcon(idx)}</div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-bold block truncate ${isYou ? "text-primary" : "text-foreground"}`}>
                      {name}
                      {isYou && <span className="text-[9px] text-primary ml-1.5 font-mono uppercase">(you)</span>}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${getLevelBadgeColor(entry.level)} px-1.5 py-0.5 inline-block mt-0.5`}>
                      {levelInfo.label}
                    </span>
                  </div>
                  <span className="text-lg font-mono font-bold text-primary">{entry.total_points.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-card border border-border p-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">Point History</span>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs bg-muted px-2.5 py-1.5">
                <div className="flex-1 min-w-0">
                  <span className="text-foreground truncate block">{t.description}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <span className="font-mono font-bold text-primary ml-2">+{t.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsLeaderboard;
