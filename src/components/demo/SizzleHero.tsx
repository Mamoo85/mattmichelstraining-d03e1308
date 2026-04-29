import { useRef, useState, useEffect } from "react";

/**
 * Cinematic sizzle reel hero — autoplays muted in kiosk mode, click-to-unmute.
 * Falls back to a poster card if the MP4 isn't available yet.
 */
export default function SizzleHero({
  src,
  kiosk,
  companyName,
}: {
  src?: string;
  kiosk: boolean;
  companyName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!src) return;
    // Probe — if HEAD fails, fall back to poster.
    fetch(src, { method: "HEAD" })
      .then((r) => {
        if (!r.ok) setErrored(true);
      })
      .catch(() => setErrored(true));
  }, [src]);

  if (!src || errored) {
    // Cinematic poster fallback — even without the MP4 it looks intentional.
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          maxHeight: kiosk ? "62vh" : 420,
          background:
            "radial-gradient(ellipse at 30% 30%, #00d4ff20 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, #dc262620 0%, transparent 60%), #060e1a",
          border: "1px solid #1e3a5f",
          borderRadius: 16,
          marginBottom: 20,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: "#dc2626", fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase" }}>
          ⚠ 2:34 AM · Tuesday · Troy MI
        </p>
        <p
          style={{
            margin: "20px 0 12px",
            fontSize: kiosk ? 64 : 42,
            fontWeight: 900,
            color: "#fff",
            textAlign: "center",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          A boiler just failed.
          <br />
          <span style={{ color: "#00d4ff" }}>Pat's about to win the job.</span>
        </p>
        <p style={{ margin: 0, fontSize: 16, color: "#94a3b8", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}>
          ▶ Sizzle reel rendering — preview live
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: kiosk ? "62vh" : 420,
        background: "#000",
        border: "1px solid #1e3a5f",
        borderRadius: 16,
        marginBottom: 20,
        overflow: "hidden",
        boxShadow: kiosk ? "0 0 80px #00d4ff20, 0 30px 60px rgba(0,0,0,0.6)" : "0 10px 40px rgba(0,0,0,0.4)",
      }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted={muted}
        loop
        playsInline
        onCanPlay={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* Live tag */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "6px 14px",
          background: "rgba(220, 38, 38, 0.9)",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "0.15em",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "#fff",
            borderRadius: "50%",
            animation: "sizzleBlink 1.4s ease-in-out infinite",
          }}
        />
        LIVE DEMO · {companyName.toUpperCase()}
      </div>
      {/* Mute/unmute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          padding: "8px 14px",
          background: "rgba(10, 22, 40, 0.85)",
          border: "1px solid #00d4ff60",
          color: "#00d4ff",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.1em",
        }}
      >
        {muted ? "🔇 Tap for sound" : "🔊 Sound on"}
      </button>
      <style>{`@keyframes sizzleBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#060e1a",
            color: "#475569",
            fontSize: 14,
            letterSpacing: "0.3em",
          }}
        >
          LOADING…
        </div>
      )}
    </div>
  );
}
