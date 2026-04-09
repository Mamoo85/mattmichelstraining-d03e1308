import { Search, Wrench, TrendingUp } from "lucide-react";

const steps = [
  { num: "01", icon: Search, title: "We Scan Your Site", desc: "Our automated systems run a full diagnostic on your online presence — speed, SEO, mobile, competitors — in under 60 seconds." },
  { num: "02", icon: Wrench, title: "We Build Your System", desc: "We engineer a custom website and lead automation system designed for your specific industry and service area." },
  { num: "03", icon: TrendingUp, title: "You Get Booked Jobs", desc: "Leads flow in automatically. Your phone rings, your calendar fills up, and your revenue grows — while you focus on the work." },
];

const HowItWorks = () => (
  <section className="py-20" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
    <div className="container max-w-5xl mx-auto px-4">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
          How It Works
        </h2>
        <p style={{ color: "#64748b" }}>Three steps. Zero complexity on your end.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((s, i) => (
          <div key={s.num} className="relative rounded-xl p-8 text-center group transition-all duration-300 hover:translate-y-[-4px]" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            {/* Connecting line between cards */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px" style={{ background: "rgba(34,211,238,0.2)" }} />
            )}
            {/* Large number watermark */}
            <div className="text-6xl font-black mb-4 transition-colors duration-300" style={{ color: "rgba(34,211,238,0.08)" }}>
              {s.num}
            </div>
            {/* Icon with glow ring */}
            <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full mb-5" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
              <s.icon className="h-6 w-6" style={{ color: "#22d3ee" }} />
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ color: "#e2e8f0" }}>{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
