import { useEffect } from "react";

/**
 * SplashScreen is now a no-op component.
 * The static hero-shell in index.html provides the branded first impression.
 * Removing the overlay eliminates ~600ms+ of LCP delay since the hero content
 * can paint as LCP immediately after React mounts.
 */
const SplashScreen = () => {
  useEffect(() => {
    // Remove the static hero shell once React has mounted and will render real content
    const shell = document.getElementById("hero-shell");
    if (shell) shell.remove();
  }, []);

  return null;
};

export default SplashScreen;
