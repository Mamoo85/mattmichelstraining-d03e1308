import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackFbPageView } from "@/lib/fbpixel";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackFbPageView();
  }, [pathname]);
  return null;
};

export default ScrollToTop;
