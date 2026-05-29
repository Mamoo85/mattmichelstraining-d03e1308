import SiteLayout from "../SiteLayout";
import { Link } from "react-router-dom";
import { djPath } from "../links";
import {
  Activity, Phone, Building2, Wrench, Radar, Users,
  BarChart3, Bell, Settings, Shield, FileText, Megaphone,
} from "lucide-react";

const MODULES = [
  {
    icon: Activity, color: "#27CCC0", to: "/admin",
    title: "Today's Pulse",
    desc: "Daily KPI dashboard — visitors, ICP companies, hot RFPs, missed calls. Pat opens this each morning with coffee.",
  },
  {
    icon: Radar, color: "#22d3ee", to: "/admin/site-radar",
    title: "SiteRadar",
    desc: "See which companies (Stellantis, DMC, Wayne State) are visiting djconley.com and which pages they read — before they fill out a form.",
  },
  {
    icon: Phone, color: "#fbbf24", to: "/admin/missed-call",
    title: "Missed-Call Catch",
    desc: "Every missed call gets an instant SMS auto-reply + voicemail transcript in your inbox. Never lose a $40k contract to voicemail again.",
  },
  {
    icon: Building2, color: "#a78bfa", to: "/admin/buyer-radar",
    title: "Buyer Radar",
    desc: "Tracks public RFPs from MITN, BidNet, hospital systems, school districts. Hot ones (Henry Ford, Stellantis) flagged red.",
  },
  {
    icon: Wrench, color: "#f97316", to: "/admin/fielddesk",
    title: "FieldDesk",
    desc: "Tech location tracker, job board, dispatch dashboard. See where every truck is right now.",
  },
  {
    icon: Bell, color: "#ef4444", to: "/admin/techalert",
    title: "TechAlert",
    desc: "Hiring signals across Michigan trades — when a competitor is short-staffed, your recruiter knows first.",
  },
  {
    icon: BarChart3, color: "#10b981", to: "/admin/trade-radar",
    title: "Trade Radar",
    desc: "Permit pulls, foreclosures, storm damage in your service territory — fed live from BSEED, NOAA, county GIS.",
  },
  {
    icon: Megaphone, color: "#ec4899", to: "/admin/outreach",
    title: "Outreach",
    desc: "Cold email + SMS sequences with TCPA opt-out scrubbing built in. Compliance handled.",
  },
  {
    icon: FileText, color: "#60a5fa", to: "/admin/reports",
    title: "Reports",
    desc: "Monthly/quarterly export bundles — revenue attribution by lead source, contract win rate, response time.",
  },
  {
    icon: Users, color: "#94a3b8", to: "/admin/team",
    title: "Team & Reviews",
    desc: "User seats, role permissions, and the reviews dashboard (Google + Facebook reputation).",
  },
];

export default function AdminTour() {
  return (
    <SiteLayout title="Owner's Command Center">
      <section className="mx-auto max-w-[1100px] px-8 py-16">
        <div className="rounded-lg border-2 border-[#27CCC0] bg-gradient-to-br from-[#0b1622] to-[#111d2b] p-8 text-white shadow-2xl mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-[#27CCC0] mb-3">For Pat's eyes only</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">The control panel behind your website.</h2>
          <p className="text-white/80 leading-relaxed mb-6 max-w-[700px]">
            Most websites are brochures. This one is wired to a command center that watches your visitors, your phones,
            your RFPs, and your service territory — 24/7. Click any module below for a live tour.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={djPath("/admin")} className="rounded-full bg-[#27CCC0] px-6 py-3 text-sm font-bold text-[#0b1622] hover:bg-[#27CCC0]/90">
              Enter Command Center →
            </Link>
            <a href="tel:+13138064952" className="rounded-full border border-white/30 px-6 py-3 text-sm text-white hover:bg-white/10">
              📞 Walk me through it: (313) 806-4952
            </a>
          </div>
          <p className="mt-5 text-xs text-white/50">
            Login: <span className="font-mono text-white/80">pmichels@djconley.com</span> · Passcode: <span className="font-mono text-white/80">boiler1948</span>
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.to}
                to={djPath(m.to)}
                className="group block rounded-lg border border-[#d4d4d4] bg-white p-6 hover:border-[#27CCC0] hover:shadow-lg transition"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#333] group-hover:text-[#27CCC0]">{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#666]">{m.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-lg bg-[#e9e9e9] p-6 text-center text-sm text-[#555]">
          <Shield className="mx-auto mb-2 h-5 w-5 text-[#27CCC0]" />
          Everything you see is real working code on a real database. No mock-ups, no slides.
          When you go live, your team logs in here from day one.
        </div>
      </section>
    </SiteLayout>
  );
}
