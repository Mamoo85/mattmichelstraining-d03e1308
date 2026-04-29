import { useEffect, useState } from "react";

const KEY = "dwa_demo_analytics_v1";

export interface DemoAnalyticsState {
  viewCount: number;
  lastStartIso: string | null;
  startClicks: number;
  exitClicks: number;
}

const empty: DemoAnalyticsState = { viewCount: 0, lastStartIso: null, startClicks: 0, exitClicks: 0 };

function read(): DemoAnalyticsState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch {
    return { ...empty };
  }
}
function write(s: DemoAnalyticsState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("dwa-demo-analytics-update"));
}

export const demoAnalytics = {
  recordView() {
    const s = read();
    s.viewCount += 1;
    s.lastStartIso = new Date().toISOString();
    write(s);
  },
  recordStartClick() {
    const s = read();
    s.startClicks += 1;
    write(s);
  },
  recordExitClick() {
    const s = read();
    s.exitClicks += 1;
    write(s);
  },
  read,
  reset() { write({ ...empty }); },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function DemoAnalyticsPanel() {
  const [state, setState] = useState<DemoAnalyticsState>(read);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener("dwa-demo-analytics-update", sync);
    window.addEventListener("storage", sync);
    const tick = window.setInterval(() => force((n) => n + 1), 5000);
    return () => {
      window.removeEventListener("dwa-demo-analytics-update", sync);
      window.removeEventListener("storage", sync);
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div
      data-demo-analytics
      style={{
        position: "fixed",
        top: "calc(16px + env(safe-area-inset-top))",
        left: "calc(16px + env(safe-area-inset-left))",
        zIndex: 9998,
        background: "rgba(10, 22, 40, 0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid #1e3a5f",
        borderRadius: 12,
        color: "#fff",
        fontFamily: "-apple-system, sans-serif",
        fontSize: 11,
        overflow: "hidden",
        transition: "all 0.2s",
        opacity: open ? 1 : 0.55,
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "#00d4ff",
          padding: "8px 14px",
          textAlign: "left",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        📊 Demo Analytics {open ? "▾" : "▸"}
      </button>
      {open && (
        <div style={{ padding: "4px 14px 12px", display: "grid", gap: 6, minWidth: 200 }}>
          <Row label="Views" value={String(state.viewCount)} accent="#00d4ff" />
          <Row label="Last Start" value={formatRelative(state.lastStartIso)} accent="#10b981" />
          <Row label="Start Clicks" value={String(state.startClicks)} accent="#e8621a" />
          <Row label="Exit Clicks" value={String(state.exitClicks)} accent="#f59e0b" />
          <button
            onClick={(e) => { e.stopPropagation(); demoAnalytics.reset(); }}
            style={{
              marginTop: 6, background: "#060e1a", border: "1px solid #1e3a5f", color: "#64748b",
              borderRadius: 6, padding: "5px 8px", fontSize: 10, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: accent, fontWeight: 800 }}>{value}</span>
    </div>
  );
}
