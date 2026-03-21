import { memo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Dumbbell, ShoppingBag, Home, Menu, X, LogIn, LogOut, Shield,
  CreditCard, BookOpen, Users, User, Download, CalendarClock, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTimer } from "@/hooks/useTimer";
import m2Logo from "@/assets/m2-logo.jpg";
const NotificationBell = lazy(() => import("./NotificationBell"));

const primaryNav = [
  { to: "/", label: "HOME", icon: Home },
  { to: "/dashboard", label: "PORTAL", icon: Dumbbell },
  { to: "/shop", label: "SHOP", icon: ShoppingBag },
  { to: "/schedule", label: "SCHEDULE", icon: CalendarClock },
];

const secondaryNav = [
  { to: "/about", label: "ABOUT", icon: User },
  { to: "/for-parents", label: "PARENTS", icon: Users },
  { to: "/learn", label: "LEARN", icon: BookOpen },
  { to: "/pricing", label: "PRICING", icon: CreditCard },
];

const allNav = [...primaryNav, ...secondaryNav];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { timerOpen, toggleTimer, portalActive } = useTimer();

  // Close "More" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // Close more dropdown on route change
  useEffect(() => { setMoreOpen(false); setMobileOpen(false); }, [location.pathname]);

  if (portalActive) return null;

  const isSecondaryActive = secondaryNav.some((n) => location.pathname === n.to);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-m2">
      <div className="container flex items-center justify-between h-14">
        {/* Logo / Timer toggle */}
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-1.5 group transition-m2 shrink-0 ${timerOpen ? "opacity-80" : ""}`}
          title={timerOpen ? "Close Timer" : "Open Timer"}
        >
          <img src={m2Logo} alt="M² Timer" className="w-9 h-9 object-contain" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${timerOpen ? "text-primary" : "text-muted-foreground group-hover:text-primary"} transition-m2`}>
            {timerOpen ? "✕ Close" : "Timer"}
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {/* Primary tabs — always visible */}
          {primaryNav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}

          {/* "More" dropdown for secondary tabs */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                isSecondaryActive || moreOpen
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              MORE
              <ChevronDown size={12} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 mt-1 w-44 bg-background border border-border shadow-m2 z-50">
                {secondaryNav.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                        active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                location.pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={14} />
              ADMIN
            </Link>
          )}

          <Link
            to="/install"
            className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm bg-primary/10 text-primary hover:bg-primary/20 transition-m2"
          >
            <Download size={13} />
            App
          </Link>

          {user && <NotificationBell />}

          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2"
            >
              <LogOut size={14} />
              LOGOUT
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
            >
              <LogIn size={14} />
              LOGIN
            </Link>
          )}
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          <Link
            to="/install"
            className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm bg-primary/10 text-primary"
          >
            <Download size={13} />
            App
          </Link>
          {user && <NotificationBell />}
          <button className="p-2 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background shadow-m2 border-t border-border">
          {allNav.map(({ to, label, icon: Icon }) => {
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
              LOGOUT
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

export default memo(AppNavbar);
