import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const PRODUCTS = [
  { name: "FieldDesk", sub: "Dispatch · GPS · Mobile", price: "$199", color: "#00d4ff", icon: "📋" },
  { name: "SiteRadar", sub: "Identify visiting companies", price: "$49", color: "#8b5cf6", icon: "👁" },
  { name: "TechAlert", sub: "MIOSHA license alerts", price: "$99", color: "#f59e0b", icon: "⚡" },
  { name: "Missed-Call Catch", sub: "60-sec auto-text", price: "$99", color: "#dc2626", icon: "📞" },
];

export const Scene6Stack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 20 } });
  const titleY = interpolate(titleSpring, [0, 1], [-40, 0]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #060e1a, #0a1628)", fontFamily: "Inter, sans-serif", padding: 80 }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 50, transform: `translateY(${titleY}px)`, opacity: titleSpring }}>
        <p style={{ margin: 0, fontSize: 22, color: "#00d4ff", fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase" }}>The Full Command Center</p>
        <p style={{ margin: "16px 0 0", fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
          Built for D.J. Conley.
        </p>
      </div>

      {/* Product cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 1500, margin: "0 auto" }}>
        {PRODUCTS.map((p, i) => {
          const cardSpring = spring({ frame: frame - 15 - i * 8, fps, config: { damping: 18, stiffness: 100 } });
          const cardX = interpolate(cardSpring, [0, 1], [i % 2 === 0 ? -200 : 200, 0]);
          const opacity = interpolate(frame, [15 + i * 8, 30 + i * 8], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={p.name} style={{
              transform: `translateX(${cardX}px)`,
              opacity,
              background: "#0a1628",
              border: `2px solid ${p.color}40`,
              borderRadius: 24,
              padding: 36,
              display: "flex",
              alignItems: "center",
              gap: 28,
              position: "relative",
              overflow: "hidden",
              boxShadow: `0 20px 60px ${p.color}15`
            }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: p.color, opacity: 0.08, filter: "blur(30px)" }} />
              <div style={{ width: 90, height: 90, borderRadius: 20, background: `${p.color}20`, border: `2px solid ${p.color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, flexShrink: 0 }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#fff" }}>{p.name}</p>
                <p style={{ margin: "4px 0 0", fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>{p.sub}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: p.color }}>{p.price}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>per month</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div style={{
        marginTop: 50,
        textAlign: "center",
        opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" })
      }}>
        <p style={{ margin: 0, fontSize: 18, color: "#64748b", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>Full stack — total</p>
        <p style={{ margin: "10px 0 0", fontSize: 90, fontWeight: 900, color: "#10b981", letterSpacing: "-0.03em" }}>
          $446<span style={{ fontSize: 36, color: "#94a3b8", fontWeight: 700 }}>/mo</span>
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 22, color: "#94a3b8" }}>
          Less than what you pay <span style={{ color: "#fff", fontWeight: 800, textDecoration: "line-through" }}>eWay</span> for one capability.
        </p>
      </div>
    </AbsoluteFill>
  );
};
