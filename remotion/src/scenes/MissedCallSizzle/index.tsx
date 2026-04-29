import { AbsoluteFill, Series } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { Scene1Clock } from "./Scene1Clock";
import { Scene2IncomingCall } from "./Scene2IncomingCall";
import { Scene3Voicemail } from "./Scene3Voicemail";
import { Scene4AutoText } from "./Scene4AutoText";
import { Scene5Competitor } from "./Scene5Competitor";
import { Scene6Stack } from "./Scene6Stack";
import { Scene7EndCard } from "./Scene7EndCard";

loadFont("normal", { weights: ["200", "300", "400", "500", "600", "700", "800", "900"], subsets: ["latin"] });

export const MissedCallSizzle: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Series>
        <Series.Sequence durationInFrames={90}><Scene1Clock /></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Scene2IncomingCall /></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Scene3Voicemail /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><Scene4AutoText /></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Scene5Competitor /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><Scene6Stack /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><Scene7EndCard /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
