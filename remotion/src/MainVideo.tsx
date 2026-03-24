import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { HookScene } from "./scenes/HookScene";
import { GeneratorScene } from "./scenes/GeneratorScene";
import { FixItScene } from "./scenes/FixItScene";
import { ProveItScene } from "./scenes/ProveItScene";
import { CTAScene } from "./scenes/CTAScene";

const BG_COLOR = "#050507";
const ORANGE = "#E8621A";

const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phone floats and rotates subtly throughout
  const floatY = Math.sin(frame * 0.04) * 12;
  const floatX = Math.cos(frame * 0.03) * 6;

  // Entrance: fly in from distance with 3D rotation
  const enterProgress = spring({ frame, fps, config: { damping: 18, stiffness: 60, mass: 1.5 } });
  const initialZ = interpolate(enterProgress, [0, 1], [-800, 0]);
  const initialRotateX = interpolate(enterProgress, [0, 1], [25, 0]);
  const initialRotateY = interpolate(enterProgress, [0, 1], [-15, 0]);
  const initialOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Gentle continuous 3D rotation
  const rotY = Math.sin(frame * 0.015) * 3;
  const rotX = Math.cos(frame * 0.012) * 2;

  return (
    <AbsoluteFill style={{
      perspective: 1800,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{
        opacity: initialOpacity,
        transform: `
          translateY(${floatY}px)
          translateX(${floatX}px)
          translateZ(${initialZ}px)
          rotateX(${initialRotateX + rotX}deg)
          rotateY(${initialRotateY + rotY}deg)
        `,
        transformStyle: "preserve-3d",
        width: 420,
        height: 860,
        position: "relative",
      }}>
        {/* Phone body shadow */}
        <div style={{
          position: "absolute",
          inset: -4,
          borderRadius: 48,
          background: "transparent",
          boxShadow: `
            0 40px 100px rgba(0,0,0,0.8),
            0 0 60px ${ORANGE}15,
            0 0 120px ${ORANGE}08
          `,
        }} />

        {/* Phone bezel */}
        <div style={{
          width: "100%",
          height: "100%",
          borderRadius: 44,
          border: "3px solid #333",
          background: "linear-gradient(145deg, #1a1a1e, #111114)",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Status bar */}
          <div style={{
            height: 44,
            background: "#0a0a0c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 10,
          }}>
            {/* Notch / Dynamic Island */}
            <div style={{
              width: 100,
              height: 28,
              borderRadius: 14,
              background: "#000",
              border: "1px solid #222",
            }} />
          </div>

          {/* Screen content area */}
          <div style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            background: "#0a0a0c",
          }}>
            {/* Scale content to fit phone screen */}
            <div style={{
              transform: "scale(0.388)",
              transformOrigin: "top left",
              width: 1080,
              height: 1920 - 113,
              position: "relative",
            }}>
              {children}
            </div>
          </div>

          {/* Home indicator */}
          <div style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 4,
            borderRadius: 2,
            background: "#444",
            zIndex: 10,
          }} />
        </div>

        {/* Reflection highlight on bezel */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          borderRadius: "44px 44px 0 0",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      {/* Background particles / floating dots */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {Array.from({ length: 20 }).map((_, i) => {
          const speed = 0.3 + (i % 5) * 0.15;
          const x = 100 + (i * 137) % 880;
          const startY = (i * 231) % 1920;
          const y = (startY + frame * speed) % 2100 - 100;
          const size = 2 + (i % 3);
          const opacity = 0.08 + (i % 4) * 0.04;
          return (
            <div key={i} style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 3 === 0 ? ORANGE : "white",
              opacity,
              left: x,
              top: y,
            }} />
          );
        })}

        {/* Large ambient glows */}
        <div style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}08 0%, transparent 70%)`,
          top: interpolate(frame, [0, 630], [-200, 400]),
          right: -200,
          filter: "blur(80px)",
        }} />
        <div style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}05 0%, transparent 70%)`,
          bottom: interpolate(frame, [0, 630], [200, -300]),
          left: -100,
          filter: "blur(60px)",
        }} />
      </AbsoluteFill>

      {/* Phone with content inside */}
      <PhoneFrame>
        <TransitionSeries>
          <TransitionSeries.Sequence durationInFrames={120}>
            <HookScene />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
          />
          <TransitionSeries.Sequence durationInFrames={150}>
            <GeneratorScene />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
          />
          <TransitionSeries.Sequence durationInFrames={135}>
            <FixItScene />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
          />
          <TransitionSeries.Sequence durationInFrames={135}>
            <ProveItScene />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
          />
          <TransitionSeries.Sequence durationInFrames={150}>
            <CTAScene />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </PhoneFrame>
    </AbsoluteFill>
  );
};
