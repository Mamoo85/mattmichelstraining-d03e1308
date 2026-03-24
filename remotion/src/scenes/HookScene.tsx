import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: oswald } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const ORANGE = "#E8621A";

export const HookScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orange line wipe
  const lineWidth = interpolate(frame, [0, 20], [0, 100], { extrapolateRight: "clamp" });

  // M² logo
  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 150 } });
  const logoOpacity = interpolate(frame, [10, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Main text
  const text1Y = interpolate(
    spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 200 } }),
    [0, 1], [60, 0]
  );
  const text1Op = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const text2Y = interpolate(
    spring({ frame: frame - 42, fps, config: { damping: 20, stiffness: 200 } }),
    [0, 1], [60, 0]
  );
  const text2Op = interpolate(frame, [42, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtitle
  const subOp = interpolate(frame, [65, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(
    spring({ frame: frame - 65, fps, config: { damping: 20 } }),
    [0, 1], [30, 0]
  );

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      {/* Orange accent line */}
      <div style={{
        position: "absolute", top: 700, left: 60,
        width: `${lineWidth}%`, height: 4,
        background: ORANGE, borderRadius: 2,
      }} />

      {/* Logo */}
      <div style={{
        opacity: logoOpacity,
        transform: `scale(${logoScale})`,
        marginBottom: 40,
      }}>
        <div style={{
          fontFamily: oswald, fontSize: 120, fontWeight: 700, color: "white",
          lineHeight: 1, letterSpacing: -2,
        }}>
          M<span style={{ fontSize: 70, verticalAlign: "super", color: ORANGE }}>²</span>
        </div>
      </div>

      {/* Main headline */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: oswald, fontSize: 72, fontWeight: 700, color: "white",
          textTransform: "uppercase", lineHeight: 1.1, letterSpacing: 2,
          opacity: text1Op, transform: `translateY(${text1Y}px)`,
        }}>
          Your Coach.
        </div>
        <div style={{
          fontFamily: oswald, fontSize: 72, fontWeight: 700, color: ORANGE,
          textTransform: "uppercase", lineHeight: 1.1, letterSpacing: 2,
          opacity: text2Op, transform: `translateY(${text2Y}px)`,
        }}>
          Your Phone.
        </div>
      </div>

      {/* Subtitle */}
      <div style={{
        fontFamily: inter, fontSize: 28, color: "#999",
        marginTop: 40, textAlign: "center", lineHeight: 1.5,
        opacity: subOp, transform: `translateY(${subY}px)`,
        fontWeight: 400,
      }}>
        20 years of sports-science coaching{"\n"}delivered to your pocket.
      </div>
    </AbsoluteFill>
  );
};
