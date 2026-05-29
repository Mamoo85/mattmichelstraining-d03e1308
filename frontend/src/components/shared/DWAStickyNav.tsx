import { useEffect, useState } from "react";

interface DWAStickyNavProps {
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  productName?: string;
  accentColor?: string;
  bgColor?: string;
}

export default function DWAStickyNav({
  ctaLabel,
  ctaHref,
  ctaOnClick,
  productName = "Detroit Web Agency",
  accentColor = "#00d4ff",
  bgColor = "#0a1628",
}: DWAStickyNavProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const handleClick = () => {
    if (ctaOnClick) ctaOnClick();
  };

  return (
    <div
      style={{ background: bgColor, borderBottom: `1px solid ${accentColor}33` }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <span style={{ color: accentColor }} className="font-bold text-sm tracking-wide truncate">
          {productName}
        </span>
        {ctaHref ? (
          <a
            href={ctaHref}
            style={{ background: accentColor, color: bgColor }}
            className="font-bold text-xs px-4 py-2 rounded whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            onClick={handleClick}
            style={{ background: accentColor, color: bgColor }}
            className="font-bold text-xs px-4 py-2 rounded whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
