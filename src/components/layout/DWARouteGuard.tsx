import { ReactNode, useEffect } from "react";

/**
 * Blocks DWA-only routes from rendering on M2 Training domains.
 * If hostname is M2, redirects to detroitwebagent.com equivalent.
 */
const M2_HOSTNAMES = [
  "m2training.lovable.app",
  "mattmichelstraining.com",
  "www.mattmichelstraining.com",
];

export default function DWARouteGuard({ children }: { children: ReactNode }) {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isM2 = M2_HOSTNAMES.includes(host);

  useEffect(() => {
    if (isM2) {
      const path = window.location.pathname + window.location.search;
      window.location.href = `https://www.detroitwebagent.com${path}`;
    }
  }, [isM2]);

  if (isM2) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16 }}>Redirecting to Detroit Web Agency...</p>
          <a href={`https://www.detroitwebagent.com${window.location.pathname}`} style={{ color: "#00d4ff", fontSize: 14 }}>
            Click here if not redirected
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
