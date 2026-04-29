import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene5Competitor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splitProgress = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const leftX = interpolate(splitProgress, [0, 1], [-300, 0]);
  const rightX = interpolate(splitProgress, [0, 1], [300, 0]);

  const verdictOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" });
  const verdictScale = spring({ frame: frame - 60, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "Inter, sans-serif", display: "flex" }}>
      {/* LEFT: Pat (winner) */}
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, #001520, #0a1628)",
        transform: `translateX(${leftX}px)`,
        padding: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        borderRight: "2px solid #00d4ff60"
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #00d4ff15 0%, transparent 60%)" }} />
        <p style={{ margin: 0, fontSize: 18, color: "#00d4ff", fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase" }}>D.J. Conley</p>
        <p style={{ margin: "20px 0 30px", fontSize: 60, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.1 }}>
          Customer<br /><span style={{ color: "#10b981" }}>responded ✓</span>
        </p>
        <div style={{ padding: "20px 30px", background: "#10b98115", border: "2px solid #10b981", borderRadius: 20, color: "#10b981", fontSize: 24, fontWeight: 800 }}>
          📞 Callback at 2:42 AM
        </div>
        <p style={{ margin: "30px 0 0", fontSize: 20, color: "#94a3b8", textAlign: "center" }}>"You guys actually answered."</p>
      </div>

      {/* RIGHT: Competitor (loser) */}
      <div style={{
        flex: 1,
        background: "#0a0a0a",
        transform: `translateX(${rightX}px)`,
        padding: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        filter: "grayscale(0.6)"
      }}>
        <p style={{ margin: 0, fontSize: 18, color: "#64748b", fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase" }}>Competitor down the road</p>
        <p style={{ margin: "20px 0 30px", fontSize: 60, fontWeight: 900, color: "#475569", textAlign: "center", lineHeight: 1.1 }}>
          Voicemail<br /><span style={{ color: "#dc2626" }}>still unread</span>
        </p>
        <div style={{ padding: "20px 30px", background: "#1a1a1a", border: "2px solid #1e293b", borderRadius: 20, color: "#475569", fontSize: 24, fontWeight: 700 }}>
          💤 Heard it at 9:14 AM
        </div>
        <p style={{ margin: "30px 0 0", fontSize: 20, color: "#475569", textAlign: "center" }}>The job was already booked.</p>
      </div>

      {/* Verdict overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: verdictOpacity,
        transform: `scale(${verdictScale})`,
        pointerEvents: "none"
      }}>
        <div style={{
          background: "rgba(10, 22, 40, 0.92)",
          backdropFilter: "blur(20px)",
          border: "2px solid #00d4ff",
          borderRadius: 30,
          padding: "50px 80px",
          textAlign: "center",
          boxShadow: "0 0 100px #00d4ff60"
        }}>
          <p style={{ margin: 0, fontSize: 22, color: "#00d4ff", fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase" }}>The 60-Second Difference</p>
          <p style={{ margin: "20px 0 0", fontSize: 80, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
            Pat won the job.
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
