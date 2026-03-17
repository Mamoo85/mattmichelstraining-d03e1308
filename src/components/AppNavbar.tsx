import { Link, useLocation } from "react-router-dom";
import { Dumbbell, MessageSquare, ShoppingBag, Home, Menu, X, LogIn, LogOut, Shield, CreditCard, User, Shirt, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTimer } from "@/hooks/useTimer";
import m2Logo from "@/assets/m2-logo-official.jpg";
import NotificationBell from "./NotificationBell";

const navItems = [
  { to: "/", label: "HOME", icon: Home },
  { to: "/dashboard", label: "PORTAL", icon: Dumbbell },
  { to: "/coach", label: "COACH", icon: MessageSquare },
  { to: "/shop", label: "STORE", icon: ShoppingBag },
  { to: "/merch", label: "MERCH", icon: Shirt },
  { to: "/for-parents", label: "PARENTS", icon: Users },
  { to: "/pricing", label: "PRICING", icon: CreditCard },
  { to: "/about", label: "ABOUT", icon: User },
];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { timerOpen, toggleTimer } = useTimer();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-m2">
      <div className="container flex items-center justify-between h-14">
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-1.5 group transition-m2 ${timerOpen ? "opacity-80" : ""}`}
          title={timerOpen ? "Close Timer" : "Open Timer"}
        >
          <img src={m2Logo} alt="M² Timer" className="w-9 h-9 object-contain" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${timerOpen ? "text-primary" : "text-muted-foreground group-hover:text-primary"} transition-m2`}>
            {timerOpen ? "✕ Close" : "Timer"}
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                location.pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={14} />
              ADMIN
            </Link>
          )}

          {user && <NotificationBell />}

          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2"
            >
              <LogOut size={14} />
              SIGN OUT
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
            >
              <LogIn size={14} />
              LOGIN
            </Link>
          )}
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          {user && <NotificationBell />}
          <button className="p-2 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background shadow-m2 border-t border-border">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-bold uppercase tracking-widest transition-m2 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-bold uppercase tracking-widest transition-m2 ${
                location.pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={16} />
              ADMIN
            </Link>
          )}
          {user ? (
            <button
              onClick={() => { signOut(); setMobileOpen(false); }}
              className="flex items-center gap-2 px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-muted-foreground w-full"
            >
              <LogOut size={16} />
              SIGN OUT
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-primary"
            >
              <LogIn size={16} />
              LOGIN
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default AppNavbar;
