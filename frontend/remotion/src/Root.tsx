import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { MissedCallSizzle } from "./scenes/MissedCallSizzle";

export const RemotionRoot = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={630}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="djconley-sizzle"
      component={MissedCallSizzle}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
