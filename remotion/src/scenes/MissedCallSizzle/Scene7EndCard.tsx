import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene7EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);

  const lineWidth = interpolate(frame, [20, 50], [0, 600], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [65, 90], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #00d4ff10 0%, transparent 70%)" }} />

      <div style={{ transform: `scale(${logoScale})`, opacity: logoSpring, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 90, height: 90, borderRadius: 20, background: "linear-gradient(135deg, #00d4ff, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 900, color: "#001520", boxShadow: "0 0 50px #00d4ff60" }}>
          D
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 60, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>Detroit Web Agency</p>
          <p style={{ margin: "8px 0 0", fontSize: 18, color: "#00d4ff", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>Field Operations · Built Right</p>
        </div>
      </div>

      {/* Animated underline */}
      <div style={{ marginTop: 50, width: lineWidth, height: 2, background: "linear-gradient(90deg, transparent, #00d4ff, transparent)" }} />

      <p style={{ margin: "50px 0 0", fontSize: 30, color: "#94a3b8", textAlign: "center", maxWidth: 1100, lineHeight: 1.5, opacity: taglineOpacity, fontWeight: 500 }}>
        Software that runs the boiler shop while you sleep.
      </p>

      <div style={{ marginTop: 60, opacity: ctaOpacity, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 18, color: "#64748b", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>Ready when you are, Pat.</p>
        <p style={{ margin: "16px 0 0", fontSize: 44, color: "#fff", fontWeight: 800 }}>
          (313) 992-1219 · <span style={{ color: "#00d4ff" }}>detroitwebagent.com</span>
        </p>
      </div>
    </AbsoluteFill>
  );
};
