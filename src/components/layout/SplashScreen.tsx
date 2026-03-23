import { useState, useEffect } from "react";
import { safeSessionStorage } from "@/lib/browserStorage";
import logoSplash from "@/assets/m2-logo-splash.jpg";

const SESSION_KEY = "m2-splash-shown";
const DISPLAY_MS = 1400;

const SplashScreen = () => {
  const [show, setShow] = useState(() => !safeSessionStorage.getItem(SESSION_KEY));

  useEffect(() => {
    // Remove the static HTML splash shell injected by Vite plugin
    const shell = document.getElementById("splash-shell");
    if (shell) shell.remove();

    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setShow(false), DISPLAY_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
    >
      <img
        src={logoSplash}
        alt="M² Training"
        fetchPriority="high"
        decoding="sync"
        className="w-64 h-64 object-contain drop-shadow-[0_0_40px_hsl(var(--primary)/0.4)]"
        style={{ filter: "contrast(1.05) brightness(1.08)" }}
      />
    </div>
  );
};

export default SplashScreen;
