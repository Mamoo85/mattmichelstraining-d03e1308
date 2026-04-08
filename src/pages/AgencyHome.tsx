import { Link } from "react-router-dom";
import { Globe, PhoneForwarded, ShieldCheck, Search, Monitor, Wrench, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  { icon: Globe, title: "Web Design", desc: "Custom websites built to convert visitors into paying customers.", link: "/web-design-services" },
  { icon: PhoneForwarded, title: "24/7 Call Routing Engine", desc: "Never miss a call. Our automated voice system answers, qualifies, and books leads around the clock.", link: "/ai-phone-answering" },
  { icon: ShieldCheck, title: "SEO Guard", desc: "Weekly monitoring so Google never loses track of your business.", link: "/seo-guard" },
  { icon: Search, title: "Free Site Diagnostic", desc: "Our automated scanner reveals exactly what's costing you leads.", link: "/ai-website-audit" },
  { icon: Monitor, title: "Review Command Center", desc: "Monitor reviews, respond instantly, build 5-star social proof.", link: "/ai-reputation-dashboard" },
  { icon: Wrench, title: "Computer Repair", desc: "Local Grosse Pointe hardware repair & remote tech support.", link: "/computer-repair" },
];

const stats = [
  { value: "64+", label: "Automation Products" },
  { value: "$0", label: "Site Diagnostic" },
  { value: "24/7", label: "Call Engine" },
  { value: "7-Day", label: "Free Trials" },
];

const AgencyHome = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(217_91%_30%/0.3),transparent_70%)]" />
      <div className="relative container max-w-5xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-bold uppercase tracking-widest mb-6">
          Detroit Web Agency
        </div>
        <h1 className="font-industrial text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-6">
          Building Digital Engines<br className="hidden sm:block" /> for Michigan Businesses.
        </h1>
        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
          We engineer high-performance websites and automated systems that capture leads, book appointments, and do the heavy lifting for you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 text-base font-bold">
            <Link to="/ai-website-audit">Run a Free Site Audit <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-slate-600 text-slate-200 hover:bg-slate-800 px-8 text-base">
            <Link to="/all-services">View All Services</Link>
          </Button>
        </div>
      </div>
    </section>

    {/* Stats */}
    <section className="border-b border-border bg-muted/30">
      <div className="container max-w-4xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-2xl md:text-3xl font-black text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>

    {/* Services Grid */}
    <section className="container max-w-5xl mx-auto px-4 py-16">
      <h2 className="font-industrial text-2xl md:text-3xl text-center mb-3">What We Build & Automate</h2>
      <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
        Every service is designed to run on autopilot. You get the results — we handle the tech.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s) => (
          <Link
            key={s.title}
            to={s.link}
            className="group border border-border rounded-xl p-6 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
          >
            <s.icon className="h-8 w-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold mb-2 group-hover:text-cyan-400 transition-colors">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>
    </section>

    {/* Trust / Why Us */}
    <section className="bg-muted/30 border-y border-border py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <h2 className="font-industrial text-2xl md:text-3xl text-center mb-10">Why Michigan Businesses Choose Us</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            "Websites that generate leads, not just look pretty",
            "64+ automation products — all running while you sleep",
            "Local to Grosse Pointe — we know Michigan business",
            "No contracts. No BS. Cancel anytime.",
            "Automated prospecting finds YOUR customers",
            "From $19/mo — cheaper than your coffee habit",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="container max-w-3xl mx-auto px-4 py-16 text-center">
      <h2 className="font-industrial text-2xl md:text-3xl mb-4">Ready to Stop Losing Leads?</h2>
      <p className="text-muted-foreground mb-8">
        Get a free automated audit of your website in under 60 seconds. No signup required.
      </p>
      <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-10 text-base font-bold">
        <Link to="/ai-website-audit">Get Your Free Diagnostic <ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    </section>
  </div>
);

export default AgencyHome;
