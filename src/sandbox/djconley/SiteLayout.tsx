import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import SiteFooter from "./SiteFooter";
import { djPath } from "./links";

const NAV = [
  { to: "/sandbox/djconley", label: "Home", end: true },
  { to: "/sandbox/djconley/service", label: "Service" },
  { to: "/sandbox/djconley/parts", label: "Products" },
  { to: "/sandbox/djconley/products", label: "Manufacturers" },
  { to: "/sandbox/djconley/about", label: "About" },
  { to: "/sandbox/djconley/contact", label: "Contact" },
];

export default function SiteLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const isHome = !title;

  useEffect(() => {
    document.title = title ? `${title} | D.J. Conley Associates, Inc.` : "D.J. Conley Associates, Inc.";
    const icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']") || document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = "/demo-djconley-current/favicon-32.png";
    document.head.appendChild(icon);
  }, [title]);

  return (
    <div className="min-h-screen bg-[#e9e9e9] text-[#555]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header className={`${isHome ? "absolute" : "sticky bg-black shadow-sm"} top-0 z-40 w-full text-white`}>
        <div className={`mx-auto flex h-[94px] max-w-[1200px] items-center px-6 md:h-[156px] ${isHome ? "justify-center" : "justify-between"}`}>
          <Link to={djPath()} className="block" aria-label="D.J. Conley Associates home">
            <img
              src="/demo-djconley-current/djc-51-logo.png"
              alt="D.J. Conley Associates, Inc. — 51 years of exceptional service"
              className="h-auto w-[220px] md:w-[360px]"
            />
          </Link>
          <nav className="hidden items-center gap-7 text-[12px] font-semibold uppercase tracking-[0.16em]">
            {NAV.map((n) => (
              <NavLink key={n.to} to={djPath(n.to.replace("/sandbox/djconley", "") || "/")} end={n.end} className={({ isActive }) => isActive ? "text-white" : "text-white/80 hover:text-white"}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className={`${isHome ? "absolute right-[18%] top-[68px] md:right-[21%]" : ""} p-3 text-white`} onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-8 w-8 stroke-[1.5]" /> : <Menu className="h-8 w-8 stroke-[1.5]" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-white/15 bg-black px-6 py-4">
            <div className="mx-auto grid max-w-[420px] gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={djPath(n.to.replace("/sandbox/djconley", "") || "/")} end={n.end} onClick={() => setOpen(false)} className="px-2 py-3 text-sm uppercase tracking-[0.16em] text-white/90">
                  {n.label}
                </NavLink>
              ))}
              <a href="tel:2485898220" className="px-2 py-3 text-sm uppercase tracking-[0.16em] text-white/90">248-589-8220</a>
            </div>
          </div>
        )}
      </header>

      {title && (
        <section
          className="relative flex min-h-[520px] items-end justify-center bg-cover bg-center px-6 pb-24 pt-[200px] text-white"
          style={{ backgroundImage: "url('/demo-djconley-current/img/New-Steam-Boiler-Plant_Background.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/55" aria-hidden />
          <h1 className="relative z-10 text-center text-5xl font-light uppercase tracking-[0.08em] md:text-7xl">
            {title}
          </h1>
        </section>
      )}

      <main className="relative bg-[#e9e9e9]">
        {title && (
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 left-0 right-0 h-24 bg-[#e9e9e9]"
            style={{ clipPath: "ellipse(75% 100% at 50% 100%)" }}
          />
        )}
        <div className="relative">{children}</div>
      </main>
      <SiteFooter />

      <button type="button" aria-label="Accessibility" className="fixed bottom-6 left-6 z-50 rounded border-2 border-white bg-[#e30613] px-3 py-2 text-xs font-bold text-white shadow-lg">
        Accessibility
      </button>
    </div>
  );
}
