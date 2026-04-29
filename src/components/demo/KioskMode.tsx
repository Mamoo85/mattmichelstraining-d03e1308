import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Presentation-grade kiosk mode for /demo/:slug.
 *
 * Activated by ?kiosk=1. While active:
 *  - Requests browser Fullscreen API (no chrome / address bar)
 *  - Acquires Screen Wake Lock (display never sleeps mid-pitch)
 *  - Locks scroll on html/body, hides app nav
 *  - Adds env(safe-area-inset-*) padding for notched displays / iPad
 *  - Hides the cursor after 3s of inactivity (presentation polish)
 *  - Re-enters fullscreen on click if user / ESC dropped out
 */
export function useKioskMode() {
  const [kiosk, setKiosk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (document.fullscreenElement) return;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {
      /* user gesture required — handled by overlay click */
    }
  }, []);

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
      if (nav.wakeLock && !wakeLockRef.current) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      /* unsupported / denied — non-fatal */
    }
  }, []);

  useEffect(() => {
    const isKiosk = new URLSearchParams(window.location.search).get("kiosk") === "1";
    setKiosk(isKiosk);
    if (!isKiosk) return;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.classList.add("kiosk-mode-body");
    const nav = document.querySelector("nav");
    const prevNavDisplay = nav ? (nav as HTMLElement).style.display : "";
    if (nav) (nav as HTMLElement).style.display = "none";

    // First fullscreen attempt (works if reload was triggered by user gesture in same tab)
    requestFullscreen();
    acquireWakeLock();

    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) acquireWakeLock();
    };
    document.addEventListener("fullscreenchange", onFsChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cursor auto-hide after idle
    let idleTimer: number | undefined;
    const showCursor = () => {
      document.body.style.cursor = "";
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        document.body.style.cursor = "none";
      }, 3000);
    };
    showCursor();
    window.addEventListener("mousemove", showCursor);
    window.addEventListener("touchstart", showCursor, { passive: true });

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.cursor = "";
      document.body.classList.remove("kiosk-mode-body");
      if (nav) (nav as HTMLElement).style.display = prevNavDisplay;
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", showCursor);
      window.removeEventListener("touchstart", showCursor);
      window.clearTimeout(idleTimer);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [requestFullscreen, acquireWakeLock]);

  return { kiosk, isFullscreen, requestFullscreen };
}

/**
 * Floating overlay shown when kiosk=1 but fullscreen hasn't been granted yet
 * (browsers require a user gesture). One click and the demo goes truly edge-to-edge.
 */
export function FullscreenPrompt({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      onClick={onEnter}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(6, 14, 26, 0.94)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 16 }}>⛶</div>
      <p style={{ margin: 0, fontWeight: 900, fontSize: 28, letterSpacing: "-0.5px" }}>Tap to Enter Presentation Mode</p>
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Fullscreen · Wake Lock · No Distractions
      </p>
    </div>
  );
}

/**
 * "Start Demo" floating button — visible only when NOT in kiosk mode.
 */
export function StartDemoButton() {
  const enter = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("kiosk", "1");
    window.location.href = url.toString();
  };

  return (
    <button
      onClick={enter}
      style={{
        position: "fixed",
        bottom: "calc(24px + env(safe-area-inset-bottom))",
        right: "calc(24px + env(safe-area-inset-right))",
        zIndex: 9999,
        padding: "14px 24px",
        borderRadius: 50,
        border: "2px solid #00d4ff",
        background: "linear-gradient(135deg, #00d4ff, #0891b2)",
        color: "#001520",
        fontWeight: 900,
        fontSize: 14,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        boxShadow: "0 10px 40px #00d4ff60, 0 0 0 0 #00d4ff",
        animation: "kioskPulse 2.4s ease-in-out infinite",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>▶</span> Start Demo
    </button>
  );
}

/**
 * "Exit kiosk" subtle control — visible in kiosk mode only.
 * Removes the param and reloads (which also drops fullscreen + wake lock via effect cleanup).
 */
export function ExitKioskButton() {
  const exit = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("kiosk");
    window.location.href = url.toString();
  };
  return (
    <button
      onClick={exit}
      style={{
        position: "fixed",
        top: "calc(16px + env(safe-area-inset-top))",
        right: "calc(16px + env(safe-area-inset-right))",
        zIndex: 9999,
        padding: "8px 14px",
        borderRadius: 20,
        border: "1px solid #1e3a5f",
        background: "#0a1628",
        color: "#64748b",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        opacity: 0.4,
        transition: "opacity 0.2s",
      }}
      onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")}
      onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.4")}
    >
      ✕ Exit Kiosk
    </button>
  );
}

export const KIOSK_GLOBAL_STYLES = `
  @keyframes kioskPulse {
    0%, 100% { box-shadow: 0 10px 40px #00d4ff60, 0 0 0 0 #00d4ff80 }
    50% { box-shadow: 0 10px 40px #00d4ff80, 0 0 0 16px #00d4ff00 }
  }
  @keyframes pageFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .kiosk-mode {
    animation: pageFadeIn 600ms ease-out;
    min-height: 100vh;
    min-height: 100dvh;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    box-sizing: border-box;
  }
  .kiosk-mode header[data-demo-header] {
    display: none !important;
  }
  body.kiosk-mode-body {
    overscroll-behavior: none;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  body.kiosk-mode-body nav,
  body.kiosk-mode-body [data-app-navbar],
  body.kiosk-mode-body [data-bottom-tabs],
  body.kiosk-mode-body [data-lovable-badge],
  body.kiosk-mode-body #lovable-badge {
    display: none !important;
  }
  /* Ensure Fullscreen API backdrop is brand-dark, not white */
  :fullscreen, ::backdrop {
    background: #060e1a;
  }
`;
