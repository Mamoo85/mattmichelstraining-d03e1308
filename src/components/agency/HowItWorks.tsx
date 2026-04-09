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
        {steps.map((s) => (
          <div key={s.num} className="relative rounded-xl p-8 text-center" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <div className="text-5xl font-black mb-4" style={{ color: "rgba(34,211,238,0.1)" }}>{s.num}</div>
            <s.icon className="h-8 w-8 mx-auto mb-4" style={{ color: "#22d3ee" }} />
            <h3 className="text-lg font-bold mb-3" style={{ color: "#e2e8f0" }}>{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
