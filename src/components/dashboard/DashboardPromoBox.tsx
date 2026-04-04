import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, ShoppingBag, Users } from "lucide-react";

interface PromoCard {
  label: string;
  title: string;
  desc: string;
  cta: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  route: string;
}

const PROMOS: PromoCard[] = [
  {
    label: "Custom Program",
    title: "Built For You",
    desc: "AI-powered program tailored to your goals",
    cta: "Get Started",
    icon: <Gift size={22} />,
    gradient: "linear-gradient(135deg, #e8621a 0%, #f59e0b 100%)",
    glowColor: "rgba(232,98,26,0.4)",
    route: "/custom-program",
  },
  {
    label: "M2 Merch",
    title: "Rep the Brand",
    desc: "Premium training gear & apparel",
    cta: "Shop Now",
    icon: <ShoppingBag size={22} />,
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    glowColor: "rgba(168,85,247,0.4)",
    route: "/merch",
  },
  {
    label: "Refer & Earn",
    title: "Share the Gains",
    desc: "Invite friends, earn free months",
    cta: "Invite",
    icon: <Users size={22} />,
    gradient: "linear-gradient(135deg, #059669 0%, #06b6d4 100%)",
    glowColor: "rgba(6,182,212,0.4)",
    route: "/referral",
  },
];

export default function DashboardPromoBox() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  // Rotate every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PROMOS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const promo = PROMOS[activeIndex];

  return (
    <section className="mt-2">
      <button
        onClick={() => navigate(promo.route)}
        className="w-full rounded-2xl p-5 text-left transition-all duration-500 active:scale-[0.97] relative overflow-hidden"
        style={{
          background: promo.gradient,
          boxShadow: `0 0 30px ${promo.glowColor}, 0 4px 20px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Diagonal light streak */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            {promo.icon}
            <span className="text-xs font-medium uppercase tracking-widest text-white/80">
              {promo.label}
            </span>
          </div>
          <h3 className="text-xl font-black text-white leading-tight mb-1">
            {promo.title}
          </h3>
          <p className="text-sm text-white/70 mb-3">{promo.desc}</p>
          <span
            className="inline-block rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
            }}
          >
            {promo.cta}
          </span>
        </div>
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {PROMOS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i === activeIndex ? "#f97316" : "rgba(255,255,255,0.15)",
              transform: i === activeIndex ? "scale(1.3)" : "scale(1)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
