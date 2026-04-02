import { memo, useState, useCallback, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Dumbbell, ShoppingBag, CalendarClock, MoreHorizontal,
  User, LogIn, LogOut, Shield, Timer, Instagram, Facebook,
  Trophy, CreditCard, Sparkles, ShoppingCart, Users, Building2, Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTimer } from "@/hooks/useTimer";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const IntervalTimer = lazy(() => import("@/components/workout/IntervalTimer"));

const INSTAGRAM_URL = "https://www.instagram.com/mattmichelstraining/";
const FACEBOOK_URL = "https://www.facebook.com/mattmichelstraining";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Portal", icon: Dumbbell },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
] as const;

interface SectionLink {
  to: string;
  label: string;
  icon: typeof Home;
}

const CLIENT_LINKS: SectionLink[] = [
  { to: "/dashboard", label: "Dashboard", icon: Dumbbell },
  { to: "/progress", label: "Progress", icon: Trophy },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
];

const TRAIN_LINKS: SectionLink[] = [
  { to: "/schedule", label: "In-Person Training", icon: CalendarClock },
  { to: "/pricing", label: "Online Coaching", icon: CreditCard },
  { to: "/for-parents", label: "For Parents", icon: Users },
  { to: "/results", label: "Results", icon: Trophy },
];

const APP_LINKS: SectionLink[] = [
  { to: "/pricing", label: "Pricing & Plans", icon: CreditCard },
  { to: "/auth?redirect=/trial-welcome", label: "Free Trial", icon: Sparkles },
  { to: "/merch", label: "Merch", icon: ShoppingCart },
];

const STUDIO_LINKS: SectionLink[] = [
  { to: "/studio-rental", label: "Studio Rental", icon: Building2 },
  { to: "/detroit-web-design", label: "Web Design", icon: Globe },
];

const SectionHeader = ({ title }: { title: string }) => (
  <p className="px-5 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
    {title}
  </p>
);

const HIDDEN_PATHS = [
  "/demo-landscaping", "/demo-plumber", "/demo-electrician",
  "/demo-lawyer", "/demo-clinic", "/demo-roofing",
  "/demo-youngblood", "/demo-dental", "/demo-home",
  "/detroit-web-design", "/whats-included",
  "/matrix", "/matrix-training", "/matrix-merch",
];

const BottomTabBar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toggleTimer, timerOpen, closeTimer } = useTimer();

  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    signOut();
    setMoreOpen(false);
  }, [signOut]);

  const handleTimerClick = useCallback(() => {
    setMoreOpen(false);
    toggleTimer();
  }, [toggleTimer]);

  const allMorePaths = [
    ...CLIENT_LINKS, ...TRAIN_LINKS, ...APP_LINKS, ...STUDIO_LINKS,
  ].map((l) => l.to);
  const isMoreActive =
    allMorePaths.includes(location.pathname) ||
    location.pathname === "/admin" ||
    location.pathname === "/auth";

  const renderLink = ({ to, label, icon: Icon }: SectionLink) => {
    const active = location.pathname === to;
    return (
      <Link
        key={to + label}
        to={to}
        onClick={() => setMoreOpen(false)}
        className={`flex items-center gap-3 px-5 py-3 transition-colors ${
          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-muted"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} className={active ? "text-primary" : "text-muted-foreground"} />
        <span className="text-sm font-semibold">{label}</span>
      </Link>
    );
  };

  // Hide on demo/test pages
  const isHidden = HIDDEN_PATHS.some(p => location.pathname.startsWith(p));
  if (isHidden) return null;

  return (
    <>
      {/* Spacer to prevent fixed navbar from covering content */}
      <div className="h-14 pb-[env(safe-area-inset-bottom)] md:hidden" aria-hidden="true" />
      {timerOpen && (
        <Suspense fallback={null}>
          <IntervalTimer onClose={closeTimer} />
        </Suspense>
      )}

      <nav aria-label="Bottom navigation" className="fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
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
                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More options"
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative ${
              isMoreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-b" />
            )}
            <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-background border-t border-border rounded-t-2xl px-0 pb-20 max-h-[80vh] overflow-y-auto">
          <SheetHeader className="px-5 pb-3 border-b border-border">
            <SheetTitle className="text-xs font-bold uppercase tracking-widest text-foreground">More</SheetTitle>
          </SheetHeader>

          {/* Timer */}
          <button
            onClick={handleTimerClick}
            className="flex items-center gap-3 px-5 py-3 transition-colors text-foreground hover:bg-muted w-full"
          >
            <Timer size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Interval Timer</span>
          </button>

          {user && (
            <>
              <SectionHeader title="For Clients" />
              {CLIENT_LINKS.map(renderLink)}
            </>
          )}

          <SectionHeader title="Train with Matt" />
          {TRAIN_LINKS.map(renderLink)}

          <SectionHeader title="The App" />
          {APP_LINKS.map(renderLink)}

          <SectionHeader title="Studio & Partners" />
          {STUDIO_LINKS.map(renderLink)}

          {/* Social */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted transition-colors"
          >
            <Instagram size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Instagram</span>
          </a>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted transition-colors"
          >
            <Facebook size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Facebook</span>
          </a>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMoreOpen(false)}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                location.pathname === "/admin" ? "text-primary bg-primary/5" : "text-foreground hover:bg-muted"
              }`}
            >
              <Shield size={16} strokeWidth={1.5} className={location.pathname === "/admin" ? "text-primary" : "text-muted-foreground"} />
              <span className="text-sm font-semibold">Admin</span>
            </Link>
          )}

          <div className="border-t border-border mt-2 pt-2">
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted transition-colors w-full"
              >
                <LogOut size={16} strokeWidth={1.5} className="text-muted-foreground" />
                <span className="text-sm font-semibold">Log Out</span>
              </button>
            ) : (
              <Link
                to="/auth"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-5 py-3 text-primary hover:bg-primary/5 transition-colors"
              >
                <LogIn size={16} strokeWidth={1.5} />
                <span className="text-sm font-semibold">Log In</span>
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default memo(BottomTabBar);
