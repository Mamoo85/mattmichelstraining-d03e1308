import { Link, useLocation } from "react-router-dom";
import { Home, Dumbbell, Clock, User } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";

const tabs = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/progress", label: "Log", icon: Dumbbell },
  { key: "timer", label: "Timer", icon: Clock },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const BottomNav = () => {
  const location = useLocation();
  const { toggleTimer, timerOpen } = useTimer();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border transform-gpu">
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isTimer = "key" in tab && tab.key === "timer";
          const active = isTimer ? timerOpen : location.pathname === tab.to;

          if (isTimer) {
            return (
              <button
                key="timer"
                onClick={toggleTimer}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors active:scale-95 transition-transform duration-100"
              >
                <div className={`p-1.5 rounded-full transition-all ${active ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground"}`}>
                  <Icon size={22} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={tab.to}
              to={tab.to!}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors active:scale-95 transition-transform duration-100"
            >
              <div className={`p-1.5 rounded-full transition-all ${active ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground"}`}>
                <Icon size={22} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
