import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { safeLocalStorage } from "@/lib/browserStorage";

const COOKIE_KEY = "m2_cookie_consent";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = safeLocalStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const handle = (value: "accepted" | "declined") => {
    safeLocalStorage.setItem(COOKIE_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-border shadow-lg p-3 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        We use cookies to improve your experience.{" "}
        <Link to="/legal/cookie-policy" className="text-primary underline">Learn more</Link>.
      </p>
      <button
        onClick={() => handle("accepted")}
        className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
      >
        OK
      </button>
    </div>
  );
};

export default CookieBanner;
