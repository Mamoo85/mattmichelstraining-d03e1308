import { useEffect, useState } from "react";

/**
 * Detects ?kiosk=1 and returns the active state.
 * When active: hides nav, locks scroll on html/body, applies kiosk-mode class to root.
 * Also exposes a "Start Demo" button for manual entry, and an "Exit kiosk" floating control.
 */
export function useKioskMode() {
  const [kiosk, setKiosk] = useState(false);

  useEffect(() => {
    const isKiosk = new URLSearchParams(window.location.search).get("kiosk") === "1";
    setKiosk(isKiosk);
    if (isKiosk) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.classList.add("kiosk-mode-body");
      // Hide common navbar selectors used elsewhere in the app, just in case
      const nav = document.querySelector("nav");
      if (nav) (nav as HTMLElement).style.display = "none";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.classList.remove("kiosk-mode-body");
      const nav = document.querySelector("nav");
      if (nav) (nav as HTMLElement).style.display = "";
    };
  }, []);

  return kiosk;
}

/**
 * "Start Demo" floating button — visible only when NOT in kiosk mode.
 * Clicking it appends ?kiosk=1 and reloads, putting you in fullscreen kiosk view.
 */
export function StartDemoButton() {
  const enter = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("kiosk", "1");
    window.location.href = url.toString();
    // Try to go fullscreen after redirect — the page will check for the param.
  };

  return (
    <button
      onClick={enter}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
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
 * Removes the param and reloads.
 */
export function ExitKioskButton() {
  const exit = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("kiosk");
    window.location.href = url.toString();
  };
  return (
    <button
      onClick={exit}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
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
  }
  .kiosk-mode header[data-demo-header] {
    display: none !important;
  }
  body.kiosk-mode-body nav,
  body.kiosk-mode-body [data-app-navbar],
  body.kiosk-mode-body [data-bottom-tabs] {
    display: none !important;
  }
`;
