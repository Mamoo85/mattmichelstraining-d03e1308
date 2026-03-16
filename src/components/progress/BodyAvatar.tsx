import { getLiftConfig } from "./liftConfig";

const MUSCLE_PATHS: Record<string, { d: string; label: string }> = {
  shoulders: {
    d: "M18,24 L24,21 L27,24 L24,27 Z M36,24 L39,21 L45,24 L39,27 Z",
    label: "Delts",
  },
  chest: {
    d: "M27,24 L31.5,23 L36,24 L36,32 L31.5,33 L27,32 Z",
    label: "Chest",
  },
  triceps: {
    d: "M16,26 L18,24 L20,28 L17,38 L14,38 Z M43,28 L45,24 L47,26 L50,38 L47,38 Z",
    label: "Triceps",
  },
  upperBack: {
    d: "M27,24 L31.5,23 L36,24 L35,32 L31.5,30 L28,32 Z",
    label: "Upper Back",
  },
  core: {
    d: "M28,33 L35,33 L35,44 L28,44 Z",
    label: "Core",
  },
  lowerBack: {
    d: "M29,35 L34,35 L34,43 L29,43 Z",
    label: "Lower Back",
  },
  glutes: {
    d: "M27,44 L36,44 L36,50 L27,50 Z",
    label: "Glutes",
  },
  quads: {
    d: "M27,50 L30.5,50 L30,66 L25,66 Z M32.5,50 L36,50 L38,66 L33,66 Z",
    label: "Quads",
  },
  hamstrings: {
    d: "M26,50 L30.5,50 L30,65 L24.5,65 Z M32.5,50 L37,50 L38.5,65 L33,65 Z",
    label: "Hamstrings",
  },
  forearms: {
    d: "M14,38 L17,38 L15.5,50 L13,50 Z M47,38 L50,38 L51,50 L48.5,50 Z",
    label: "Forearms",
  },
};

interface BodyAvatarProps {
  activeLift: string;
}

const BodyAvatar = ({ activeLift }: BodyAvatarProps) => {
  const config = getLiftConfig(activeLift);
  const activeMs = config?.muscles ?? [];

  return (
    <div
      className="p-3"
      style={{
        background: "linear-gradient(180deg, hsl(220, 18%, 6%) 0%, hsl(220, 14%, 9%) 100%)",
        border: "1px solid hsl(24, 80%, 50%, 0.1)",
      }}
    >
      <h3
        className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 font-mono text-center text-primary"
      >
      >
        Target · {activeLift}
      </h3>

      <div className="flex justify-center">
        <svg viewBox="8 4 48 78" className="w-full max-w-[120px] h-auto">
          <defs>
            <filter id="mg">
              <feGaussianBlur stdDeviation="1" result="b" />
              <feFlood floodColor="hsl(24,80%,50%)" floodOpacity="0.35" result="c" />
              <feComposite in="c" in2="b" operator="in" result="cb" />
              <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Anatomical wireframe — proportional, minimal */}
          {/* Head */}
          <ellipse cx="31.5" cy="10" rx="5" ry="5.5" fill="none" stroke="hsl(200,15%,28%)" strokeWidth="0.4" />
          {/* Neck */}
          <line x1="30" y1="15.5" x2="30" y2="21" stroke="hsl(200,15%,24%)" strokeWidth="0.35" />
          <line x1="33" y1="15.5" x2="33" y2="21" stroke="hsl(200,15%,24%)" strokeWidth="0.35" />
          {/* Torso */}
          <path
            d="M24,21 L27,24 L27,32 L28,33 L28,44 L27,44 L27,50 L30.5,50 L31.5,48 L32.5,50 L36,50 L36,44 L35,44 L35,33 L36,32 L36,24 L39,21"
            fill="none" stroke="hsl(200,15%,28%)" strokeWidth="0.4"
          />
          {/* Left arm */}
          <path
            d="M24,21 L18,24 L16,26 L14,38 L13,50 L15.5,50 L17,38 L20,28 L24,27"
            fill="none" stroke="hsl(200,15%,24%)" strokeWidth="0.35"
          />
          {/* Right arm */}
          <path
            d="M39,21 L45,24 L47,26 L50,38 L51,50 L48.5,50 L47,38 L43,28 L39,27"
            fill="none" stroke="hsl(200,15%,24%)" strokeWidth="0.35"
          />
          {/* Left leg */}
          <path
            d="M27,50 L25,66 L24,76 L28,76 L30,66 L30.5,50"
            fill="none" stroke="hsl(200,15%,24%)" strokeWidth="0.35"
          />
          {/* Right leg */}
          <path
            d="M32.5,50 L33,66 L35,76 L39,76 L38,66 L36,50"
            fill="none" stroke="hsl(200,15%,24%)" strokeWidth="0.35"
          />
          {/* Feet */}
          <path d="M24,76 L22.5,77.5 L28,77.5 L28,76" fill="none" stroke="hsl(200,15%,22%)" strokeWidth="0.3" />
          <path d="M35,76 L35,77.5 L40.5,77.5 L39,76" fill="none" stroke="hsl(200,15%,22%)" strokeWidth="0.3" />

          {/* Subtle anatomy lines */}
          <line x1="31.5" y1="33" x2="31.5" y2="44" stroke="hsl(200,15%,18%)" strokeWidth="0.15" />
          <line x1="28" y1="37" x2="35" y2="37" stroke="hsl(200,15%,16%)" strokeWidth="0.12" />
          <line x1="28" y1="40" x2="35" y2="40" stroke="hsl(200,15%,16%)" strokeWidth="0.12" />

          {/* Active muscle highlights */}
          {Object.entries(MUSCLE_PATHS).map(([key, muscle]) => {
            if (!activeMs.includes(key)) return null;
            return (
              <path
                key={key}
                d={muscle.d}
                fill="hsl(24, 80%, 50%)"
                fillOpacity={0.4}
                stroke="hsl(24, 80%, 58%)"
                strokeWidth="0.5"
                filter="url(#mg)"
              />
            );
          })}
        </svg>
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-1 mt-2 justify-center">
        {activeMs.map((key) => (
          <span
            key={key}
            className="text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-px"
            style={{
              color: "hsl(24, 80%, 58%)",
              background: "hsl(var(--primary) / 0.07)",
              border: "1px solid hsl(var(--primary) / 0.2)",
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
