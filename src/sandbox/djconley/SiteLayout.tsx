import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

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
      <header className="absolute top-0 left-0 right-0 z-40 bg-black/90 text-white md:bg-transparent">
        <div className="mx-auto flex h-[86px] max-w-[1200px] items-center justify-between px-6 md:h-[148px]">
          <Link to="/sandbox/djconley" className="block" aria-label="D.J. Conley Associates home">
            <img
              src="/demo-djconley-current/djc-51-logo.png"
              alt="D.J. Conley Associates, Inc. — 51 years of exceptional service"
              className="h-auto w-[210px] md:w-[330px]"
            />
          </Link>

          <nav className="hidden items-center gap-7 text-[12px] font-semibold uppercase tracking-[0.16em] md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => isActive ? "text-white" : "text-white/80 hover:text-white"}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <button className="p-3 text-white md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/15 bg-black px-6 py-4 md:hidden">
            <div className="grid gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className="px-2 py-3 text-sm uppercase tracking-[0.16em] text-white/90">
                  {n.label}
                </NavLink>
              ))}
              <a href="tel:2485898220" className="px-2 py-3 text-sm uppercase tracking-[0.16em] text-white/90">248-589-8220</a>
            </div>
          </div>
        )}
      </header>

      {title && (
        <section className="bg-black px-6 pb-16 pt-32 text-white md:pt-48">
          <div className="mx-auto max-w-[1100px]">
            <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
          </div>
        </section>
      )}

      <main>{children}</main>
    </div>
  );
}