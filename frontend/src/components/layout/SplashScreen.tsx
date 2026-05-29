import { useEffect } from "react";

/**
 * SplashScreen is now a no-op component.
 * The static hero-shell in index.html provides the branded first impression.
 * Removing the overlay eliminates ~600ms+ of LCP delay since the hero content
 * can paint as LCP immediately after React mounts.
 */
const SplashScreen = () => {
  useEffect(() => {
    const shell = document.getElementById("hero-shell");
    if (shell) {
      shell.style.opacity = "0";
      setTimeout(() => shell.remove(), 300);
    }
    window.dispatchEvent(new Event("m2:app-mounted"));
  }, []);

  return null;
};

export default SplashScreen;
