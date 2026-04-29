import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene3Voicemail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({ frame, fps, config: { damping: 200 } });
  // Counter from 00:01 to 00:30 over the scene
  const seconds = Math.min(30, Math.floor(interpolate(frame, [10, 110], [1, 30], { extrapolateRight: "clamp" })));
  const ss = String(seconds).padStart(2, "0");

  const barCount = 28;

  return (
    <AbsoluteFill style={{ background: "#060e1a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #dc262610 0%, transparent 70%)" }} />

      <div style={{ opacity: fadeIn, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 24, color: "#dc2626", fontWeight: 700, letterSpacing: "0.4em", textTransform: "uppercase" }}>
          ⚠ Call missed · Voicemail received
        </p>
        <p style={{ margin: "40px 0 0", fontSize: 200, fontWeight: 200, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          00:<span style={{ color: seconds >= 25 ? "#dc2626" : "#fff" }}>{ss}</span>
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 18, color: "#475569", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 600 }}>
          Seconds since they hung up
        </p>

        {/* waveform */}
        <div style={{ marginTop: 60, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 60 }}>
          {Array.from({ length: barCount }).map((_, i) => {
            const phase = frame * 0.2 + i * 0.4;
            const h = 10 + Math.abs(Math.sin(phase)) * 50;
            const opacity = interpolate(i, [0, barCount / 2, barCount - 1], [0.3, 1, 0.3]);
            return (
              <div key={i} style={{
                width: 6,
                height: h,
                background: "#dc2626",
                opacity,
                borderRadius: 3,
              }} />
            );
          })}
        </div>

        <p style={{ margin: "60px 0 0", fontSize: 26, color: "#94a3b8", fontWeight: 500, maxWidth: 900 }}>
          Most contractors? They'll hear it tomorrow at 9am.<br />
          <span style={{ color: "#dc2626", fontWeight: 800 }}>The customer already called the next number.</span>
        </p>
      </div>
    </AbsoluteFill>
  );
};
