import { ReactNode, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Phone } from "lucide-react";

const NAV = [
  { to: "/sandbox/djconley", label: "Home", end: true },
  { to: "/sandbox/djconley/about", label: "About" },
  { to: "/sandbox/djconley/industries", label: "Industries" },
  { to: "/sandbox/djconley/service", label: "Service" },
  { to: "/sandbox/djconley/parts", label: "Parts" },
  { to: "/sandbox/djconley/products", label: "Products" },
  { to: "/sandbox/djconley/projects", label: "Projects" },
  { to: "/sandbox/djconley/rentals", label: "Rentals" },
  { to: "/sandbox/djconley/education", label: "Education" },
  { to: "/sandbox/djconley/resources", label: "Resources" },
  { to: "/sandbox/djconley/careers", label: "Careers" },
  { to: "/sandbox/djconley/contact", label: "Contact" },
];

export default function SiteLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Top utility strip */}
      <div className="bg-[#0b1622] text-slate-200 text-xs">
        <div className="max-w-[1280px] mx-auto px-5 py-2 flex justify-between items-center">
          <span>Detroit Area Boiler Solutions · Serving Michigan since 1948</span>
          <a href="tel:+12485855340" className="hidden md:flex items-center gap-1.5 text-[#27CCC0] hover:text-white">
            <Phone className="h-3 w-3" /> (248) 585-5340
          </a>
        </div>
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/sandbox/djconley" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#0b1622] flex items-center justify-center text-[#27CCC0] font-black">DJ</div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">D.J. Conley</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Associates, Inc.</div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-md transition ${
                    isActive ? "text-[#c12a3b]" : "text-slate-700 hover:text-[#0b1622]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>

          <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <div className="px-5 py-3 grid grid-cols-2 gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm rounded-md ${isActive ? "bg-slate-100 text-[#c12a3b]" : "text-slate-700"}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {title && (
        <div className="bg-[#0b1622] text-white">
          <div className="max-w-[1280px] mx-auto px-5 py-12">
            <h1 className="text-4xl md:text-5xl font-black">{title}</h1>
            <div className="text-xs uppercase tracking-[0.3em] text-[#27CCC0] mt-2">
              D.J. Conley Associates · {loc.pathname.split("/").pop()?.toUpperCase() || "HOME"}
            </div>
          </div>
        </div>
      )}

      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-[#0b1622] text-slate-300 mt-20">
        <div className="max-w-[1280px] mx-auto px-5 py-12 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="text-white font-extrabold text-lg">D.J. Conley</div>
            <div className="text-xs text-slate-400 mb-3">Associates, Inc.</div>
            <p className="text-slate-400 leading-relaxed">
              Detroit's trusted source for boiler service, parts, sales, and rentals since 1948.
            </p>
          </div>
          <div>
            <div className="text-white font-bold mb-3">Services</div>
            <ul className="space-y-1.5 text-slate-400">
              <li>Boiler Tune-Up</li><li>Combustion Analysis</li><li>Pressure Vessel</li><li>Preventative Maintenance</li>
            </ul>
          </div>
          <div>
            <div className="text-white font-bold mb-3">Company</div>
            <ul className="space-y-1.5 text-slate-400">
              <li><Link to="/sandbox/djconley/about">About</Link></li>
              <li><Link to="/sandbox/djconley/careers">Careers</Link></li>
              <li><Link to="/sandbox/djconley/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-white font-bold mb-3">Contact</div>
            <ul className="space-y-1.5 text-slate-400">
              <li>📞 (248) 585-5340</li>
              <li>📍 Troy, MI 48083</li>
              <li>✉ service@djconley.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-[1280px] mx-auto px-5 py-4 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <span>© {new Date().getFullYear()} D.J. Conley Associates, Inc. All rights reserved.</span>
            <span>Powered by <span className="text-[#27CCC0]">Detroit Web Agency</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
