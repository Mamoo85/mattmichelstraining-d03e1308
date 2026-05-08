import AdminShell, { AdminPageHeader, KpiCard } from "./AdminShell";
import { Activity, TrendingUp, AlertCircle, Phone, Building2, Wrench } from "lucide-react";

const DEMO_VISITORS = [
  { co: "Stellantis Facilities Mgmt",  page: "Boiler Tune-Up Services",      time: "2:14 PM today",  badge: "🏭", value: "$40k–$120k contract" },
  { co: "Detroit Medical Center",      page: "Service Contracts",            time: "11:47 AM today", badge: "🏥", value: "$25k–$60k contract" },
  { co: "Wayne County Schools",        page: "Homepage",                     time: "9:03 AM today",  badge: "🏫", value: "$15k–$35k contract" },
  { co: "Henry Ford Health (HFH)",     page: "Pressure Vessel Inspections",  time: "Yesterday",      badge: "🏥", value: "$50k–$200k contract" },
  { co: "Wayne State University",      page: "Boiler Tune-Up",               time: "Yesterday",      badge: "🎓", value: "$20k–$50k contract" },
];

const DEMO_RFPS = [
  { title: "Stellantis Truck Plant – Boiler Retrofit",        agency: "MITN.info",   value: "$2.4M",   posted: "2h ago",  hot: true },
  { title: "Wayne County – Steam Plant Maintenance Contract", agency: "MITN.info",   value: "$340k/y", posted: "1d ago",  hot: true },
  { title: "Detroit Public Schools – Boiler Tune-Up RFP",     agency: "MITN.info",   value: "$180k",   posted: "2d ago",  hot: false },
  { title: "Wayne State – Combustion Analysis Annual",        agency: "MITN.info",   value: "$45k/y",  posted: "3d ago",  hot: false },
];

export default function Overview() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="Today's Pulse"
        subtitle="Friday, May 8, 2026 · Detroit, MI"
        accent="Overview"
      />

      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard label="Visitors today"    value="47"      sub="↑ 18% vs avg" accent="text-[#27CCC0]" />
          <KpiCard label="ICP companies"     value="9"       sub="3 new"        accent="text-white" />
          <KpiCard label="Missed calls"      value="2"       sub="Both texted back" />
          <KpiCard label="Hot RFPs"          value="2"       sub="$2.74M total" accent="text-[#c12a3b]" />
          <KpiCard label="Open jobs"         value="7"       sub="2 emergency" />
          <KpiCard label="Pipeline"          value="$34.2k"  sub="Pending invoices" accent="text-[#27CCC0]" />
        </div>

        {/* Two-col content */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* SiteRadar feed */}
          <div className="bg-[#111d2b] border border-white/5 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#27CCC0]" />
                <div className="text-sm font-semibold text-white">SiteRadar — Live Visitors</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">djconley.com</div>
            </div>
            <div className="divide-y divide-white/5">
              {DEMO_VISITORS.map((v) => (
                <div key={v.co} className="px-5 py-3 hover:bg-white/5 transition cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-2xl">{v.badge}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{v.co}</div>
                        <div className="text-xs text-slate-400 truncate">Viewing: {v.page}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-[#27CCC0] font-semibold">{v.value}</div>
                      <div className="text-[10px] text-slate-500">{v.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RFP feed */}
          <div className="bg-[#111d2b] border border-white/5 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#27CCC0]" />
                <div className="text-sm font-semibold text-white">Buyer Radar — Active RFPs</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">MITN.info · SAM.gov</div>
            </div>
            <div className="divide-y divide-white/5">
              {DEMO_RFPS.map((r) => (
                <div key={r.title} className="px-5 py-3 hover:bg-white/5 transition cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {r.hot && <span className="text-[10px] uppercase font-bold tracking-wider text-[#c12a3b]">🔥 Hot</span>}
                        <div className="text-sm font-medium text-white truncate">{r.title}</div>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.agency} · Posted {r.posted}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-[#27CCC0] font-bold">{r.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity row */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-[#111d2b] border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-[#27CCC0]" />
              <div className="text-sm font-semibold text-white">Missed-Call Recovery</div>
            </div>
            <div className="text-xs text-slate-400">Last call: 3:42 PM — auto-text sent in 28 sec.</div>
            <div className="text-xs text-slate-400">Recovery rate: <span className="text-[#27CCC0] font-semibold">~38%</span></div>
          </div>
          <div className="bg-[#111d2b] border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-[#27CCC0]" />
              <div className="text-sm font-semibold text-white">TechAlert</div>
            </div>
            <div className="text-xs text-slate-400">Watching 7 hospitals + 3 plants for boiler/mechanical hires.</div>
            <div className="text-xs text-slate-400">2 new signals this week.</div>
          </div>
          <div className="bg-[#111d2b] border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-[#c12a3b]" />
              <div className="text-sm font-semibold text-white">Trade Radar</div>
            </div>
            <div className="text-xs text-slate-400">14 industrial boiler permits filed this week in Wayne / Oakland / Macomb.</div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
