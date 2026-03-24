import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: oswald } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const ORANGE = "#E8621A";

export const CTAScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orange bar grows from center
  const barWidth = interpolate(
    spring({ frame, fps, config: { damping: 15, stiffness: 100 } }),
    [0, 1], [0, 100]
  );

  // M² logo
  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 150 } });
  const logoOp = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Main text
  const t1Op = interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t1Y = interpolate(spring({ frame: frame - 25, fps, config: { damping: 20 } }), [0, 1], [50, 0]);

  // "14-Day Free Trial"
  const trialScale = spring({ frame: frame - 50, fps, config: { damping: 10, stiffness: 150 } });
  const trialOp = interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Price
  const priceOp = interpolate(frame, [70, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const priceY = interpolate(spring({ frame: frame - 70, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  // Features
  const features = ["AI Workout Generator", "Fix It Rehab Engine", "Prove It PR Zone", "Exercise Video Library"];

  // URL
  const urlOp = interpolate(frame, [100, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtle pulse on trial box
  const pulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.97, 1.03]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      {/* Big orange glow behind */}
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${ORANGE}12 0%, transparent 70%)`,
        filter: "blur(80px)",
      }} />

      {/* Orange accent bar */}
      <div style={{
        position: "absolute", top: 550,
        width: `${barWidth}%`, height: 4,
        background: ORANGE, borderRadius: 2,
        left: `${(100 - barWidth) / 2}%`,
      }} />

      {/* Logo */}
      <div style={{
        opacity: logoOp, transform: `scale(${logoScale})`, marginBottom: 30,
      }}>
        <div style={{
          fontFamily: oswald, fontSize: 100, fontWeight: 700, color: "white",
          lineHeight: 1, letterSpacing: -2,
        }}>
          M<span style={{ fontSize: 60, verticalAlign: "super", color: ORANGE }}>²</span>
        </div>
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: oswald, fontSize: 58, fontWeight: 700, color: "white",
        textTransform: "uppercase", textAlign: "center", lineHeight: 1.15,
        opacity: t1Op, transform: `translateY(${t1Y}px)`, marginBottom: 30, letterSpacing: 2,
      }}>
        Real Coaching.{"\n"}
        <span style={{ color: ORANGE }}>Not Generic AI.</span>
      </div>

      {/* Trial badge */}
      <div style={{
        opacity: trialOp, transform: `scale(${trialScale * pulse})`,
        background: ORANGE, padding: "16px 40px", marginBottom: 30,
      }}>
        <span style={{
          fontFamily: oswald, fontSize: 36, fontWeight: 700, color: "white",
          textTransform: "uppercase", letterSpacing: 4,
        }}>
          14-Day Free Trial
        </span>
      </div>

      {/* Price */}
      <div style={{
        opacity: priceOp, transform: `translateY(${priceY}px)`,
        textAlign: "center", marginBottom: 30,
      }}>
        <span style={{ fontFamily: oswald, fontSize: 44, fontWeight: 700, color: "white" }}>
          Starting at{" "}
        </span>
        <span style={{ fontFamily: oswald, fontSize: 44, fontWeight: 700, color: ORANGE }}>
          $19.99/mo
        </span>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 40 }}>
        {features.map((f, i) => {
          const delay = 85 + i * 5;
          const op = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const scale = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 200 } });
          return (
            <div key={i} style={{
              opacity: op, transform: `scale(${scale})`,
              background: "#111", border: "1px solid #333", padding: "8px 16px",
            }}>
              <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: "#ccc" }}>
                {f}
              </span>
            </div>
          );
        })}
      </div>

      {/* URL */}
      <div style={{
        opacity: urlOp,
        fontFamily: inter, fontSize: 24, fontWeight: 600, color: "#666",
        letterSpacing: 2,
      }}>
        mattmichelstraining.lovable.app
      </div>
    </AbsoluteFill>
  );
};
