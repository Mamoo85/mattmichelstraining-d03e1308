import { getLiftConfig } from "./liftConfig";

const MUSCLE_PATHS: Record<string, { d: string; cx?: number; cy?: number; label: string }> = {
  // Front view muscle groups as simplified SVG shapes
  shoulders: { d: "M28,52 Q20,48 18,56 L22,60 L34,56 Z M72,52 Q80,48 82,56 L78,60 L66,56 Z", label: "Shoulders" },
  chest: { d: "M34,56 L50,54 L66,56 L64,70 L50,72 L36,70 Z", label: "Chest" },
  triceps: { d: "M18,56 L14,80 L20,80 L22,60 Z M82,56 L86,80 L80,80 L78,60 Z", label: "Triceps" },
  core: { d: "M38,72 L62,72 L60,100 L40,100 Z", label: "Core" },
  quads: { d: "M38,100 L46,100 L44,140 L34,140 Z M54,100 L62,100 L66,140 L56,140 Z", label: "Quads" },
  // Back view muscle groups
  upperBack: { d: "M36,56 L50,54 L64,56 L62,72 L50,70 L38,72 Z", label: "Upper Back" },
  lowerBack: { d: "M42,72 L58,72 L56,92 L44,92 Z", label: "Lower Back" },
  glutes: { d: "M36,92 L64,92 L62,108 L38,108 Z", label: "Glutes" },
  hamstrings: { d: "M36,108 L46,108 L44,142 L32,142 Z M54,108 L64,108 L68,142 L56,142 Z", label: "Hamstrings" },
  forearms: { d: "M14,80 L10,105 L16,105 L20,80 Z M86,80 L90,105 L84,105 L80,80 Z", label: "Forearms" },
};

interface BodyAvatarProps {
  activeLift: string;
}

const BodyAvatar = ({ activeLift }: BodyAvatarProps) => {
  const config = getLiftConfig(activeLift);
  const activeMs = config?.muscles ?? [];

  return (
    <div className="bg-card shadow-m2 p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Muscles · {activeLift}
      </h3>
      <div className="flex justify-center">
        <svg
          viewBox="0 100 100 100"
          className="w-full max-w-[180px] h-auto"
          style={{ filter: "drop-shadow(0 0 8px hsl(24, 80%, 50%, 0.15))" }}
        >
          {/* Body outline - Tron style */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowStrong">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Head */}
          <circle cx="50" cy="40" r="10" fill="none" stroke="hsl(36,6%,30%)" strokeWidth="0.8" />

          {/* Body outline */}
          <path
            d="M50,50 L34,56 L18,56 L14,80 L10,105 L16,105 L20,80 L22,60 L36,70 L38,72 L36,92 L36,108 L32,142 L44,142 L46,108 L50,100 L54,108 L56,142 L68,142 L64,108 L64,92 L62,72 L64,70 L78,60 L80,80 L84,105 L90,105 L86,80 L82,56 L66,56 L50,50"
            fill="none"
            stroke="hsl(36,6%,25%)"
            strokeWidth="0.6"
          />

          {/* Muscle groups */}
          {Object.entries(MUSCLE_PATHS).map(([key, muscle]) => {
            const isActive = activeMs.includes(key);
            return (
              <path
                key={key}
                d={muscle.d}
                fill={isActive ? "hsl(24, 80%, 50%)" : "hsl(36,6%,18%)"}
                fillOpacity={isActive ? 0.6 : 0.3}
                stroke={isActive ? "hsl(24, 80%, 55%)" : "hsl(36,6%,25%)"}
                strokeWidth={isActive ? "0.8" : "0.4"}
                filter={isActive ? "url(#glowStrong)" : "none"}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
        {activeMs.map((key) => (
          <span
            key={key}
            className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5"
            style={{
              color: "hsl(24, 80%, 55%)",
              background: "hsl(24, 80%, 50%, 0.1)",
              border: "1px solid hsl(24, 80%, 50%, 0.3)",
              textShadow: "0 0 6px hsl(24, 80%, 50%, 0.4)",
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
