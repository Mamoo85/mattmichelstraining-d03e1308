import { useRef, forwardRef } from "react";

interface PRShareCardProps {
  athleteName: string;
  exerciseName: string;
  weight: number;
  reps: number;
  prType: "weight" | "volume";
  date: Date;
}

/** Hidden card rendered off-screen; captured by html2canvas for sharing. */
const PRShareCard = forwardRef<HTMLDivElement, PRShareCardProps>(
  ({ athleteName, exerciseName, weight, reps, prType, date }, ref) => {
    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1080,
          position: "absolute",
          left: -9999,
          top: 0,
          fontFamily: "'Oswald', sans-serif",
          background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0d0d0d 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,107,0,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Corner accents */}
        <div style={{ position: "absolute", top: 0, left: 0, width: 120, height: 4, background: "#FF6B00" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: 120, background: "#FF6B00" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 120, height: 4, background: "#FF6B00" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 4, height: 120, background: "#FF6B00" }} />

        {/* M2 Logo */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: "#FF6B00",
            letterSpacing: 8,
            marginBottom: 16,
          }}
        >
          M2
        </div>

        {/* NEW PR badge */}
        <div
          style={{
            background: "#FF6B00",
            color: "#000",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 6,
            padding: "8px 32px",
            textTransform: "uppercase",
            marginBottom: 48,
          }}
        >
          {prType === "weight" ? "🏆 NEW WEIGHT PR" : "💪 NEW VOLUME PR"}
        </div>

        {/* Athlete name */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: "#999",
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          {athleteName}
        </div>

        {/* Exercise name */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: 2,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 32,
          }}
        >
          {exerciseName}
        </div>

        {/* Numbers */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            marginBottom: 48,
          }}
        >
          <span style={{ fontSize: 96, fontWeight: 900, color: "#FF6B00", lineHeight: 1 }}>
            {weight}
          </span>
          <span style={{ fontSize: 36, fontWeight: 400, color: "#666" }}>lbs</span>
          <span style={{ fontSize: 48, fontWeight: 300, color: "#444" }}>×</span>
          <span style={{ fontSize: 96, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
            {reps}
          </span>
          <span style={{ fontSize: 36, fontWeight: 400, color: "#666" }}>reps</span>
        </div>

        {/* Date */}
        <div style={{ fontSize: 18, color: "#555", letterSpacing: 3 }}>{dateStr}</div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 200, height: 1, background: "linear-gradient(90deg, transparent, #333, transparent)" }} />
          <div style={{ fontSize: 14, color: "#555", letterSpacing: 3, textTransform: "uppercase" }}>
            Trained on the M2 Portal
          </div>
          <div style={{ fontSize: 13, color: "#444", letterSpacing: 1 }}>
            mattmichelstraining.com
          </div>
        </div>
      </div>
    );
  }
);

PRShareCard.displayName = "PRShareCard";
export default PRShareCard;
