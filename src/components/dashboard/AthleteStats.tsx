import { useEffect, useRef, useState } from 'react';
import { MapPin, CalendarCheck, Award, Target } from 'lucide-react';

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

function ProgressRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
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
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {/* CHECK IN — Green glow */}
        <button
          onClick={onStreakClick}
          className="rounded-2xl p-3 text-center transition-all active:scale-95 relative overflow-hidden"
          style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.35)",
            boxShadow: streak >= 3 ? "0 0 16px rgba(34,197,94,0.4)" : "0 0 8px rgba(34,197,94,0.15)",
          }}
        >
          <MapPin size={16} className="mx-auto mb-1" style={{ color: "#22c55e" }} />
          <div className="font-oswald text-2xl font-black leading-none" style={{ color: "#22c55e" }}>
            {animatedStreak}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#22c55e", opacity: 0.8 }}>
            Check In
          </div>
          <div className="text-[8px] mt-0.5" style={{ color: "#22c55e", opacity: 0.5 }}>
            +50 pts · Tap to log
          </div>
        </button>

        {/* THIS WEEK — Blue glow */}
        <button
          onClick={onSessionsClick}
          className="rounded-2xl p-3 text-center transition-all active:scale-95 relative overflow-hidden"
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.35)",
            boxShadow: sessionsThisWeek >= 3 ? "0 0 14px rgba(59,130,246,0.35)" : "0 0 6px rgba(59,130,246,0.15)",
          }}
        >
          <CalendarCheck size={16} className="mx-auto mb-1" style={{ color: "#3b82f6" }} />
          <div className="flex justify-center gap-[2px] my-1">
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black transition-all ${
                  i < weekDots
                    ? 'text-black'
                    : 'text-white/20'
                }`}
                style={i < weekDots ? {
                  background: "#3b82f6",
                  boxShadow: "0 0 6px rgba(59,130,246,0.5)",
                } : { background: "rgba(255,255,255,0.06)" }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#3b82f6", opacity: 0.8 }}>
            This Week
          </div>
          <div className="text-[8px] mt-0.5" style={{ color: "#3b82f6", opacity: 0.5 }}>
            {sessionsThisWeek} of 7 sessions
          </div>
        </button>

        {/* LEVEL — Purple glow */}
        <button
          onClick={onPointsClick}
          className="rounded-2xl p-3 text-center transition-all active:scale-95 relative overflow-hidden"
          style={{
            background: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.35)",
            boxShadow: totalPoints >= 500 ? "0 0 14px rgba(168,85,247,0.35)" : "0 0 6px rgba(168,85,247,0.15)",
          }}
        >
          <div className="relative w-11 h-11 mx-auto mb-1 flex items-center justify-center">
            <ProgressRing pct={progressPct} color="#a855f7" size={48} />
            <Award size={16} style={{ color: "#a855f7" }} />
          </div>
          <div className="font-oswald text-lg font-black leading-none" style={{ color: "#a855f7" }}>
            {animatedPoints >= 1000
              ? `${(animatedPoints / 1000).toFixed(1)}k`
              : animatedPoints}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#a855f7", opacity: 0.8 }}>
            {levelLabel}
          </div>
          <div className="text-[8px] mt-0.5" style={{ color: "#a855f7", opacity: 0.5 }}>
            M² Points
          </div>
        </button>
      </div>

      {/* Level progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1" style={{ color: "#a855f7" }}>
            <Target size={12} /> {levelLabel}
          </span>
          {nextLevelLabel && (
            <span className="text-xs" style={{ color: "#404040" }}>{ptsToNext?.toLocaleString()} to {nextLevelLabel}</span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #a855f7, #6366f1, #3b82f6)",
              boxShadow: "0 0 8px rgba(168,85,247,0.4)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
