import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene2IncomingCall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideUp = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const phoneY = interpolate(slideUp, [0, 1], [400, 0]);
  const ringPulse = 1 + Math.sin(frame * 0.5) * 0.06;
  const ringOpacity = interpolate(Math.sin(frame * 0.5), [-1, 1], [0.3, 0.9]);
  const dim = interpolate(frame, [50, 110], [1, 0.4], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      {/* ambient red glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #dc262625 0%, transparent 60%)", opacity: ringOpacity }} />

      <div style={{ transform: `translateY(${phoneY}px) scale(${ringPulse})`, opacity: dim }}>
        {/* iPhone-ish frame */}
        <div style={{
          width: 460,
          height: 920,
          background: "#000",
          borderRadius: 60,
          border: "8px solid #1e293b",
          boxShadow: `0 0 80px #dc2626${Math.floor(ringOpacity * 99)}, 0 30px 60px rgba(0,0,0,0.7)`,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* notch */}
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 130, height: 32, background: "#000", borderRadius: 20 }} />

          <div style={{ marginTop: 80, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, color: "#94a3b8", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>Incoming Call</p>
            <p style={{ margin: "30px 0 8px", fontSize: 32, fontWeight: 800, color: "#fff" }}>(586) 555-0142</p>
            <p style={{ margin: 0, fontSize: 18, color: "#dc2626", fontWeight: 700 }}>Stellantis Warren Truck Plant</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>Mobile · 2:34 AM</p>
          </div>

          {/* Pulsing call icon */}
          <div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 60 }}>
            {[0, 1, 2].map((i) => {
              const ringScale = 1 + ((frame * 0.04 + i * 0.4) % 1.2);
              const ringFade = interpolate((frame * 0.04 + i * 0.4) % 1.2, [0, 1.2], [0.5, 0]);
              return (
                <div key={i} style={{
                  position: "absolute",
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  border: "3px solid #dc2626",
                  transform: `scale(${ringScale})`,
                  opacity: ringFade
                }} />
              );
            })}
            <div style={{ width: 130, height: 130, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60, boxShadow: "0 0 40px #dc262680" }}>
              📞
            </div>
          </div>
        </div>
      </div>

      {/* Bottom caption */}
      <p style={{ position: "absolute", bottom: 60, fontSize: 24, color: "#fff", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" }) }}>
        Plant manager. <span style={{ color: "#dc2626" }}>$1,800 emergency.</span>
      </p>
    </AbsoluteFill>
  );
};
