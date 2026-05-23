import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { MissedCallSizzle } from "./scenes/MissedCallSizzle";
import { ShortAd } from "./shorts/ShortAd";
import { SHORTS } from "./shorts/ShortsConfig";

export const RemotionRoot = () => {
  return (
    <>
      <Composition id="main" component={MainVideo} durationInFrames={630} fps={30} width={1080} height={1920} />
      <Composition id="djconley-sizzle" component={MissedCallSizzle} durationInFrames={900} fps={30} width={1920} height={1080} />
      {SHORTS.map((cfg) => {
        const total = 60 + cfg.beats.length * 75 + 90 + 120;
        return (
          <Composition
            key={cfg.id}
            id={cfg.id}
            component={ShortAd}
            defaultProps={{ cfg }}
            durationInFrames={total}
            fps={30}
            width={1080}
            height={1920}
          />
        );
      })}
    </>
  );
};
