import { useEffect, useRef, useState } from "react";

interface Props {
  /** Section IDs in order. Component scrolls to each one in turn. */
  sectionIds: string[];
  /** Seconds per section. Default 8s. */
  intervalSec?: number;
  /** Enabled by default in kiosk mode; user can toggle. */
  defaultOn?: boolean;
}

/**
 * Auto-advance: scrolls smoothly between sections every N seconds.
 * Renders a top progress bar + bottom-center play/pause + per-section dots.
 * Pauses on user scroll, resumes after 4s of inactivity.
 */
export function AutoAdvance({ sectionIds, intervalSec = 8, defaultOn = true }: Props) {
  const [on, setOn] = useState(defaultOn);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const startRef = useRef<number>(performance.now());
  const pausedAtRef = useRef<number | null>(null);
  const userScrollPausedUntil = useRef<number>(0);

  // Scroll to section when idx changes
  useEffect(() => {
    const id = sectionIds[idx];
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (idx === 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    startRef.current = performance.now();
    setProgress(0);
  }, [idx, sectionIds]);

  // Detect user scroll → temp pause
  useEffect(() => {
    let lastY = window.scrollY;
    let scrollTimer: number | undefined;
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      if (dy > 4) {
        userScrollPausedUntil.current = performance.now() + 4000;
      }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        // settle
      }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimer);
    };
  }, []);

  // Tick progress + advance
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (!on) {
        startRef.current = now - progress * intervalSec * 1000;
        raf = requestAnimationFrame(loop);
        return;
      }
      if (now < userScrollPausedUntil.current) {
        startRef.current = now - progress * intervalSec * 1000;
        raf = requestAnimationFrame(loop);
        return;
      }
      const elapsed = (now - startRef.current) / (intervalSec * 1000);
      if (elapsed >= 1) {
        setIdx((i) => (i + 1) % sectionIds.length);
      } else {
        setProgress(elapsed);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on, intervalSec, sectionIds.length, progress]);

  const goto = (i: number) => {
    setIdx(((i % sectionIds.length) + sectionIds.length) % sectionIds.length);
  };

  return (
    <>
      {/* Top progress bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "rgba(10, 22, 40, 0.6)",
          zIndex: 9997,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(idx / sectionIds.length + progress / sectionIds.length) * 100}%`,
            background: "linear-gradient(90deg, #00d4ff, #10b981)",
            transition: "width 80ms linear",
            boxShadow: "0 0 12px #00d4ff80",
          }}
        />
      </div>

      {/* Bottom controls */}
      <div
        data-demo-autoadvance
        style={{
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9998,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(10, 22, 40, 0.92)",
          backdropFilter: "blur(8px)",
          border: "1px solid #1e3a5f",
          borderRadius: 999,
          padding: "8px 14px",
          color: "#fff",
          fontFamily: "-apple-system, sans-serif",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <button
          onClick={() => goto(idx - 1)}
          aria-label="Previous section"
          style={ctrlBtn}
        >
          ◀
        </button>
        <button
          onClick={() => setOn((o) => !o)}
          aria-label={on ? "Pause auto-advance" : "Play auto-advance"}
          style={{ ...ctrlBtn, color: on ? "#00d4ff" : "#10b981", fontSize: 14 }}
        >
          {on ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => goto(idx + 1)}
          aria-label="Next section"
          style={ctrlBtn}
        >
          ▶
        </button>
        <div style={{ display: "flex", gap: 5, marginLeft: 6 }}>
          {sectionIds.map((id, i) => (
            <button
              key={id}
              onClick={() => goto(i)}
              aria-label={`Go to section ${i + 1}`}
              style={{
                width: i === idx ? 22 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: i === idx ? "#00d4ff" : "#1e3a5f",
                transition: "all 0.25s",
                padding: 0,
              }}
            />
          ))}
        </div>
        <span style={{ color: "#64748b", marginLeft: 6, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10 }}>
          {idx + 1}/{sectionIds.length} · {on ? "Auto" : "Paused"}
        </span>
      </div>
    </>
  );
}

const ctrlBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: 12,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
};
