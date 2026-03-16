import { Link, useLocation } from "react-router-dom";
import { Dumbbell, BarChart3, MessageSquare, ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "PROTOCOL", icon: Dumbbell },
  { to: "/progress", label: "PROGRESS", icon: BarChart3 },
  { to: "/coach", label: "COACH", icon: MessageSquare },
  { to: "/shop", label: "SHOP", icon: ShoppingBag },
];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-m2">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm tracking-display">M2</span>
          </div>
          <span className="text-foreground font-bold text-sm tracking-display hidden sm:block">TRAINING</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background shadow-m2 border-t border-border">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-m2 ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default AppNavbar;
