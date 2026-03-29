import { Flame, CheckCircle2, Award, Target } from 'lucide-react';

interface AthleteStatsProps {
  streak: number;
  sessionsThisWeek: number;
  totalPoints: number;
  levelLabel: string;
  nextLevelLabel: string | null;
  ptsToNext: number | null;
  progressPct: number;
  onStreakClick?: () => void;
  onSessionsClick?: () => void;
  onPointsClick?: () => void;
}

export default function AthleteStats({
  streak,
  sessionsThisWeek,
  totalPoints,
  levelLabel,
  nextLevelLabel,
  ptsToNext,
  progressPct,
  onStreakClick,
  onSessionsClick,
  onPointsClick,
}: AthleteStatsProps) {
  const weekDots = Math.min(sessionsThisWeek, 7);

  return (
    <div className="w-full px-4 py-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={onStreakClick}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center transition-all active:scale-95 hover:border-[#e8621a]/40"
          style={{ cursor: onStreakClick ? "pointer" : "default" }}
        >
          <div className="flex justify-center mb-1 text-[#e8621a]"><Flame size={20} /></div>
          <div className="font-oswald text-3xl font-black text-[#e8621a] leading-none">{streak}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
            Day Streak
          </div>
        </button>
        <button
          onClick={onSessionsClick}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center transition-all active:scale-95 hover:border-green-500/40"
          style={{ cursor: onSessionsClick ? "pointer" : "default" }}
        >
          <div className="flex justify-center mb-1 text-green-500"><CheckCircle2 size={20} /></div>
          <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`inline-block w-3 h-3 rounded-sm ${i < weekDots ? 'bg-green-500' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1.5">
            {sessionsThisWeek} This Week
          </div>
        </button>
        <button
          onClick={onPointsClick}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center transition-all active:scale-95 hover:border-[#a855f7]/40"
          style={{ cursor: onPointsClick ? "pointer" : "default" }}
        >
          <div className="flex justify-center mb-1 text-[#a855f7]"><Award size={20} /></div>
          <div className="font-oswald text-3xl font-black text-[#a855f7] leading-none">
            {totalPoints.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">Points</div>
        </button>
      </div>
      <div className="px-1">
        <div className="flex justify-between items-end mb-1 text-xs font-bold uppercase tracking-wide">
          <span className="text-[#e8621a] font-oswald text-lg flex items-center gap-1.5">
            <Target size={14} /> {levelLabel}
          </span>
          {nextLevelLabel && ptsToNext !== null && (
            <span className="text-muted-foreground text-[10px] font-medium lowercase pb-1">
              {ptsToNext.toLocaleString()} pts to {nextLevelLabel}
            </span>
          )}
          {!nextLevelLabel && (
            <span className="text-[#a855f7] text-[10px] font-bold pb-1">Max Level 🏆</span>
          )}
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#e8621a] to-orange-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
