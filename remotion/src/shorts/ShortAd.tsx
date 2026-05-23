import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { ShortConfig } from "./ShortsConfig";

const { fontFamily: oswald } = loadOswald("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const Check = ({ color }: { color: string }) => (
  <svg width="42" height="42" viewBox="0 0 42 42">
    <circle cx="21" cy="21" r="20" fill={color} />
    <path d="M12 22 L18 28 L30 14" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Hook: React.FC<{ cfg: ShortConfig }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const op = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ opacity: op, transform: `scale(${0.8 + s * 0.2})`, textAlign: "center" }}>
        <div style={{ fontFamily: oswald, fontSize: 140, color: "white", lineHeight: 1.05, fontWeight: 700, textTransform: "uppercase" }}>
          {cfg.hook}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Beat: React.FC<{ cfg: ShortConfig; text: string; idx: number }> = ({ cfg, text, idx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  const y = interpolate(s, [0, 1], [60, 0]);
  const op = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ opacity: op, transform: `translateY(${y}px)`, textAlign: "center", display: "flex", gap: 30, alignItems: "center", flexDirection: "column" }}>
        <Check color={cfg.accent} />
        <div style={{ fontFamily: oswald, fontSize: 88, color: "white", lineHeight: 1.15, fontWeight: 700, textTransform: "uppercase", maxWidth: 920 }}>
          {text}
        </div>
        <div style={{ fontFamily: inter, fontSize: 32, color: cfg.accent, fontWeight: 600 }}>
          Step {idx + 1}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Proof: React.FC<{ cfg: ShortConfig }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ opacity: op, textAlign: "center", borderLeft: `8px solid ${cfg.accent}`, paddingLeft: 40 }}>
        <div style={{ fontFamily: inter, fontSize: 56, color: "white", fontWeight: 600, lineHeight: 1.3, maxWidth: 900 }}>
          "{cfg.proof}"
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTA: React.FC<{ cfg: ShortConfig }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.97, 1.03]);
  const s = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60, gap: 40 }}>
      <div style={{ fontFamily: oswald, fontSize: 64, color: cfg.accent, fontWeight: 700, letterSpacing: 4, opacity: s }}>
        {cfg.logo}
      </div>
      <div style={{ background: cfg.accent, padding: "30px 50px", transform: `scale(${pulse})`, opacity: s }}>
        <div style={{ fontFamily: oswald, fontSize: 60, color: cfg.bg, fontWeight: 700, textAlign: "center", textTransform: "uppercase" }}>
          {cfg.ctaLine1}
        </div>
      </div>
      <div style={{ fontFamily: inter, fontSize: 48, color: "white", fontWeight: 700, opacity: s }}>
        👉 {cfg.ctaLine2}
      </div>
      <div style={{ fontFamily: inter, fontSize: 28, color: "#888", marginTop: 20, opacity: s }}>
        Link in description + pinned comment
      </div>
    </AbsoluteFill>
  );
};

export const ShortAd: React.FC<{ cfg: ShortConfig }> = ({ cfg }) => {
  return (
    <AbsoluteFill style={{ background: cfg.bg }}>
      <Sequence durationInFrames={60}><Hook cfg={cfg} /></Sequence>
      {cfg.beats.map((b, i) => (
        <Sequence key={i} from={60 + i * 75} durationInFrames={75}>
          <Beat cfg={cfg} text={b} idx={i} />
        </Sequence>
      ))}
      <Sequence from={60 + cfg.beats.length * 75} durationInFrames={90}>
        <Proof cfg={cfg} />
      </Sequence>
      <Sequence from={150 + cfg.beats.length * 75} durationInFrames={120}>
        <CTA cfg={cfg} />
      </Sequence>
    </AbsoluteFill>
  );
};
