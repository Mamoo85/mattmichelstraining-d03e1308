import { useEffect } from "react";

/**
 * Redirects visitors away from mattmichelstraining.com on Detroit Web Agency pages.
 * Free Tools and other DWA-only pages should only ever load on detroitwebagent.com.
 */
export function useDwaDomainRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isM2 = host.includes("mattmichelstraining.com") || host === "m2training.lovable.app";
    if (!isM2) return;
    const target = `https://www.detroitwebagent.com${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);
}
