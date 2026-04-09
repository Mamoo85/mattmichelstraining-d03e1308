import { Activity } from "lucide-react";

const services = [
  { name: "Client Websites", uptime: "99.99%" },
  { name: "Lead Engines", uptime: "99.97%" },
  { name: "Call Routing", uptime: "99.99%" },
  { name: "Email Systems", uptime: "99.95%" },
];

const UptimeBar = () => (
  <div style={{ background: "#060609", borderTop: "1px solid rgba(148,163,184,0.06)" }} className="py-4">
    <div className="container max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
        <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: "#475569" }}>System Status</span>
      </div>
      {services.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
          <span className="text-[11px] font-medium" style={{ color: "#64748b" }}>{s.name}: <span style={{ color: "#22c55e" }}>{s.uptime}</span></span>
        </div>
      ))}
    </div>
  </div>
);

export default UptimeBar;
