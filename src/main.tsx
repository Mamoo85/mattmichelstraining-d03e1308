import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./print.css";

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
