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
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-border shadow-lg p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm text-muted-foreground mb-3 sm:mb-0">
        We use cookies to improve your experience.{" "}
        <Link to="/legal/cookie-policy" className="text-primary underline">Learn more</Link>.
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => handle("declined")}
          className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          Decline
        </button>
        <button
          onClick={() => handle("accepted")}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
