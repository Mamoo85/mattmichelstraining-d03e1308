import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const MESSAGE = "Got your voicemail! Our emergency boiler team will call back within 15 min. —D.J. Conley";

export const Scene4AutoText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Banner first
  const bannerSpring = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const bannerY = interpolate(bannerSpring, [0, 1], [-100, 0]);

  // Bubble slides in at frame 20
  const bubbleSpring = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 90 } });
  const bubbleY = interpolate(bubbleSpring, [0, 1], [80, 0]);
  const bubbleOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  // Type-on for the message starting at frame 40
  const charsToShow = Math.max(0, Math.floor(interpolate(frame, [40, 95], [0, MESSAGE.length], { extrapolateRight: "clamp" })));
  const typed = MESSAGE.slice(0, charsToShow);
  const showCursor = Math.floor(frame / 6) % 2 === 0;

  // Big stat at the end
  const statOpacity = interpolate(frame, [110, 140], [0, 1], { extrapolateRight: "clamp" });
  const statY = interpolate(spring({ frame: frame - 110, fps, config: { damping: 20 } }), [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ background: "#060e1a", fontFamily: "Inter, sans-serif", padding: 80 }}>
      {/* Top banner */}
      <div style={{ transform: `translateY(${bannerY}px)`, display: "flex", alignItems: "center", gap: 20, padding: "24px 36px", background: "linear-gradient(90deg, #00d4ff15, transparent)", border: "1px solid #00d4ff40", borderRadius: 20, marginBottom: 60 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#00d4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 0 30px #00d4ff80" }}>⚡</div>
        <div>
          <p style={{ margin: 0, fontSize: 16, color: "#00d4ff", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase" }}>Missed-Call Catch · Triggered</p>
          <p style={{ margin: "6px 0 0", fontSize: 22, color: "#fff", fontWeight: 700 }}>Auto-reply firing in <span style={{ color: "#00d4ff" }}>0.4 seconds</span> ...</p>
        </div>
        <div style={{ marginLeft: "auto", padding: "8px 18px", background: "#10b98120", border: "1px solid #10b981", color: "#10b981", borderRadius: 30, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>SENT ✓</div>
      </div>

      {/* SMS bubble */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
        <div style={{
          transform: `translateY(${bubbleY}px)`,
          opacity: bubbleOpacity,
          maxWidth: 1000,
          background: "linear-gradient(135deg, #00d4ff, #0891b2)",
          color: "#001520",
          padding: "40px 50px",
          borderRadius: "40px 40px 8px 40px",
          fontSize: 38,
          fontWeight: 600,
          lineHeight: 1.4,
          boxShadow: "0 30px 80px #00d4ff40, 0 0 60px #00d4ff20",
          position: "relative"
        }}>
          {typed}{charsToShow < MESSAGE.length && showCursor ? <span style={{ color: "#001520" }}>▊</span> : ""}
          <p style={{ margin: "20px 0 0", fontSize: 18, color: "#001520", opacity: 0.6, fontWeight: 700, letterSpacing: "0.1em" }}>
            DELIVERED · 2:34 AM · {Math.floor(interpolate(frame, [20, 60], [0.4, 0.8], { extrapolateRight: "clamp" }) * 10) / 10}s after the missed call
          </p>
        </div>
      </div>

      {/* Big stat */}
      <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center", opacity: statOpacity, transform: `translateY(${statY}px)` }}>
        <p style={{ margin: 0, fontSize: 24, color: "#94a3b8", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 600 }}>That customer just stayed yours.</p>
        <p style={{ margin: "12px 0 0", fontSize: 70, fontWeight: 900, color: "#10b981", letterSpacing: "-0.02em" }}>
          +$1,800 emergency · Saved
        </p>
      </div>
    </AbsoluteFill>
  );
};
