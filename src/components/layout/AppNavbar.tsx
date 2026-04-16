import { memo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Dumbbell, ShoppingBag, Home, LogIn, LogOut, Shield,
  CalendarClock, ChevronDown, User, Download, Timer,
  Globe, Search, Wrench,
} from "lucide-react";
import { Instagram, Facebook } from "@/components/ui/social-icons";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTimer } from "@/hooks/useTimer";
import { getDomainBrand } from "@/lib/domainConfig";
import m2Logo from "@/assets/m2-logo.jpg";
const NotificationBell = lazy(() => import("./NotificationBell"));
const IntervalTimer = lazy(() => import("@/components/workout/IntervalTimer"));

const INSTAGRAM_URL = "https://www.instagram.com/mattmichelstraining/";
const FACEBOOK_URL = "https://www.facebook.com/mattmichelstraining";

interface DropdownItem { to: string; label: string; external?: boolean }

const trainLinks: DropdownItem[] = [
  { to: "/schedule", label: "In-Person" },
  { to: "/pricing", label: "Online Coaching" },
  { to: "/for-parents", label: "For Parents" },
];

const appLinks: DropdownItem[] = [
  { to: "/pricing", label: "Pricing" },
  { to: "/auth?redirect=/trial-welcome", label: "Free Trial" },
  { to: "/the-edge", label: "Features" },
];

const businessLinks: DropdownItem[] = [
  { to: "/all-services", label: "All Services" },
  { to: "/revenue-suite", label: "Revenue Suite" },
  { to: "/digital-foundation", label: "Digital Foundation" },
  { to: "/ai-website-audit", label: "Free Website Audit" },
];

const agencyServicesLinks: DropdownItem[] = [
  { to: "/all-services", label: "All Services" },
  { to: "/web-design-services", label: "Web Design" },
  { to: "/ai-website-audit", label: "Free Site Diagnostic" },
  { to: "/seo-guard", label: "SEO Guard" },
];

const agencyToolsLinks: DropdownItem[] = [
  { to: "/revenue-suite", label: "Revenue Suite" },
  { to: "/digital-foundation", label: "Digital Foundation" },
  { to: "/computer-repair", label: "Computer Repair" },
];

const NavDropdown = ({
  label,
  items,
  active,
}: {
  label: string;
  items: DropdownItem[];
  active: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
          active || open ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-background border border-border shadow-m2 z-50">
          {items.map(({ to, label: l }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to + l}
                to={to}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AppNavbar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { portalActive, toggleTimer } = useTimer();
  const brand = getDomainBrand();
  const isAgency = brand === "agency";

  if (portalActive) return null;

  const trainActive = trainLinks.some((l) => location.pathname === l.to);
  const appActive = appLinks.some((l) => location.pathname === l.to);
  const businessActive = businessLinks.some((l) => location.pathname === l.to);
  const agencyServicesActive = agencyServicesLinks.some((l) => location.pathname === l.to);
  const agencyToolsActive = agencyToolsLinks.some((l) => location.pathname === l.to);

  return (
    <nav aria-label="Main navigation" className={`fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] ${isAgency ? "backdrop-blur-xl border-b" : "bg-background/80 backdrop-blur-xl border-b border-border/50"}`} style={isAgency ? { background: "rgba(10,10,15,0.85)", borderColor: "rgba(148,163,184,0.08)" } : undefined}>
      <div className="container flex items-center justify-between h-14">
        {/* Logo / Timer toggle */}
        {!isAgency && user && ["/dashboard", "/progress", "/coach", "/nutrition", "/profile"].includes(location.pathname) ? (
          <button
            onClick={toggleTimer}
            className="flex items-center gap-1.5 group transition-m2 shrink-0 text-primary hover:opacity-80"
            aria-label="Interval Timer"
          >
            <Timer size={22} strokeWidth={2} />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Timer</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-1.5 group transition-m2 shrink-0">
            {isAgency ? (
              <span className="text-sm font-black uppercase tracking-wider" style={{ color: "#f1f5f9" }}>Detroit Web Agency</span>
            ) : (
              <img src={m2Logo} alt="M2 Training" width={36} height={36} className="w-9 h-9 object-contain" />
            )}
          </Link>
        )}

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {isAgency ? (
            <>
              <NavDropdown label="Services" items={agencyServicesLinks} active={agencyServicesActive} />
              <Link
                to="/pricing"
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  location.pathname === "/pricing" ? "text-cyan-400 bg-cyan-400/10" : "text-slate-400 hover:text-white"
                }`}
              >
                Pricing
              </Link>
              {user ? (
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-m2"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/auth?redirect=/admin"
                  className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                    location.pathname === "/auth" ? "text-cyan-400 bg-cyan-400/10" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Login
                </Link>
              )}
            </>
          ) : (
            <>
              <NavDropdown label="Train" items={trainLinks} active={trainActive} />
              <NavDropdown label="The App" items={appLinks} active={appActive} />
              <NavDropdown label="For Business" items={businessLinks} active={businessActive} />

              <Link
                to="/results"
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  location.pathname === "/results" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Results
              </Link>

              <Link
                to="/m2-development"
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  location.pathname === "/m2-development" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                M2 Dev
              </Link>

              <Link
                to="/studio-rental"
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                  location.pathname === "/studio-rental" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Studio
              </Link>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-2 text-muted-foreground hover:text-primary transition-m2"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>

              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-2 text-muted-foreground hover:text-primary transition-m2"
                aria-label="Facebook"
              >
                <Facebook size={16} />
              </a>
            </>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-m2 ${
                location.pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={14} />
              Admin
            </Link>
          )}

          {!isAgency && (
            <Link
              to="/install"
              className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm bg-primary/10 text-primary hover:bg-primary/20 transition-m2"
            >
              <Download size={13} />
              App
            </Link>
          )}

          {user && <Suspense fallback={null}><NotificationBell /></Suspense>}

          {/* Primary CTA */}
          <Link
            to={isAgency ? "/ai-website-audit" : "/schedule"}
            className={`ml-1 px-4 py-2 text-[11px] font-bold uppercase tracking-widest rounded-md transition-m2 ${
              isAgency
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {isAgency ? "Contact Us" : "Schedule"}
          </Link>

          {user ? (
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2"
            >
              <LogOut size={14} />
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
            >
              <LogIn size={14} />
              Login
            </Link>
          )}
        </div>

        {/* Mobile: bell + avatar / agency mobile CTA */}
        <div className="md:hidden flex items-center gap-2">
          {isAgency ? (
            <>
              {user ? (
                <>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400"
                    >
                      <Shield size={14} />
                    </Link>
                  )}
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth?redirect=/admin"
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400"
                >
                  <LogIn size={14} />
                </Link>
              )}
              <Link
                to="/ai-website-audit"
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md"
                style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}
              >
                Free Audit
              </Link>
            </>
          ) : (
            <>
              {user && <Suspense fallback={null}><NotificationBell /></Suspense>}
              {user ? (
                <Link to="/profile" className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </Link>
              ) : (
                <Link
                  to="/auth"
                  aria-label="Login"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary"
                >
                  <LogIn size={14} />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default memo(AppNavbar);
