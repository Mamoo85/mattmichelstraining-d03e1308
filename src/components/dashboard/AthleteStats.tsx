import { useEffect, useRef, useState } from 'react';
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

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    if (started.current) { setCount(target); return; }
    started.current = true;
    const steps = 24;
    const interval = setInterval(() => {
      setCount(prev => {
        const next = prev + Math.ceil(target / steps);
        if (next >= target) { clearInterval(interval); return target; }
        return next;
      });
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);
  return count;
}

function ProgressRing({ pct, color, size = 54 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  const c = size / 2;
  return (
    <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dasharray 0.9s ease" }}
      />
    </svg>
  );
}

function getStreakColor(streak: number) {
  if (streak >= 14) return { color: "#ff3d00", glow: "0 0 18px rgba(255,61,0,0.7)", label: "On Fire 🔥" };
  if (streak >= 7)  return { color: "#f97316", glow: "0 0 14px rgba(249,115,22,0.6)", label: "Locked In 🔥" };
  if (streak >= 3)  return { color: "#fb923c", glow: "0 0 8px rgba(251,146,60,0.4)", label: "Building 💪" };
  if (streak >= 1)  return { color: "#f97316", glow: "none", label: "Started ✓" };
  return { color: "#525252", glow: "none", label: "Start today" };
}

function getMotivation(streak: number, sessions: number): string {
  if (streak >= 14) return `${streak}-day streak — you're unstoppable.`;
  if (streak >= 7)  return `${streak} days straight. Elite consistency.`;
  if (streak >= 3)  return `${streak}-day streak. Don't break the chain.`;
  if (sessions >= 4) return "Strong week. Finish it out.";
  if (sessions >= 2) return "Mid-week grind. Keep pushing.";
  if (sessions === 1) return "One session in. Make it count.";
  return "Fresh start. Every rep matters.";
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
  const animatedStreak = useCountUp(streak);
  const animatedPoints = useCountUp(totalPoints, 900);
  const weekDots = Math.min(sessionsThisWeek, 7);
  const streakStyle = getStreakColor(streak);
  const motivation = getMotivation(streak, sessionsThisWeek);
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="w-full px-4 pt-2 pb-1 space-y-3">
      {/* 3 stat boxes */}
      <div className="flex gap-2">
        {/* Streak */}
        <button
          onClick={onStreakClick}
          className="flex-1 rounded-2xl p-4 text-center transition-all active:scale-95 relative overflow-hidden"
          style={{
            background: streak > 0 ? `${streakStyle.color}12` : "rgba(255,255,255,0.04)",
            border: `1px solid ${streakStyle.color}30`,
            boxShadow: streak >= 3 ? streakStyle.glow : "none",
          }}
        >
          <Flame size={18} className="mx-auto mb-1" style={{ color: streakStyle.color }} />
          <div className="font-oswald text-3xl font-black leading-none" style={{ color: streakStyle.color }}>
            {animatedStreak}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: streakStyle.color, opacity: 0.7 }}>
            Day Streak
          </div>
          <div className="text-[8px] font-semibold mt-0.5" style={{ color: streakStyle.color, opacity: 0.55 }}>
            {streakStyle.label}
          </div>
        </button>

        {/* Sessions This Week */}
        <button
          onClick={onSessionsClick}
          className="flex-1 bg-white/4 border border-white/10 rounded-2xl p-4 text-center transition-all active:scale-95 hover:border-green-500/30"
        >
          <CheckCircle2 size={18} className="mx-auto mb-1 text-green-500" />
          <div className="flex justify-center gap-[3px] my-1.5">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-black transition-all ${
                    i < weekDots
                      ? 'bg-green-500 text-black shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                      : 'bg-white/8 text-white/25'
                  }`}
                >
                  {d}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#737373" }}>
            {sessionsThisWeek} / 7 days
          </div>
        </button>

        {/* Points + Level Ring */}
        <button
          onClick={onPointsClick}
          className="flex-1 bg-white/4 border border-white/10 rounded-2xl p-4 text-center transition-all active:scale-95 hover:border-[#a855f7]/30 relative"
        >
          <div className="relative w-12 h-12 mx-auto mb-1 flex items-center justify-center">
            <ProgressRing pct={progressPct} color="#a855f7" size={54} />
            <Award size={18} style={{ color: "#a855f7" }} />
          </div>
          <div className="font-oswald text-xl font-black leading-none" style={{ color: "#a855f7" }}>
            {animatedPoints >= 1000
              ? `${(animatedPoints / 1000).toFixed(1)}k`
              : animatedPoints}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#a855f7", opacity: 0.7 }}>
            {levelLabel}
          </div>
          {nextLevelLabel && ptsToNext !== null && (
            <div className="text-[8px] mt-0.5" style={{ color: "#737373" }}>
              {ptsToNext.toLocaleString()} to {nextLevelLabel}
            </div>
          )}
        </button>
      </div>

      {/* Motivational tagline + progress bar */}
      <div className="px-1 space-y-2">
        <p className="text-[11px] font-semibold italic" style={{ color: "#525252" }}>
          {motivation}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: "#f97316" }}>
              <Target size={10} /> {levelLabel}
            </span>
            {nextLevelLabel && (
              <span className="text-[9px]" style={{ color: "#404040" }}>{nextLevelLabel} →</span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #e8621a, #f97316, #fb923c)",
                boxShadow: "0 0 8px rgba(249,115,22,0.4)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
