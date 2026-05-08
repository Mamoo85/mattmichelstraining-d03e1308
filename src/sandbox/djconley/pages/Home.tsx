import { Link } from "react-router-dom";
import SiteLayout from "../SiteLayout";
import { ArrowRight, Wrench, Package, Flame, Shield, Phone, Award } from "lucide-react";

export default function DJHome() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative bg-[#0b1622] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(39,204,192,0.4), transparent 50%), radial-gradient(circle at 80% 70%, rgba(193,42,59,0.3), transparent 50%)",
          }}
        />
        <div className="relative max-w-[1280px] mx-auto px-5 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="text-[#27CCC0] text-xs uppercase tracking-[0.4em] mb-4">A name you can</div>
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              TRUST.
            </h1>
            <p className="mt-6 text-xl text-slate-300 max-w-xl leading-relaxed">
              D.J. Conley Associates has been Detroit's trusted source for industrial and commercial boiler solutions since 1948.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sandbox/djconley/service" className="bg-[#c12a3b] hover:bg-[#a02230] px-6 py-3 rounded-md font-semibold inline-flex items-center gap-2 transition">
                Get Service <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/sandbox/djconley/parts" className="bg-[#27CCC0] hover:bg-[#1fa89d] text-[#0b1622] px-6 py-3 rounded-md font-semibold inline-flex items-center gap-2 transition">
                Get Parts <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick service tiles */}
      <section className="max-w-[1280px] mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <div className="text-[#c12a3b] text-xs uppercase tracking-[0.3em] mb-2">What We Do</div>
          <h2 className="text-4xl font-black">Service and Parts</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { i: Wrench, t: "Pressure Vessel", d: "Inspections, repair, replacement, and code compliance." },
            { i: Shield, t: "Preventative Maintenance", d: "Scheduled service to keep your boiler room running." },
            { i: Flame, t: "Combustion Analysis", d: "Tuning for efficiency, emissions, and reliability." },
            { i: Package, t: "Burners", d: "Burner installation, retrofit, and parts." },
            { i: Wrench, t: "Boiler Tune-Up", d: "Annual tune-ups for peak performance." },
            { i: Award, t: "Controls", d: "Modern boiler controls and BMS integration." },
          ].map((s) => (
            <div key={s.t} className="border border-slate-200 rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition group bg-white">
              <s.i className="h-8 w-8 text-[#27CCC0] mb-3" />
              <div className="font-bold text-lg mb-1">{s.t}</div>
              <div className="text-sm text-slate-600">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#111d2b] text-white">
        <div className="max-w-[1280px] mx-auto px-5 py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-black mb-3">24/7 Emergency Service</h2>
            <p className="text-slate-300">When your boiler goes down, we're on the way. Detroit & SE Michigan.</p>
          </div>
          <a href="tel:+12485855340" className="bg-[#c12a3b] hover:bg-[#a02230] px-8 py-4 rounded-md font-semibold text-lg inline-flex items-center justify-center gap-3 md:justify-self-end transition">
            <Phone className="h-5 w-5" /> (248) 585-5340
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
