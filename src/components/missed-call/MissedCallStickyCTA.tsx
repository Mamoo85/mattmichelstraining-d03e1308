import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

interface Props {
  onClick: () => void;
}

const MissedCallStickyCTA = ({ onClick }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-3 animate-fade-in"
      style={{
        background: "rgba(15,15,26,0.97)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(34,211,238,0.25)",
      }}
    >
      <button
        onClick={onClick}
        className="w-full py-4 font-bold text-sm rounded-lg flex items-center justify-center gap-2 text-white"
        style={{ background: "linear-gradient(135deg,#06b6d4,#22d3ee)" }}
      >
        Start Free Trial — No Card for 14 Days <ArrowRight size={16} />
      </button>
      <p className="text-[10px] text-center text-[#ff6b6b] font-bold mt-1.5">
        Cancel before day 14 and you're never charged.
      </p>
    </div>
  );
};

export default MissedCallStickyCTA;
