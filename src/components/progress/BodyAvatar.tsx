import { getLiftConfig } from "./liftConfig";

/* ───── Detailed anatomical muscle paths (front view) ───── */
const MUSCLE_PATHS: Record<string, { d: string; label: string; view: "front" | "back" | "both" }> = {
  shoulders: {
    d: "M16,24 Q20,19 24,22 L24,28 Q20,26 16,28 Z M39,22 Q43,19 47,24 L47,28 Q43,26 39,28 Z",
    label: "Delts",
    view: "front",
  },
  chest: {
    d: "M24,23 Q26,21 31.5,22.5 Q37,21 39,23 L39,32 Q35,34 31.5,33 Q28,34 24,32 Z",
    label: "Chest",
    view: "front",
  },
  triceps: {
    d: "M14,26 L16,24 L18,26 L17,38 L14,38 Z M45,26 L47,24 L49,26 L49,38 L46,38 Z",
    label: "Triceps",
    view: "front",
  },
  core: {
    d: "M27,33 Q31.5,32 36,33 L36,44 Q31.5,45 27,44 Z",
    label: "Core",
    view: "front",
  },
  quads: {
    d: "M25,50 L30,50 Q30.5,58 29,66 L24,66 Q24.5,58 25,50 Z M33,50 L38,50 Q38.5,58 39,66 L34,66 Q32.5,58 33,50 Z",
    label: "Quads",
    view: "front",
  },
  forearms: {
    d: "M13,38 L16,38 Q15,44 14,50 L12,50 Q12.5,44 13,38 Z M47,38 L50,38 Q50.5,44 51,50 L49,50 Q48,44 47,38 Z",
    label: "Forearms",
    view: "front",
  },
  upperBack: {
    d: "M24,23 Q28,21 31.5,22 Q35,21 39,23 L38,32 Q35,30 31.5,30 Q28,30 25,32 Z",
    label: "Upper Back",
    view: "back",
  },
  lowerBack: {
    d: "M28,36 Q31.5,35 35,36 L35,44 Q31.5,45 28,44 Z",
    label: "Lower Back",
    view: "back",
  },
  glutes: {
    d: "M26,44 Q31.5,43 37,44 L37,51 Q31.5,52 26,51 Z",
    label: "Glutes",
    view: "back",
  },
  hamstrings: {
    d: "M25,51 L30,51 Q30,59 29,67 L24,67 Q24.5,59 25,51 Z M33,51 L38,51 Q38.5,59 39,67 L34,67 Q33,59 33,51 Z",
    label: "Hamstrings",
    view: "back",
  },
};

const SKELETON_FRONT = [
  "M31.5,5 m-5,5 a5,5.5 0 1,1 10,0 a5,5.5 0 1,1 -10,0",
  "M30,15.5 L30,21 M33,15.5 L33,21",
  "M24,21 L27,24 L27,32 L28,33 L27,44 L26,50 L30.5,50 L31.5,48 L32.5,50 L37,50 L36,44 L35,33 L36,32 L36,24 L39,21",
  "M24,21 L18,24 L16,26 L14,38 L12,50",
  "M39,21 L45,24 L47,26 L49,38 L51,50",
  "M26,50 L24,66 L23,78",
  "M37,50 L39,66 L40,78",
  "M23,78 L21,79.5 L27,79.5 L27,78",
  "M40,78 L40,79.5 L46,79.5 L44,78",
];

const SKELETON_BACK = [
  "M31.5,5 m-5,5 a5,5.5 0 1,1 10,0 a5,5.5 0 1,1 -10,0",
  "M30,15.5 L30,21 M33,15.5 L33,21",
  "M24,21 L27,24 L27,32 L28,33 L27,44 L26,50 L30.5,50 L31.5,48 L32.5,50 L37,50 L36,44 L35,33 L36,32 L36,24 L39,21",
  "M24,21 L18,24 L16,26 L14,38 L12,50",
  "M39,21 L45,24 L47,26 L49,38 L51,50",
  "M26,50 L24,66 L23,78",
  "M37,50 L39,66 L40,78",
  "M23,78 L21,79.5 L27,79.5 L27,78",
  "M40,78 L40,79.5 L46,79.5 L44,78",
  "M31.5,21 L31.5,44",
  "M27,26 Q31.5,28 36,26",
];

/* Matrix rain column positions */
const RAIN_COLS = [10, 16, 22, 28, 34, 40, 46, 52];

interface BodyAvatarProps {
  activeLift: string;
}

const BodyAvatar = ({ activeLift }: BodyAvatarProps) => {
  const config = getLiftConfig(activeLift);
  const activeMs = config?.muscles ?? [];

  const renderView = (view: "front" | "back", skeleton: string[]) => (
    <div className="flex flex-col items-center">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 font-bold">
        {view}
      </span>
      <svg viewBox="6 0 52 84" className="w-full max-w-[140px] h-auto">
        <defs>
          <radialGradient id={`thermal-${view}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="hsl(50, 100%, 65%)" />
            <stop offset="45%" stopColor="hsl(30, 100%, 55%)" />
            <stop offset="100%" stopColor="hsl(0, 90%, 50%)" />
          </radialGradient>
          <filter id={`thermalGlow-${view}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor="hsl(30, 100%, 55%)" floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Matrix-green cyber grid */}
          <pattern id={`cyberGrid-${view}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M6,0 L0,0 L0,6" fill="none" stroke="hsl(120, 100%, 40%)" strokeWidth="0.15" strokeOpacity="0.2" />
          </pattern>
        </defs>

        {/* Background circle with Matrix-green grid */}
        <circle cx="31.5" cy="42" r="36" fill={`url(#cyberGrid-${view})`} className="avatar-cyber-grid" />
        <circle cx="31.5" cy="42" r="36" fill="none" stroke="hsl(120, 100%, 40%)" strokeWidth="0.3" strokeOpacity="0.1" className="avatar-cyber-grid" />

        {/* Matrix rain columns */}
        {RAIN_COLS.map((x, i) => (
          <line
            key={`rain-${i}`}
            x1={x}
            y1={6 + (i * 7) % 20}
            x2={x}
            y2={16 + (i * 7) % 20}
            stroke="hsl(120, 100%, 45%)"
            strokeWidth="0.5"
            strokeOpacity="0.12"
          >
            <animate
              attributeName="y1"
              values={`${6 + (i * 7) % 20};${50 + (i * 5) % 15};${6 + (i * 7) % 20}`}
              dur={`${2.5 + i * 0.3}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              values={`${16 + (i * 7) % 20};${60 + (i * 5) % 15};${16 + (i * 7) % 20}`}
              dur={`${2.5 + i * 0.3}s`}
              repeatCount="indefinite"
            />
          </line>
        ))}

        {/* Skeleton wireframe */}
        {skeleton.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="hsl(120, 40%, 30%)"
            strokeWidth="0.5"
            className="avatar-skeleton"
          />
        ))}

        {/* Inactive muscles */}
        {Object.entries(MUSCLE_PATHS)
          .filter(([key, m]) => {
            if (view === "front") return (m.view === "front" || m.view === "both") && !activeMs.includes(key);
            return (m.view === "back" || m.view === "both") && !activeMs.includes(key);
          })
          .map(([key, muscle]) => (
            <path
              key={key}
              d={muscle.d}
              fill="hsl(215, 20%, 18%)"
              fillOpacity={0.3}
              stroke="hsl(215, 20%, 25%)"
              strokeWidth="0.3"
              className="avatar-muscle-inactive"
            />
          ))}

        {/* Active muscles — thermal heatmap with stronger glow */}
        {Object.entries(MUSCLE_PATHS)
          .filter(([key, m]) => {
            if (view === "front") return (m.view === "front" || m.view === "both") && activeMs.includes(key);
            return (m.view === "back" || m.view === "both") && activeMs.includes(key);
          })
          .map(([key, muscle]) => (
            <path
              key={key}
              d={muscle.d}
              fill={`url(#thermal-${view})`}
              fillOpacity={0.8}
              stroke="hsl(0, 90%, 50%)"
              strokeWidth="0.8"
              filter={`url(#thermalGlow-${view})`}
              className="avatar-muscle-active"
            />
          ))}
      </svg>
    </div>
  );

  return (
    <div
      className="p-4 avatar-container rounded-xl"
      style={{
        background: "hsl(var(--synth-card))",
        border: "1.5px solid hsl(120 100% 40% / 0.15)",
        boxShadow: "0 0 30px -10px hsl(120 100% 40% / 0.1)",
      }}
    >
      <h3
        className="text-base font-bold uppercase tracking-[0.15em] mb-3 font-mono text-center avatar-title"
        style={{ color: "hsl(120, 100%, 45%)", textShadow: "0 0 12px hsl(120 100% 45% / 0.4)" }}
      >
        Target · {activeLift}
      </h3>

      <div className="flex justify-center gap-4">
        {renderView("front", SKELETON_FRONT)}
        {renderView("back", SKELETON_BACK)}
      </div>

      {/* Muscle labels */}
      <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
        {activeMs.map((key) => (
          <span
            key={key}
            className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 avatar-label"
            style={{
              color: "hsl(var(--synth-orange))",
              background: "hsl(var(--synth-orange) / 0.1)",
              border: "1px solid hsl(var(--synth-orange) / 0.25)",
            }}
          >
            {MUSCLE_PATHS[key]?.label ?? key}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BodyAvatar;
