import { getLiftConfig } from "./liftConfig";

// Full-body wireframe figure with clear muscle zones — retro 80s CRT style
const MUSCLE_PATHS: Record<string, { d: string; label: string }> = {
  shoulders: {
    d: "M30,38 L38,34 L42,38 L38,42 Z M58,38 L62,34 L70,38 L62,42 Z",
    label: "Delts",
  },
  chest: {
    d: "M42,38 L50,36 L58,38 L58,50 L50,52 L42,50 Z",
    label: "Chest",
  },
  triceps: {
    d: "M28,40 L30,38 L32,44 L28,60 L24,60 Z M68,44 L70,38 L72,40 L76,60 L72,60 Z",
    label: "Triceps",
  },
  upperBack: {
    d: "M42,38 L50,36 L58,38 L56,50 L50,48 L44,50 Z",
    label: "Upper Back",
  },
  core: {
    d: "M44,52 L56,52 L56,68 L44,68 Z",
    label: "Core",
  },
  lowerBack: {
    d: "M46,54 L54,54 L54,66 L46,66 Z",
    label: "Lower Back",
  },
  glutes: {
    d: "M42,68 L58,68 L58,78 L42,78 Z",
    label: "Glutes",
  },
  quads: {
    d: "M42,78 L48,78 L47,102 L39,102 Z M52,78 L58,78 L61,102 L53,102 Z",
    label: "Quads",
  },
  hamstrings: {
    d: "M40,78 L48,78 L47,100 L38,100 Z M52,78 L60,78 L62,100 L53,100 Z",
    label: "Hamstrings",
  },
  forearms: {
    d: "M24,60 L28,60 L26,78 L22,78 Z M72,60 L76,60 L78,78 L74,78 Z",
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
      className="shadow-m2 p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220, 20%, 5%) 0%, hsl(220, 15%, 8%) 100%)",
        border: "1px solid hsl(24, 80%, 50%, 0.15)",
      }}
    >
      {/* CRT scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(24, 80%, 50%) 2px, hsl(24, 80%, 50%) 3px)",
        }}
      />

      <h3
        className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3 font-mono text-center relative z-10"
        style={{
          color: "hsl(24, 80%, 55%)",
          textShadow: "0 0 8px hsl(24, 80%, 50%, 0.6)",
        }}
      >
        ▸ Target Muscles · {activeLift}
      </h3>

      <div className="flex justify-center relative z-10">
        <svg
          viewBox="12 8 76 115"
          className="w-full max-w-[200px] h-auto"
          style={{ filter: "drop-shadow(0 0 6px hsl(24, 80%, 50%, 0.1))" }}
        >
          <defs>
            <filter id="retro-glow">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="active-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor="hsl(24, 80%, 50%)" floodOpacity="0.4" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Grid pattern for retro feel */}
            <pattern id="retro-grid" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="none" />
              <path d="M0,4 L4,4 M4,0 L4,4" stroke="hsl(24, 80%, 50%)" strokeWidth="0.05" opacity="0.15" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect x="12" y="8" width="76" height="115" fill="url(#retro-grid)" />

          {/* Full body wireframe outline */}
          {/* Head */}
          <ellipse cx="50" cy="18" rx="8" ry="9" fill="none" stroke="hsl(180, 60%, 25%)" strokeWidth="0.6" filter="url(#retro-glow)" />
          {/* Neck */}
          <line x1="47" y1="27" x2="47" y2="34" stroke="hsl(180, 60%, 25%)" strokeWidth="0.5" />
          <line x1="53" y1="27" x2="53" y2="34" stroke="hsl(180, 60%, 25%)" strokeWidth="0.5" />

          {/* Torso */}
          <path
            d="M38,34 L42,38 L42,50 L44,52 L44,68 L42,68 L42,78 L48,78 L50,74 L52,78 L58,78 L58,68 L56,68 L56,52 L58,50 L58,38 L62,34"
            fill="none"
            stroke="hsl(180, 60%, 25%)"
            strokeWidth="0.6"
            filter="url(#retro-glow)"
          />

          {/* Arms */}
          <path
            d="M38,34 L30,38 L28,40 L24,60 L22,78 L26,78 L28,60 L32,44 L38,42"
            fill="none"
            stroke="hsl(180, 60%, 25%)"
            strokeWidth="0.5"
            filter="url(#retro-glow)"
          />
          <path
            d="M62,34 L70,38 L72,40 L76,60 L78,78 L74,78 L72,60 L68,44 L62,42"
            fill="none"
            stroke="hsl(180, 60%, 25%)"
            strokeWidth="0.5"
            filter="url(#retro-glow)"
          />

          {/* Hands */}
          <ellipse cx="24" cy="80" rx="2.5" ry="3" fill="none" stroke="hsl(180, 60%, 25%)" strokeWidth="0.4" />
          <ellipse cx="76" cy="80" rx="2.5" ry="3" fill="none" stroke="hsl(180, 60%, 25%)" strokeWidth="0.4" />

          {/* Legs */}
          <path
            d="M42,78 L39,102 L37,118 L43,118 L47,102 L48,78"
            fill="none"
            stroke="hsl(180, 60%, 25%)"
            strokeWidth="0.5"
            filter="url(#retro-glow)"
          />
          <path
            d="M52,78 L53,102 L57,118 L63,118 L61,102 L58,78"
            fill="none"
            stroke="hsl(180, 60%, 25%)"
            strokeWidth="0.5"
            filter="url(#retro-glow)"
          />

          {/* Feet */}
          <path d="M37,118 L34,120 L43,120 L43,118" fill="none" stroke="hsl(180, 60%, 25%)" strokeWidth="0.4" />
          <path d="M57,118 L57,120 L66,120 L63,118" fill="none" stroke="hsl(180, 60%, 25%)" strokeWidth="0.4" />

          {/* Muscle groups — highlighted zones */}
          {Object.entries(MUSCLE_PATHS).map(([key, muscle]) => {
            const isActive = activeMs.includes(key);
            if (!isActive) return null;
            return (
              <path
                key={key}
                d={muscle.d}
                fill="hsl(24, 80%, 50%)"
                fillOpacity={0.45}
                stroke="hsl(24, 80%, 60%)"
                strokeWidth="0.8"
                filter="url(#active-glow)"
                className="animate-[pulse_2s_ease-in-out_infinite]"
              />
            );
          })}

          {/* Wireframe segment lines for retro look */}
          {/* Chest horizontal lines */}
          <line x1="44" y1="42" x2="56" y2="42" stroke="hsl(180, 60%, 20%)" strokeWidth="0.2" strokeDasharray="1,1" />
          <line x1="44" y1="46" x2="56" y2="46" stroke="hsl(180, 60%, 20%)" strokeWidth="0.2" strokeDasharray="1,1" />
          {/* Ab lines */}
          <line x1="50" y1="52" x2="50" y2="68" stroke="hsl(180, 60%, 20%)" strokeWidth="0.2" strokeDasharray="0.5,1" />
          <line x1="44" y1="56" x2="56" y2="56" stroke="hsl(180, 60%, 20%)" strokeWidth="0.15" strokeDasharray="1,1" />
          <line x1="44" y1="60" x2="56" y2="60" stroke="hsl(180, 60%, 20%)" strokeWidth="0.15" strokeDasharray="1,1" />
          <line x1="44" y1="64" x2="56" y2="64" stroke="hsl(180, 60%, 20%)" strokeWidth="0.15" strokeDasharray="1,1" />
          {/* Knee joints */}
          <circle cx="43" cy="102" r="2" fill="none" stroke="hsl(180, 60%, 20%)" strokeWidth="0.3" />
          <circle cx="57" cy="102" r="2" fill="none" stroke="hsl(180, 60%, 20%)" strokeWidth="0.3" />
          {/* Elbow joints */}
          <circle cx="26" cy="60" r="1.5" fill="none" stroke="hsl(180, 60%, 20%)" strokeWidth="0.3" />
          <circle cx="74" cy="60" r="1.5" fill="none" stroke="hsl(180, 60%, 20%)" strokeWidth="0.3" />
        </svg>
      </div>

      {/* Active muscle labels */}
      <div className="flex flex-wrap gap-1.5 mt-3 justify-center relative z-10">
        {activeMs.map((key) => (
          <span
            key={key}
            className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] px-2 py-0.5"
            style={{
              color: "hsl(24, 80%, 60%)",
              background: "hsl(24, 80%, 50%, 0.08)",
              border: "1px solid hsl(24, 80%, 50%, 0.25)",
              textShadow: "0 0 8px hsl(24, 80%, 50%, 0.5)",
              boxShadow: "0 0 6px hsl(24, 80%, 50%, 0.1)",
            }}
          >
            {MUSCLE_PATHS[key]?.label ?? key}
          </span>
        ))}
        {activeMs.length === 0 && (
          <span className="text-[9px] font-mono text-muted-foreground opacity-50 tracking-widest">
            Select a lift to highlight
          </span>
        )}
      </div>

      {/* Retro status bar */}
      <div
        className="mt-3 pt-2 border-t text-center relative z-10"
        style={{ borderColor: "hsl(180, 60%, 15%)" }}
      >
        <span
          className="text-[8px] font-mono uppercase tracking-[0.3em]"
          style={{
            color: "hsl(180, 60%, 35%)",
            textShadow: "0 0 4px hsl(180, 60%, 30%, 0.5)",
          }}
        >
          M² Body Map v2.0 ■ {activeMs.length} zone{activeMs.length !== 1 ? "s" : ""} active
        </span>
      </div>
    </div>
  );
};

export default BodyAvatar;
