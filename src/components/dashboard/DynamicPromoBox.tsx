import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Gift, Users, ShoppingBag, Sparkles } from "lucide-react";

const PROMOS = [
  {
    key: "custom-program",
    icon: Dumbbell,
    title: "Custom Training Program",
    desc: "Get a coach-built program designed for your goals, sport, and schedule.",
    cta: "Request Yours →",
    route: "/shop",
    gradient: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))",
    border: "rgba(34,197,94,0.3)",
    color: "#22c55e",
  },
  {
    key: "referral",
    icon: Users,
    title: "Refer a Friend, Earn Rewards",
    desc: "Share your referral code — you both get bonus M2 Points when they sign up.",
    cta: "Share Your Code →",
    route: "/referrals",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.08))",
    border: "rgba(168,85,247,0.3)",
    color: "#a855f7",
  },
  {
    key: "merch",
    icon: ShoppingBag,
    title: "M2 Merch Drop",
    desc: "Rep the brand. Limited edition training gear available now.",
    cta: "Browse Merch →",
    route: "/shop",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(0,240,255,0.08))",
    border: "rgba(59,130,246,0.3)",
    color: "#3b82f6",
  },
  {
    key: "generator",
    icon: Sparkles,
    title: "AI Workout Generator",
    desc: "Let AI build your next session — based on your goals and equipment.",
    cta: "Generate a Workout →",
    route: null,
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(232,98,26,0.08))",
    border: "rgba(249,115,22,0.3)",
    color: "#f97316",
  },
  {
    key: "gift",
    icon: Gift,
    title: "Gift a Training Session",
    desc: "Send a free session to someone who needs a push. Spread the M2 mindset.",
    cta: "Send a Gift →",
    route: "/gift",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.08))",
    border: "rgba(236,72,153,0.3)",
    color: "#ec4899",
  },
];

interface DynamicPromoBoxProps {
  onOpenGenerator?: () => void;
}

const DynamicPromoBox = memo(({ onOpenGenerator }: DynamicPromoBoxProps) => {
  const navigate = useNavigate();

  // Rotate daily
  const promo = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86400000) % PROMOS.length;
    return PROMOS[dayIndex];
  }, []);

  const Icon = promo.icon;

  const handleClick = () => {
    if (promo.key === "generator" && onOpenGenerator) {
      onOpenGenerator();
    } else if (promo.route) {
      navigate(promo.route);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] hover:opacity-90"
      style={{
        background: promo.gradient,
        border: `1px solid ${promo.border}`,
        boxShadow: `0 4px 20px ${promo.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${promo.color}22` }}
        >
          <Icon size={18} style={{ color: promo.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">{promo.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{promo.desc}</div>
          <div
            className="text-xs font-bold uppercase tracking-widest mt-2 inline-block"
            style={{ color: promo.color }}
          >
            {promo.cta}
          </div>
        </div>
      </div>
    </button>
  );
});

DynamicPromoBox.displayName = "DynamicPromoBox";
export default DynamicPromoBox;
