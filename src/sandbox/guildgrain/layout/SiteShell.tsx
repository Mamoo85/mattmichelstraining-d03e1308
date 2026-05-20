import { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, Store, LayoutDashboard } from "lucide-react";
import { useGGCart } from "../state/CartContext";
import MiniCart from "../components/MiniCart";

const NAV = [
  { to: "/guild-grain", label: "Home", end: true },
  { to: "/guild-grain/shop", label: "Shop" },
];

export default function SiteShell({ children }: { children: ReactNode }) {
  const { itemCount, setMiniOpen } = useGGCart();
  const { pathname } = useLocation();
  const isSeller = pathname.startsWith("/guild-grain/seller");

  return (
    <div className="gg-theme">
      <header className="sticky top-0 z-40 border-b border-[var(--gg-line)] bg-[var(--gg-cream)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-8">
          <Link to="/guild-grain" className="flex items-center gap-2">
            <span className="gg-serif text-2xl font-semibold tracking-tight">Guild <span className="text-[var(--gg-clay)]">&amp;</span> Grain</span>
          </Link>
          <nav className="hidden items-center gap-8 text-xs uppercase tracking-[0.18em] md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => isActive ? "text-[var(--gg-ink)] font-semibold" : "text-[var(--gg-mute)] hover:text-[var(--gg-ink)]"}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to={isSeller ? "/guild-grain" : "/guild-grain/seller"} className="hidden items-center gap-2 border border-[var(--gg-line)] px-3 py-2 text-[11px] uppercase tracking-[0.16em] hover:bg-[var(--gg-ink)] hover:text-[var(--gg-cream)] md:inline-flex" data-testid="gg-switch-view">
              {isSeller ? <><Store className="h-3.5 w-3.5" /> Storefront</> : <><LayoutDashboard className="h-3.5 w-3.5" /> Switch to Seller</>}
            </Link>
            <button onClick={() => setMiniOpen(true)} className="relative flex items-center gap-2 border border-[var(--gg-ink)] bg-[var(--gg-ink)] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gg-cream)]" data-testid="gg-cart-btn" aria-label="Open cart">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{itemCount}</span>
            </button>
          </div>
        </div>
        <div className="border-t border-[var(--gg-line)] bg-[var(--gg-cream-2)] py-1.5 text-center text-[11px] uppercase tracking-[0.2em] text-[var(--gg-mute)] md:hidden">
          <Link to={isSeller ? "/guild-grain" : "/guild-grain/seller"}>{isSeller ? "Storefront →" : "Switch to Seller →"}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">{children}</main>

      <footer className="mt-16 border-t border-[var(--gg-line)] bg-[var(--gg-cream-2)] py-10 text-center text-xs uppercase tracking-[0.18em] text-[var(--gg-mute)]">
        <div className="mx-auto max-w-[1280px] px-4">
          <div className="gg-serif mb-2 text-2xl text-[var(--gg-ink)]">Guild <span className="text-[var(--gg-clay)]">&amp;</span> Grain</div>
          <p>Curated artisans · Made to last · Established 2026</p>
        </div>
      </footer>

      <MiniCart />
    </div>
  );
}
