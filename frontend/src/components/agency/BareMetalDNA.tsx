import { Cpu, Server, Cloud, Zap } from "lucide-react";

const stages = [
  { icon: Cpu, label: "Motherboard", desc: "We started fixing hardware — circuit boards, GPUs, broken laptops." },
  { icon: Server, label: "Server", desc: "Built and racked servers for local businesses. Real infrastructure." },
  { icon: Cloud, label: "Cloud", desc: "Migrated clients to scalable cloud systems with enterprise uptime." },
  { icon: Zap, label: "Lead Engine", desc: "Now we engineer the same reliability into your digital revenue pipeline." },
];

const BareMetalDNA = () => (
  <section className="py-20" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
    <div className="container max-w-5xl mx-auto px-4">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>Our DNA</h2>
        <p className="max-w-xl mx-auto" style={{ color: "#64748b" }}>
          We started fixing motherboards. Today we engineer the same reliability into your digital infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {stages.map((s, i) => (
          <div key={s.label} className="relative text-center p-6 rounded-xl" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            {i < stages.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 text-lg" style={{ color: "rgba(34,211,238,0.3)" }}>→</div>
            )}
            <s.icon className="h-8 w-8 mx-auto mb-4" style={{ color: "#22d3ee" }} />
            <h3 className="text-sm font-bold mb-2" style={{ color: "#e2e8f0" }}>{s.label}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BareMetalDNA;
