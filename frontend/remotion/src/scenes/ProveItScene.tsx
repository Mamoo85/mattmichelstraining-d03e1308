import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: oswald } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const ORANGE = "#E8621A";
const GREEN = "#22C55E";
const RED = "#EF4444";

const PRS = [
  { lift: "Back Squat 3RM", weight: "315 lbs", status: "approved", note: "Full depth. Clean lockout. ✅", color: GREEN },
  { lift: "Bench Press 5RM", weight: "225 lbs", status: "approved", note: "Good pause. Solid. ✅", color: GREEN },
  { lift: "Deadlift 3RM", weight: "405 lbs", status: "denied", note: "Hitched at lockout. Resubmit. ❌", color: RED },
];

export const ProveItScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeScale = spring({ frame, fps, config: { damping: 15, stiffness: 200 } });
  const badgeOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 20 } }), [0, 1], [40, 0]);

  const subtitleOp = interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Steps
  const steps = [
    { icon: "📹", label: "Film It", desc: "No video = no record" },
    { icon: "👁️", label: "Coach Reviews", desc: "Matt watches every rep" },
    { icon: "✅", label: "Approved or Denied", desc: "Half reps don't count" },
  ];

  return (
    <AbsoluteFill style={{ padding: 50, justifyContent: "center" }}>
      {/* Badge */}
      <div style={{
        opacity: badgeOp, transform: `scale(${badgeScale})`,
        marginBottom: 20,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
          padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: 3 }}>
            🔒 Zero Cheating Policy
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: oswald, fontSize: 56, fontWeight: 700, color: "white",
        textTransform: "uppercase", lineHeight: 1.15, letterSpacing: 1,
        opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 10,
      }}>
        You Don't Just{"\n"}Log a PR.{"\n"}
        <span style={{ color: ORANGE }}>You Prove It.</span>
      </div>

      <div style={{
        fontFamily: inter, fontSize: 22, color: "#888", marginBottom: 30,
        opacity: subtitleOp, lineHeight: 1.5,
      }}>
        Every PR requires video proof.{"\n"}Coach Matt approves — or denies.
      </div>

      {/* 3 Steps */}
      <div style={{ display: "flex", gap: 12, marginBottom: 30 }}>
        {steps.map((step, i) => {
          const delay = 40 + i * 10;
          const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(
            spring({ frame: frame - delay, fps, config: { damping: 15 } }),
            [0, 1], [30, 0]
          );
          return (
            <div key={i} style={{
              flex: 1, background: "#111", border: "1px solid #222",
              padding: 16, opacity: op, transform: `translateY(${y}px)`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{step.icon}</div>
              <div style={{ fontFamily: inter, fontSize: 16, fontWeight: 700, color: "white", marginBottom: 4 }}>
                {step.label}
              </div>
              <div style={{ fontFamily: inter, fontSize: 13, color: "#777" }}>{step.desc}</div>
            </div>
          );
        })}
      </div>

      {/* PR Cards */}
      <div style={{ background: "#111", border: "1px solid #222", padding: 16 }}>
        {PRS.map((pr, i) => {
          const delay = 75 + i * 10;
          const op = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(
            spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 200 } }),
            [0, 1], [30, 0]
          );
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: i < PRS.length - 1 ? "1px solid #1a1a1a" : "none",
              opacity: op, transform: `translateX(${x}px)`,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: pr.color, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: inter, fontSize: 18, fontWeight: 700, color: "white" }}>
                    {pr.lift}
                  </span>
                  <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: ORANGE }}>
                    {pr.weight}
                  </span>
                </div>
                <div style={{ fontFamily: inter, fontSize: 14, color: "#777", marginTop: 2 }}>
                  {pr.note}
                </div>
              </div>
              <span style={{
                fontFamily: inter, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                color: pr.color, background: `${pr.color}20`, padding: "4px 10px", letterSpacing: 1,
              }}>
                {pr.status}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
