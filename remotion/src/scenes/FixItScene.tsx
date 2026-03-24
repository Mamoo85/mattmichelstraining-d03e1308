import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: oswald } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const PURPLE = "#7C3AED";
const ORANGE = "#E8621A";

const EXERCISES = [
  { n: 1, title: "Lacrosse Ball Glute Release", phase: "TISSUE RELEASE", sets: "2×60s/side", color: "#3B82F6" },
  { n: 2, title: "90/90 Hip Switch", phase: "MOBILITY", sets: "2×8 each", color: "#F59E0B" },
  { n: 3, title: "McGill Big 3 — Bird Dog", phase: "CORRECTIVE", sets: "3×8 each", color: PURPLE },
  { n: 4, title: "Dead Bug Anti-Extension", phase: "CORRECTIVE", sets: "3×8 each", color: PURPLE },
];

export const FixItScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = spring({ frame, fps, config: { damping: 15, stiffness: 200 } });

  const titleOp = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 20 } }), [0, 1], [40, 0]);

  const inputText = "My lower back tightens up during heavy squats";
  const charsShown = Math.min(Math.floor(Math.max(0, frame - 30) * 1.5), inputText.length);
  const inputOp = interpolate(frame, [25, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const exerciseStartFrame = 60;

  return (
    <AbsoluteFill style={{ padding: 50, justifyContent: "center" }}>
      {/* Purple glow */}
      <div style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${PURPLE}15 0%, transparent 70%)`,
        top: 300, left: -100, filter: "blur(60px)",
      }} />

      {/* Badge */}
      <div style={{
        opacity: badgeOp, transform: `scale(${badgeScale})`,
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
      }}>
        <div style={{
          background: `${PURPLE}20`, border: `1px solid ${PURPLE}40`,
          padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: 3 }}>
            🩹 Fix It Engine
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: oswald, fontSize: 52, fontWeight: 700, color: "white",
        textTransform: "uppercase", lineHeight: 1.15, letterSpacing: 1,
        opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 30,
      }}>
        Describe Your Pain.{"\n"}
        <span style={{ color: PURPLE }}>Get a Rehab Protocol.</span>
      </div>

      {/* Mock input */}
      <div style={{
        opacity: inputOp,
        background: "#111", border: `1px solid ${PURPLE}30`, padding: 20,
        marginBottom: 25,
      }}>
        <span style={{ fontFamily: inter, fontSize: 22, color: "#aaa", fontStyle: "italic" }}>
          {inputText.slice(0, charsShown)}
          {charsShown < inputText.length && (
            <span style={{ opacity: frame % 15 < 8 ? 1 : 0, color: PURPLE }}>|</span>
          )}
        </span>
      </div>

      {/* Protocol */}
      <div style={{ background: "#111", border: "1px solid #222", padding: 20 }}>
        <div style={{
          fontFamily: inter, fontSize: 20, fontWeight: 700, color: "white", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ color: PURPLE }}>🔧</span> Low Back Rehab Protocol
        </div>
        {EXERCISES.map((ex, i) => {
          const delay = exerciseStartFrame + i * 8;
          const op = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(
            spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 200 } }),
            [0, 1], [40, 0]
          );
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: i < EXERCISES.length - 1 ? "1px solid #1a1a1a" : "none",
              opacity: op, transform: `translateX(${x}px)`,
            }}>
              <span style={{ fontFamily: inter, fontSize: 18, fontWeight: 700, color: PURPLE, width: 28, textAlign: "right" }}>
                {ex.n}.
              </span>
              <span style={{ fontFamily: inter, fontSize: 20, fontWeight: 600, color: "white", flex: 1 }}>
                {ex.title}
              </span>
              <span style={{
                fontFamily: inter, fontSize: 11, fontWeight: 700, color: ex.color,
                background: `${ex.color}20`, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 1,
              }}>
                {ex.phase}
              </span>
              <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: PURPLE, width: 90, textAlign: "right" }}>
                {ex.sets}
              </span>
            </div>
          );
        })}
        <div style={{
          fontFamily: inter, fontSize: 14, color: "#666", fontStyle: "italic", marginTop: 10,
          opacity: interpolate(frame, [95, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          Based on McGill protocols + Coach Matt's corrective system
        </div>
      </div>
    </AbsoluteFill>
  );
};
