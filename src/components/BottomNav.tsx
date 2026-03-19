import { Link, useLocation } from "react-router-dom";
import { Home, Dumbbell, Clock, User } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";

const linkTabs = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/progress", label: "Log", icon: Dumbbell },
] as const;

const BottomNav = () => {
  const location = useLocation();
  const { toggleTimer, timerOpen } = useTimer();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border transform-gpu pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {linkTabs.slice(0, 2).map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 active:scale-95 transition-transform duration-100"
            >
              <div className={`p-1.5 rounded-full transition-all ${active ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground"}`}>
                <Icon size={22} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Timer button */}
        <button
          onClick={toggleTimer}
          className="flex flex-col items-center justify-center flex-1 gap-0.5 active:scale-95 transition-transform duration-100"
        >
          <div className={`p-1.5 rounded-full transition-all ${timerOpen ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground"}`}>
            <Clock size={22} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${timerOpen ? "text-primary" : "text-muted-foreground"}`}>
            Timer
          </span>
        </button>

        {/* Profile link */}
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center flex-1 gap-0.5 active:scale-95 transition-transform duration-100"
        >
          <div className={`p-1.5 rounded-full transition-all ${location.pathname === "/profile" ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground"}`}>
            <User size={22} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${location.pathname === "/profile" ? "text-primary" : "text-muted-foreground"}`}>
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNav;
