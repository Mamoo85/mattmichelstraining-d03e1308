import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Target, Phone, Building2, Wrench, Briefcase, HardHat,
  Send, Star, BarChart3, Plug, Settings, Users, Search, Bell, Sparkles
} from "lucide-react";

const TABS = [
  { to: "/sandbox/djconley/admin",              icon: LayoutDashboard, label: "Overview",     end: true },
  { to: "/sandbox/djconley/admin/site-radar",   icon: Target,          label: "SiteRadar" },
  { to: "/sandbox/djconley/admin/missed-call",  icon: Phone,           label: "Missed-Call" },
  { to: "/sandbox/djconley/admin/buyer-radar",  icon: Building2,       label: "Buyer Radar" },
  { to: "/sandbox/djconley/admin/fielddesk",    icon: Wrench,          label: "FieldDesk" },
  { to: "/sandbox/djconley/admin/techalert",    icon: Briefcase,       label: "TechAlert" },
  { to: "/sandbox/djconley/admin/trade-radar",  icon: HardHat,         label: "Trade Radar" },
  { to: "/sandbox/djconley/admin/outreach",     icon: Send,            label: "Outreach" },
  { to: "/sandbox/djconley/admin/reviews",      icon: Star,            label: "Reviews" },
  { to: "/sandbox/djconley/admin/widgets",      icon: Sparkles,        label: "Site Widgets" },
  { to: "/sandbox/djconley/admin/reports",      icon: BarChart3,       label: "Reports" },
];

const FOOT = [
  { to: "/sandbox/djconley/admin/integrations", icon: Plug,     label: "Integrations" },
  { to: "/sandbox/djconley/admin/team",         icon: Users,    label: "Team" },
  { to: "/sandbox/djconley/admin/settings",     icon: Settings, label: "Settings" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const current = [...TABS, ...FOOT].find((t) => (t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to)));

  return (
    <div className="min-h-screen flex bg-[#0b1622] text-slate-200" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a1320] border-r border-white/5 flex flex-col">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#27CCC0] to-[#1fa89d] flex items-center justify-center text-[#0b1622] font-black text-sm">🔥</div>
            <div className="leading-tight">
              <div className="text-white font-bold text-sm">D.J. Conley</div>
              <div className="text-[10px] uppercase tracking-widest text-[#27CCC0]">Command Center</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? "bg-[#27CCC0]/10 text-[#27CCC0] border-l-2 border-[#27CCC0]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-white/5 space-y-0.5">
          {FOOT.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  isActive ? "bg-white/5 text-white" : "text-slate-500 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-[#0a1320] border-b border-white/5 flex items-center px-5 gap-4">
          <div className="flex-1 max-w-xl relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Search visitors, jobs, RFPs, contacts…  (⌘K)"
              className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-1.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#27CCC0]/50"
            />
          </div>
          <div className="text-xs text-slate-500">{current?.label || ""}</div>
          <button className="relative p-2 hover:bg-white/5 rounded-md">
            <Bell className="h-4 w-4 text-slate-400" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#c12a3b] rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#27CCC0] to-[#1fa89d] flex items-center justify-center text-[#0b1622] font-bold text-xs">PM</div>
        </header>

        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, subtitle, accent }: { title: string; subtitle?: string; accent?: string }) {
  return (
    <div className="px-6 py-5 border-b border-white/5">
      <div className="flex items-end justify-between">
        <div>
          {accent && <div className="text-[10px] uppercase tracking-[0.3em] text-[#27CCC0] mb-1">{accent}</div>}
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111d2b] border border-white/5 rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
