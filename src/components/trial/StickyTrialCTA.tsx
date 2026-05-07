import { useEffect, useState } from "react";

interface Props {
  /** Label for the CTA button. */
  label?: string;
  /** ID of the form/section to scroll to and submit. */
  targetFormId?: string;
  /** Optional click handler — overrides scroll behavior. */
  onClick?: () => void;
}

/**
 * Fixed-bottom CTA bar — only renders on small screens (md:hidden).
 * Hides itself when the target form is in the viewport so it doesn't double-stack.
 */
export default function StickyTrialCTA({
  label = "Start 7-day free trial →",
  targetFormId = "trial-form",
  onClick,
}: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetFormId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting && entry.intersectionRatio > 0.4),
      { threshold: [0, 0.4, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [targetFormId]);

  function handleClick() {
    if (onClick) return onClick();
    const el = document.getElementById(targetFormId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Try to focus first input
      setTimeout(() => {
        const input = el.querySelector<HTMLInputElement>("input,select,textarea");
        input?.focus();
      }, 350);
    }
  }

  if (hidden) return null;

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a1628]/95 backdrop-blur border-t border-[#00d4ff]/40 shadow-[0_-6px_20px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-4 text-base"
      >
        {label}
      </button>
    </div>
  );
}
