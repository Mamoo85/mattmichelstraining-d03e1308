import { Link, useLocation } from "react-router-dom";
import { Dumbbell, BarChart3, MessageSquare, ShoppingBag, Home, Menu, X, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import m2Logo from "@/assets/m2-logo.jpg";

const navItems = [
  { to: "/", label: "HOME", icon: Home },
  { to: "/dashboard", label: "PORTAL", icon: Dumbbell },
  { to: "/progress", label: "PROGRESS", icon: BarChart3 },
  { to: "/coach", label: "COACH", icon: MessageSquare },
  { to: "/shop", label: "STORE", icon: ShoppingBag },
];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-m2">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src={m2Logo} alt="M² Training" className="w-8 h-8 object-cover" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-primary font-bold text-sm tracking-display">M² TRAINING</span>
            <span className="text-[9px] text-muted-foreground tracking-wider">REAL TRAINING, REAL RESULTS</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}

          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2"
            >
              <LogOut size={14} />
              SIGN OUT
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
            >
              <LogIn size={14} />
              LOGIN
            </Link>
          )}
        </div>

        <button className="md:hidden p-2 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
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
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-m2 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
          {user ? (
            <button
              onClick={() => { signOut(); setMobileOpen(false); }}
              className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground w-full"
            >
              <LogOut size={14} />
              SIGN OUT
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary"
            >
              <LogIn size={14} />
              LOGIN
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default AppNavbar;
