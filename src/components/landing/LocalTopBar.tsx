import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

const LocalTopBar = () => {
  const [visible, setVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const isFirst = !sessionStorage.getItem("m2_visited");
    if (isFirst) sessionStorage.setItem("m2_visited", "true");
    // Also show if referred from Google
    const fromGoogle = document.referrer.includes("google");
    setShouldRender(isFirst || fromGoogle);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastY.current || y < 10);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed top-14 left-0 right-0 z-40 bg-primary text-primary-foreground text-xs font-bold text-center py-1.5 transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container flex items-center justify-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          Grosse Pointe Park, MI
        </span>
        <span className="hidden sm:inline">·</span>
        <a href="tel:3138064952" className="underline underline-offset-2 hover:opacity-80">
          (313) 806-4952
        </a>
        <span>·</span>
        <Link to="/schedule" className="underline underline-offset-2 hover:opacity-80">
          Schedule →
        </Link>
      </div>
    </div>
  );
};

export default LocalTopBar;
