import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene1Clock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fade = interpolate(frame, [0, 20, 70, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const subFade = interpolate(frame, [25, 45, 70, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const scale = spring({ frame, fps, config: { damping: 200 } });
  const tickPulse = Math.sin(frame * 0.3) * 0.02 + 1;

  return (
    <AbsoluteFill style={{ background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      {/* radial vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 0%, #000 80%)" }} />
      <div style={{ opacity: fade, transform: `scale(${scale * tickPulse})`, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 180, fontWeight: 200, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          2:34 <span style={{ fontSize: 80, fontWeight: 300, color: "#64748b" }}>AM</span>
        </p>
        <p style={{ margin: "20px 0 0", fontSize: 22, fontWeight: 600, color: "#475569", letterSpacing: "0.4em", textTransform: "uppercase", opacity: subFade }}>
          Tuesday · Troy, MI
        </p>
      </div>
      <p style={{ position: "absolute", bottom: 80, fontSize: 18, color: "#dc2626", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", opacity: subFade }}>
        Somewhere, a boiler just failed.
      </p>
    </AbsoluteFill>
  );
};
