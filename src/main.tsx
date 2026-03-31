import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Defer print stylesheet — inject as <link media="print"> to avoid JS→CSS dependency chain
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/print.css";
    link.media = "print";
    document.head.appendChild(link);
  }, { once: true });
}

// Polyfill crypto.randomUUID for Safari < 15.4 and insecure contexts
if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID !== "function") {
  (globalThis.crypto as any).randomUUID = () =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: string) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
}

// Global broken-image fallback: replaces broken <img> with branded placeholder
document.addEventListener("error", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "IMG") {
    const img = target as HTMLImageElement;
    if (img.dataset.fallback) return;
    img.dataset.fallback = "true";
    img.src = "/placeholder.svg";
    img.style.objectFit = "contain";
    img.style.background = "hsl(0 0% 16%)";
    img.style.padding = "1rem";
  }
}, true);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register service worker after first paint to avoid blocking FCP
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker.register("/registerSW.js").catch(() => {});
    } catch {
      // Privacy browsers may block SW registration entirely
    }
  });
}
