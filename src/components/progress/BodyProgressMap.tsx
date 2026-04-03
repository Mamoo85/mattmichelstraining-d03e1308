import { useMemo } from "react";
import { ALL_LIFTS } from "./liftConfig";

interface ProgressLog {
  exercise_name: string;
  weight: number;
  logged_at: string;
}

interface BodyProgressMapProps {
  allLogs: ProgressLog[];
}

const MUSCLE_PATHS: Record<string, { d: string; label: string; view: "front" | "back" }> = {
  shoulders: { d: "M16,24 Q20,19 24,22 L24,28 Q20,26 16,28 Z M39,22 Q43,19 47,24 L47,28 Q43,26 39,28 Z", label: "Delts", view: "front" },
  chest: { d: "M24,23 Q26,21 31.5,22.5 Q37,21 39,23 L39,32 Q35,34 31.5,33 Q28,34 24,32 Z", label: "Chest", view: "front" },
  triceps: { d: "M14,26 L16,24 L18,26 L17,38 L14,38 Z M45,26 L47,24 L49,26 L49,38 L46,38 Z", label: "Triceps", view: "front" },
  core: { d: "M27,33 Q31.5,32 36,33 L36,44 Q31.5,45 27,44 Z", label: "Core", view: "front" },
  quads: { d: "M25,50 L30,50 Q30.5,58 29,66 L24,66 Q24.5,58 25,50 Z M33,50 L38,50 Q38.5,58 39,66 L34,66 Q32.5,58 33,50 Z", label: "Quads", view: "front" },
  forearms: { d: "M13,38 L16,38 Q15,44 14,50 L12,50 Q12.5,44 13,38 Z M47,38 L50,38 Q50.5,44 51,50 L49,50 Q48,44 47,38 Z", label: "Forearms", view: "front" },
  upperBack: { d: "M24,23 Q28,21 31.5,22 Q35,21 39,23 L38,32 Q35,30 31.5,30 Q28,30 25,32 Z", label: "Upper Back", view: "back" },
  lowerBack: { d: "M28,36 Q31.5,35 35,36 L35,44 Q31.5,45 28,44 Z", label: "Lower Back", view: "back" },
  glutes: { d: "M26,44 Q31.5,43 37,44 L37,51 Q31.5,52 26,51 Z", label: "Glutes", view: "back" },
  hamstrings: { d: "M25,51 L30,51 Q30,59 29,67 L24,67 Q24.5,59 25,51 Z M33,51 L38,51 Q38.5,59 39,67 L34,67 Q33,59 33,51 Z", label: "Hamstrings", view: "back" },
};

const SKELETON = [
  "M31.5,5 m-5,5 a5,5.5 0 1,1 10,0 a5,5.5 0 1,1 -10,0",
  "M30,15.5 L30,21 M33,15.5 L33,21",
  "M24,21 L27,24 L27,32 L28,33 L27,44 L26,50 L30.5,50 L31.5,48 L32.5,50 L37,50 L36,44 L35,33 L36,32 L36,24 L39,21",
  "M24,21 L18,24 L16,26 L14,38 L12,50",
  "M39,21 L45,24 L47,26 L49,38 L51,50",
  "M26,50 L24,66 L23,78",
  "M37,50 L39,66 L40,78",
];

// Color scale: cold (no improvement) → warm (big improvement)
const getHeatColor = (pct: number): string => {
  if (pct <= 0) return "hsl(215, 20%, 20%)";
  if (pct < 5) return "hsl(200, 60%, 35%)";
  if (pct < 10) return "hsl(170, 70%, 40%)";
  if (pct < 20) return "hsl(120, 65%, 45%)";
  if (pct < 35) return "hsl(50, 85%, 50%)";
  if (pct < 50) return "hsl(30, 90%, 50%)";
  return "hsl(0, 85%, 50%)";
};

const getGlowColor = (pct: number): string => {
  if (pct <= 0) return "transparent";
  if (pct < 10) return "hsl(170, 70%, 40%)";
  if (pct < 30) return "hsl(50, 85%, 50%)";
  return "hsl(0, 85%, 50%)";
};

const BodyProgressMap = ({ allLogs }: BodyProgressMapProps) => {
  const muscleGains = useMemo(() => {
    const gains: Record<string, number> = {};

    // For each lift, find earliest and latest weight
    ALL_LIFTS.forEach((lift) => {
      const liftLogs = allLogs
        .filter((l) => l.exercise_name === lift.name)
        .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

      if (liftLogs.length < 2) return;

      const first = liftLogs[0].weight;
      const last = liftLogs[liftLogs.length - 1].weight;
      const pct = first > 0 ? ((last - first) / first) * 100 : 0;

      lift.muscles.forEach((m) => {
        gains[m] = Math.max(gains[m] ?? 0, pct);
      });
    });

    return gains;
  }, [allLogs]);

  const sortedMuscles = useMemo(() => {
    return Object.entries(muscleGains)
      .filter(([, pct]) => pct > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [muscleGains]);

  const renderBody = (view: "front" | "back") => (
    <svg viewBox="6 0 52 84" className="w-full max-w-[130px] h-auto">
      <defs>
        <filter id={`heatGlow-${view}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Skeleton */}
      {SKELETON.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="hsl(0, 0%, 20%)" strokeWidth="0.4" />
      ))}

      {/* Muscles */}
      {Object.entries(MUSCLE_PATHS)
        .filter(([, m]) => m.view === view)
        .map(([key, muscle]) => {
          const pct = muscleGains[key] ?? 0;
          const color = getHeatColor(pct);
          const glow = getGlowColor(pct);
          return (
            <path
              key={key}
              d={muscle.d}
              fill={color}
              fillOpacity={pct > 0 ? 0.8 : 0.2}
              stroke={pct > 0 ? glow : "hsl(215, 20%, 25%)"}
              strokeWidth={pct > 10 ? "0.8" : "0.3"}
              filter={pct > 15 ? `url(#heatGlow-${view})` : undefined}
            >
              {pct > 10 && (
                <animate
                  attributeName="fill-opacity"
                  values="0.7;0.9;0.7"
                  dur="2s"
                  repeatCount="indefinite"
                />
              )}
            </path>
          );
        })}
    </svg>
  );

  if (sortedMuscles.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(249,115,22,0.06), rgba(34,197,94,0.04), rgba(10,10,10,0.95))",
        border: "1.5px solid rgba(249,115,22,0.2)",
        boxShadow: "0 0 40px rgba(249,115,22,0.08)",
      }}
    >
      <h3 className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: "#f97316" }}>
        🔥 Body Progress Heat Map
      </h3>
      <p className="text-[10px] mb-4" style={{ color: "#525252" }}>
        Where you've improved the most, based on your lift history
      </p>

      <div className="flex justify-center gap-6 mb-4">
        <div className="text-center">
          <span className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#737373" }}>Front</span>
          {renderBody("front")}
        </div>
        <div className="text-center">
          <span className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#737373" }}>Back</span>
          {renderBody("back")}
        </div>
      </div>

      {/* Top gainers list */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>Top Gains</p>
        {sortedMuscles.map(([key, pct]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: getHeatColor(pct), boxShadow: `0 0 6px ${getGlowColor(pct)}` }}
            />
            <span className="text-xs font-bold flex-1" style={{ color: "#e5e5e5" }}>
              {MUSCLE_PATHS[key]?.label ?? key}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: getHeatColor(pct) }}>
              +{Math.round(pct)}%
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 justify-center">
        {[0, 5, 15, 30, 50].map((v) => (
          <div key={v} className="flex items-center gap-0.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: getHeatColor(v) }} />
            <span className="text-[7px]" style={{ color: "#525252" }}>{v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BodyProgressMap;
