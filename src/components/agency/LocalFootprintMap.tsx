import { MapPin } from "lucide-react";

const pins = [
  { x: 62, y: 38, type: "web", label: "Roofing Co — Web + SEO" },
  { x: 70, y: 45, type: "automation", label: "HVAC — Call Routing" },
  { x: 55, y: 52, type: "hardware", label: "Dental Office — IT Support" },
  { x: 75, y: 55, type: "web", label: "Plumbing — Lead Engine" },
  { x: 58, y: 30, type: "automation", label: "Landscaper — SMS Automation" },
  { x: 68, y: 60, type: "web", label: "Restaurant — Web Design" },
  { x: 80, y: 42, type: "hardware", label: "Law Firm — Network Setup" },
  { x: 72, y: 35, type: "automation", label: "Salon — Review Monitor" },
];

const typeColors: Record<string, string> = {
  web: "#22d3ee",
  automation: "#a78bfa",
  hardware: "#f59e0b",
};

const LocalFootprintMap = () => (
  <section className="py-20">
    <div className="container max-w-5xl mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
          Our Local Footprint
        </h2>
        <p style={{ color: "#64748b" }}>Businesses across Metro Detroit trust us with their digital infrastructure.</p>
      </div>

      <div className="relative rounded-xl overflow-hidden aspect-[16/10]" style={{ background: "#0c0c14", border: "1px solid rgba(148,163,184,0.1)" }}>
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.04 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${i * 5}%`} x2="100%" y2={`${i * 5}%`} stroke="#94a3b8" strokeWidth="1" />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`v${i}`} x1={`${i * 5}%`} y1="0" x2={`${i * 5}%`} y2="100%" stroke="#94a3b8" strokeWidth="1" />
          ))}
        </svg>

        {/* Region label */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.2em]" style={{ background: "rgba(15,23,42,0.8)", color: "#475569", border: "1px solid rgba(148,163,184,0.08)" }}>
          Metro Detroit / Grosse Pointe
        </div>

        {/* Pins */}
        {pins.map((pin, i) => (
          <div key={i} className="absolute group" style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)" }}>
            <MapPin className="h-6 w-6 drop-shadow-lg cursor-pointer transition-transform hover:scale-125" style={{ color: typeColors[pin.type] }} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.15)" }}>
              {pin.label}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6">
        {[{ type: "web", label: "Web & SEO" }, { type: "automation", label: "Automation" }, { type: "hardware", label: "Hardware/IT" }].map((l) => (
          <div key={l.type} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: typeColors[l.type] }} />
            <span className="text-xs font-medium" style={{ color: "#64748b" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default LocalFootprintMap;
