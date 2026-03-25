import { Droplets, Wind, Activity, Eye, ArrowRight, ChevronRight } from "lucide-react";

const capabilities = [
  { icon: Droplets, title: "Hydraulics & Lubrication", text: "High-pressure fluid power systems designed for maximum durability." },
  { icon: Wind, title: "Pneumatics", text: "Efficient air-driven automation and conveyance components." },
  { icon: Activity, title: "Motion Control", text: "Precision servos, drives, and highly accurate positioning systems." },
  { icon: Eye, title: "Robotics & Vision", text: "Automated assembly, machine tending, and advanced inspection." },
];

const partners = [
  "Parker Hannifin", "Festo", "SMC", "Bosch Rexroth", "FANUC", "Cognex",
  "Siemens", "Allen-Bradley", "Mitsubishi", "ABB", "Keyence", "Omron",
];

const YoungbloodMockup = () => (
  <div className="min-h-screen bg-slate-950 text-white font-sans antialiased">
    {/* Navbar */}
    <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <span className="text-sm font-extrabold tracking-[0.25em] uppercase text-white">Youngblood Automation</span>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold uppercase tracking-widest border border-white/20 rounded text-white/70 hover:text-white hover:border-white/40 transition-colors">Client Portal</a>
          <a href="#contact" className="px-4 py-2 text-xs font-semibold uppercase tracking-widest bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-colors">Contact Engineering</a>
        </div>
      </div>
    </nav>

    {/* Hero */}
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1920&q=30')] bg-cover bg-center opacity-15" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
      <div className="relative z-10 max-w-4xl mx-auto text-center px-6 animate-[fade-in_1s_ease-out]">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
          Precision Motion.<br />
          <span className="text-cyan-400">Infinite Scalability.</span>
        </h1>
        <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Advanced robotics, pneumatics, and motion control for the modern manufacturing floor. We engineer the systems that power industry.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#contact" className="w-full sm:w-auto px-8 py-4 text-sm font-bold uppercase tracking-widest bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-colors text-center">
            Build Your Solution
          </a>
          <a href="#" className="w-full sm:w-auto px-8 py-4 text-sm font-bold uppercase tracking-widest border border-white/20 rounded text-white/70 hover:text-white hover:border-white/40 transition-colors text-center">
            Access 3D CAD Library
          </a>
        </div>
      </div>
    </section>

    {/* Capabilities */}
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-cyan-400 text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center animate-[fade-in_0.7s_ease-out]">What We Do</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-16 animate-[fade-in_0.7s_ease-out]">Engineered Solutions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {capabilities.map((c, i) => (
            <div
              key={c.title}
              className="group bg-white/[0.03] border border-white/10 rounded-xl p-7 hover:border-cyan-500/50 transition-all duration-300 animate-[fade-in_0.7s_ease-out]"
              style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
            >
              <c.icon className="text-cyan-400 mb-5" size={32} strokeWidth={1.5} />
              <h3 className="text-lg font-bold mb-2">{c.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Trust Banner */}
    <section className="py-16 border-y border-white/5 bg-white/[0.01]">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="text-white/30 text-sm mb-8">Partnered with over <span className="text-cyan-400 font-bold">60+</span> industry-leading manufacturers to deliver uncompromising quality.</p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          {partners.map((p) => (
            <span key={p} className="text-xs font-semibold uppercase tracking-widest text-white/20">{p}</span>
          ))}
        </div>
      </div>
    </section>

    {/* Legacy Integration */}
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center animate-[fade-in_0.7s_ease-out]">
        <p className="text-cyan-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Enterprise Access</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-6">Seamless Procurement</h2>
        <p className="text-white/40 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Access our complete catalog of over 10,000 parts, download 3D CAD models, and manage your account through our secure enterprise portal.
        </p>
        <a href="#" className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded hover:border-cyan-500/50 hover:text-cyan-400 transition-all">
          Enter the Legacy Portal <ArrowRight size={16} />
        </a>
      </div>
    </section>

    {/* Contact */}
    <section id="contact" className="py-24 px-6 bg-white/[0.02] border-t border-white/5">
      <div className="max-w-xl mx-auto text-center animate-[fade-in_0.7s_ease-out]">
        <h2 className="text-2xl font-extrabold mb-3">Start a Conversation</h2>
        <p className="text-white/40 text-sm mb-10">Tell us about your application and our engineering team will follow up within one business day.</p>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-left">
          <input placeholder="Company Name" className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none transition-colors" />
          <input placeholder="Your Name" className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none transition-colors" />
          <input placeholder="Email" type="email" className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none transition-colors" />
          <textarea placeholder="Describe your application…" rows={4} className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none transition-colors resize-none" />
          <button type="submit" className="w-full py-4 text-sm font-bold uppercase tracking-widest bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-colors">
            Submit Inquiry
          </button>
        </form>
      </div>
    </section>

    {/* Footer */}
    <footer className="py-10 px-6 border-t border-white/5 text-center">
      <p className="text-xs text-white/20 mb-1">Locations: Grand Rapids&ensp;|&ensp;Metro Detroit</p>
      <p className="text-xs text-white/15">&copy; 2026 Youngblood Automation. All rights reserved.</p>
    </footer>
  </div>
);

export default YoungbloodMockup;
