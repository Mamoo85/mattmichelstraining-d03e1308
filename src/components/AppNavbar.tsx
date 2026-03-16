import { Link, useLocation } from "react-router-dom";
import { Dumbbell, BarChart3, MessageSquare, ShoppingBag, Home, Menu, X, LogIn, LogOut, Shield, CreditCard } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import m2Logo from "@/assets/m2-logo.jpg";

const navItems = [
  { to: "/", label: "HOME", icon: Home },
  { to: "/dashboard", label: "PORTAL", icon: Dumbbell },
  { to: "/progress", label: "PROGRESS", icon: BarChart3 },
  { to: "/coach", label: "COACH", icon: MessageSquare },
  { to: "/shop", label: "STORE", icon: ShoppingBag },
  { to: "/pricing", label: "PRICING", icon: CreditCard },
];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-m2">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src={m2Logo} alt="M² Training" className="w-9 h-9 object-contain rounded" />
          <span className="text-primary font-bold text-sm tracking-display hidden sm:block">M² TRAINING</span>
        </Link>

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

        <button className="md:hidden p-2 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
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
