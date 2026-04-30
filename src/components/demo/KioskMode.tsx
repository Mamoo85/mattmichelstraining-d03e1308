import { useEffect, useRef, useState, useCallback } from "react";
import { demoAnalytics } from "./DemoAnalytics";

const SS_KIOSK_KEY = "demo:kiosk:active";
const SS_OVERLAY_DISMISSED = "demo:kiosk:overlayDismissed";

/**
 * Presentation-grade kiosk mode for /demo/:slug.
 *
 * Activated by ?kiosk=1 OR sessionStorage flag (so reloads/auto-refresh stay in kiosk).
 * While active:
 *  - Fullscreen API + Screen Wake Lock with auto-retry on loss
 *  - Locks scroll, hides app nav
 *  - Disables pull-to-refresh, double-tap zoom, back-swipe gestures
 *  - safe-area padding for notched displays
 *  - Cursor auto-hide after 3s idle
 *  - sessionStorage persistence so reloads boot directly back into kiosk
 */
export function useKioskMode() {
  const [kiosk, setKiosk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const retryTimerRef = useRef<number | undefined>(undefined);

  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (document.fullscreenElement) return;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      sessionStorage.setItem(SS_OVERLAY_DISMISSED, "1");
      setOverlayDismissed(true);
    } catch {
      /* user gesture required — handled by overlay click */
    }
  }, []);

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
      if (nav.wakeLock && !wakeLockRef.current) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      }
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    const urlKiosk = new URLSearchParams(window.location.search).get("kiosk") === "1";
    const ssKiosk = sessionStorage.getItem(SS_KIOSK_KEY) === "1";
    const isKiosk = urlKiosk || ssKiosk;
    setKiosk(isKiosk);
    if (!isKiosk) {
      // Cleanup any stale flags
      sessionStorage.removeItem(SS_OVERLAY_DISMISSED);
      return;
    }

    // Persist + sync URL so reload stays in kiosk even without ?kiosk=1
    sessionStorage.setItem(SS_KIOSK_KEY, "1");
    if (!urlKiosk) {
      const url = new URL(window.location.href);
      url.searchParams.set("kiosk", "1");
      window.history.replaceState({}, "", url.toString());
    }

    setOverlayDismissed(sessionStorage.getItem(SS_OVERLAY_DISMISSED) === "1");

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.classList.add("kiosk-mode-body");
    const nav = document.querySelector("nav");
    const prevNavDisplay = nav ? (nav as HTMLElement).style.display : "";
    if (nav) (nav as HTMLElement).style.display = "none";

    // First fullscreen attempt
    requestFullscreen();
    acquireWakeLock();

    // Watch fullscreen — retry automatically if we lose it (ESC, browser interrupt, etc.)
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        acquireWakeLock();
      } else if (sessionStorage.getItem(SS_KIOSK_KEY) === "1") {
        // Lost fullscreen but still in kiosk → retry shortly. Browsers require a
        // user gesture, so silent attempt may fail; the overlay will surface in that case.
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          requestFullscreen();
        }, 250);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        acquireWakeLock();
        if (!document.fullscreenElement && sessionStorage.getItem(SS_KIOSK_KEY) === "1") {
          requestFullscreen();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Disable double-tap zoom + back-swipe gestures (kiosk-breakers on iOS/Android Chrome)
    let lastTouchEnd = 0;
    const blockDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) e.preventDefault();
      lastTouchEnd = now;
    };
    const blockGesture = (e: Event) => e.preventDefault(); // iOS Safari pinch
    const blockEdgeSwipe = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      // Block touches starting within 25px of left/right edge (back/forward gesture)
      if (t.clientX < 25 || t.clientX > window.innerWidth - 25) e.preventDefault();
    };
    document.addEventListener("touchend", blockDoubleTap, { passive: false });
    document.addEventListener("gesturestart", blockGesture as EventListener, { passive: false });
    document.addEventListener("touchstart", blockEdgeSwipe, { passive: false });

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
      document.removeEventListener("touchend", blockDoubleTap);
      document.removeEventListener("gesturestart", blockGesture as EventListener);
      document.removeEventListener("touchstart", blockEdgeSwipe);
      window.removeEventListener("mousemove", showCursor);
      window.removeEventListener("touchstart", showCursor);
      window.clearTimeout(idleTimer);
      window.clearTimeout(retryTimerRef.current);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [requestFullscreen, acquireWakeLock]);

  return { kiosk, isFullscreen, wakeLockActive, overlayDismissed, requestFullscreen };
}

/**
 * Floating overlay shown when kiosk=1 but fullscreen hasn't been granted yet.
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
    demoAnalytics.recordStartClick();
    sessionStorage.setItem(SS_KIOSK_KEY, "1");
    sessionStorage.removeItem(SS_OVERLAY_DISMISSED);
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
 * Touch-friendly kiosk control cluster:
 *   - Status pill (Fullscreen + Wake Lock indicators)
 *   - Restart button (reload while staying in kiosk)
 *   - Exit button (drop kiosk + fullscreen)
 *
 * All controls are large tap targets (44px+) — no keyboard required.
 */
export function KioskControls({
  isFullscreen,
  wakeLockActive,
}: {
  isFullscreen: boolean;
  wakeLockActive: boolean;
}) {
  const [open, setOpen] = useState(false);

  const restart = () => {
    // Stay in kiosk — sessionStorage flag survives reload
    sessionStorage.setItem(SS_KIOSK_KEY, "1");
    sessionStorage.removeItem(SS_OVERLAY_DISMISSED);
    window.location.reload();
  };

  const exit = () => {
    demoAnalytics.recordExitClick();
    sessionStorage.removeItem(SS_KIOSK_KEY);
    sessionStorage.removeItem(SS_OVERLAY_DISMISSED);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("kiosk");
    window.location.href = url.toString();
  };

  const dotStyle = (on: boolean) => ({
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: on ? "#22c55e" : "#ef4444",
    boxShadow: on ? "0 0 8px #22c55eaa" : "0 0 8px #ef4444aa",
    marginRight: 6,
  });

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top))",
        right: "calc(12px + env(safe-area-inset-right))",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Status + toggle pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Hide kiosk controls" : "Show kiosk controls"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          minHeight: 44,
          borderRadius: 22,
          border: "1px solid #1e3a5f",
          background: "rgba(10, 22, 40, 0.85)",
          backdropFilter: "blur(6px)",
          color: "#e2e8f0",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          opacity: open ? 1 : 0.55,
          transition: "opacity 0.2s",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <span style={dotStyle(isFullscreen)} />
          FS
        </span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <span style={dotStyle(wakeLockActive)} />
          Wake
        </span>
        <span style={{ marginLeft: 4, color: "#64748b" }}>{open ? "▾" : "▸"}</span>
      </button>

      {/* Expanded actions */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={restart}
            style={{
              padding: "12px 18px",
              minHeight: 44,
              minWidth: 140,
              borderRadius: 22,
              border: "1px solid #1e3a5f",
              background: "#0a1628",
              color: "#00d4ff",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ↻ Restart Kiosk
          </button>
          <button
            onClick={exit}
            style={{
              padding: "12px 18px",
              minHeight: 44,
              minWidth: 140,
              borderRadius: 22,
              border: "1px solid #ef4444",
              background: "#0a1628",
              color: "#ef4444",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ✕ Exit Kiosk
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Backwards-compat alias — DemoTemplate still imports ExitKioskButton.
 * Renders the new control cluster which includes Exit + Restart + Status.
 */
export function ExitKioskButton({
  isFullscreen = false,
  wakeLockActive = false,
}: {
  isFullscreen?: boolean;
  wakeLockActive?: boolean;
}) {
  return <KioskControls isFullscreen={isFullscreen} wakeLockActive={wakeLockActive} />;
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
    overscroll-behavior-y: contain;
    touch-action: pan-y;
    -webkit-user-select: none;
    user-select: none;
  }
  /* Block pull-to-refresh on Chrome Android */
  html.kiosk-mode-body, body.kiosk-mode-body {
    overscroll-behavior-y: none;
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
