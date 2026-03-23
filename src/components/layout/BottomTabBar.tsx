import { memo, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Dumbbell, ShoppingBag, CalendarClock, MoreHorizontal,
  User, Users, CreditCard, Cpu, Download, LogIn, LogOut, Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Portal", icon: Dumbbell },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
] as const;

const MORE_LINKS = [
  { to: "/about", label: "About", icon: User },
  { to: "/for-parents", label: "Parents", icon: Users },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
  { to: "/the-edge", label: "Technology", icon: Cpu },
  { to: "/install", label: "Install App", icon: Download },
];

const BottomTabBar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { portalActive } = useTimer();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    signOut();
    setMoreOpen(false);
  }, [signOut]);

  // Always visible on mobile — never hide

  const isMoreActive = MORE_LINKS.some((l) => location.pathname === l.to) ||
    location.pathname === "/admin" || location.pathname === "/auth";

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
        <div className="flex items-stretch justify-around h-14">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-b" />
                )}
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative ${
              isMoreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-b" />
            )}
            <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.5} />
            <span className="text-[9px] font-bold uppercase tracking-wider">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-background border-t border-border rounded-t-2xl px-0 pb-8">
          <SheetHeader className="px-5 pb-3 border-b border-border">
            <SheetTitle className="text-xs font-bold uppercase tracking-widest text-foreground">More</SheetTitle>
          </SheetHeader>
          <div className="pt-2">
            {MORE_LINKS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    active ? "text-primary bg-primary/5" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} className={active ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm font-semibold">{label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                  location.pathname === "/admin" ? "text-primary bg-primary/5" : "text-foreground hover:bg-muted"
                }`}
              >
                <Shield size={18} strokeWidth={1.5} className={location.pathname === "/admin" ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-semibold">Admin</span>
              </Link>
            )}

            <div className="border-t border-border mt-2 pt-2">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-5 py-3.5 text-foreground hover:bg-muted transition-colors w-full"
                >
                  <LogOut size={18} strokeWidth={1.5} className="text-muted-foreground" />
                  <span className="text-sm font-semibold">Log Out</span>
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-5 py-3.5 text-primary hover:bg-primary/5 transition-colors"
                >
                  <LogIn size={18} strokeWidth={1.5} />
                  <span className="text-sm font-semibold">Log In</span>
                </Link>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default memo(BottomTabBar);
