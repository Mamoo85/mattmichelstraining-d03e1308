import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: oswald } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const ORANGE = "#E8621A";

const EXERCISES = [
  { n: 1, title: "Adductor Foam Roll", phase: "ROLLING", sets: "1×60s", color: "#3B82F6" },
  { n: 2, title: "Cat-Cow / Camel", phase: "WARMUP", sets: "2×8-10", color: "#F59E0B" },
  { n: 3, title: "Goblet Squat w/ Prying", phase: "MAIN", sets: "3×5-8", color: ORANGE },
  { n: 4, title: "DB Floor Press", phase: "MAIN", sets: "3×8-12", color: ORANGE },
  { n: 5, title: "DB Romanian Deadlift", phase: "MAIN", sets: "3×8-12", color: ORANGE },
  { n: 6, title: "RKC Plank", phase: "FINISHER", sets: "3×20-30s", color: "#EF4444" },
  { n: 7, title: "Couch Stretch", phase: "COOLDOWN", sets: "1×60s", color: "#22C55E" },
];

export const GeneratorScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Badge
  const badgeOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = spring({ frame, fps, config: { damping: 15, stiffness: 200 } });

  // Title
  const titleOp = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 20 } }), [0, 1], [40, 0]);

  // Input box - typewriter effect
  const inputText = "I'm 45 and haven't worked out in 5 years";
  const charsShown = Math.min(Math.floor(Math.max(0, frame - 30) * 1.5), inputText.length);
  const inputOp = interpolate(frame, [25, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Exercises stagger in
  const exerciseStartFrame = 65;

  return (
    <AbsoluteFill style={{ padding: 50, justifyContent: "center" }}>
      {/* Badge */}
      <div style={{
        opacity: badgeOp, transform: `scale(${badgeScale})`,
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
      }}>
        <div style={{
          background: `${ORANGE}20`, border: `1px solid ${ORANGE}40`,
          padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontFamily: inter, fontSize: 16, fontWeight: 600, color: ORANGE, textTransform: "uppercase", letterSpacing: 3 }}>
            ✦ AI Workout Generator
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: oswald, fontSize: 52, fontWeight: 700, color: "white",
        textTransform: "uppercase", lineHeight: 1.15, letterSpacing: 1,
        opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 30,
      }}>
        Tell It What You Need.{"\n"}
        <span style={{ color: ORANGE }}>Get a Program in Seconds.</span>
      </div>

      {/* Mock input */}
      <div style={{
        opacity: inputOp,
        background: "#111", border: "1px solid #333", padding: 20,
        marginBottom: 25,
      }}>
        <span style={{ fontFamily: inter, fontSize: 22, color: "#aaa", fontStyle: "italic" }}>
          {inputText.slice(0, charsShown)}
          {charsShown < inputText.length && (
            <span style={{ opacity: frame % 15 < 8 ? 1 : 0, color: ORANGE }}>|</span>
          )}
        </span>
      </div>

      {/* Generated workout */}
      <div style={{
        background: "#111", border: "1px solid #222", padding: 20,
      }}>
        {EXERCISES.map((ex, i) => {
          const delay = exerciseStartFrame + i * 6;
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
              <span style={{ fontFamily: inter, fontSize: 18, fontWeight: 700, color: ORANGE, width: 28, textAlign: "right" }}>
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
              <span style={{ fontFamily: inter, fontSize: 18, fontWeight: 600, color: ORANGE, width: 90, textAlign: "right" }}>
                {ex.sets}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
