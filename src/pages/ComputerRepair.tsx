import { Link } from "react-router-dom";
import { Monitor, Wifi, HardDrive, Shield, Wrench, Phone, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  { icon: Monitor, title: "Screen & Display Repair", desc: "Cracked screens, dead pixels, display replacements for laptops and desktops." },
  { icon: HardDrive, title: "Data Recovery", desc: "Recover files from failed hard drives, SSDs, and corrupted storage devices." },
  { icon: Wifi, title: "Network & WiFi Setup", desc: "Home and small business network configuration, mesh WiFi, and troubleshooting." },
  { icon: Shield, title: "Virus & Malware Removal", desc: "Deep scans, rootkit removal, and security hardening to keep you protected." },
  { icon: Wrench, title: "Hardware Upgrades", desc: "RAM, SSD, GPU upgrades to breathe new life into your existing machine." },
  { icon: Phone, title: "Remote Support", desc: "Can't bring it in? We'll connect remotely and fix it from anywhere in Michigan." },
];

const ComputerRepair = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
      <div className="relative container max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-300 text-xs font-bold uppercase tracking-widest mb-6">
          <MapPin className="h-3.5 w-3.5" /> Grosse Pointe & Detroit
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-widest mb-4">
          M2 Computer Repair
        </div>
        <h1 className="font-industrial text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-6">
          Local Computer Repair<br />& Remote Tech Support
        </h1>
        <p className="text-lg text-slate-300 max-w-xl mx-auto mb-8">
          Fast, affordable repairs for home and small business. In-person in Grosse Pointe or remote support anywhere in Michigan.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 text-base font-bold">
            <a href="tel:3139921219">Call (313) 992-1219 <Phone className="ml-2 h-4 w-4" /></a>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-slate-600 text-slate-200 hover:bg-slate-800 px-8 text-base">
            <Link to="/tech-support">Book Online</Link>
          </Button>
        </div>
      </div>
    </section>

    {/* Services */}
    <section className="container max-w-5xl mx-auto px-4 py-16">
      <h2 className="font-industrial text-2xl md:text-3xl text-center mb-3">What We Fix</h2>
      <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
        From hardware to software — we handle it all. Most repairs completed same-day.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s) => (
          <div key={s.title} className="border border-border rounded-xl p-6">
            <s.icon className="h-8 w-8 text-green-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Pricing */}
    <section className="bg-muted/30 border-y border-border py-16">
      <div className="container max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-black mb-6">Simple Pricing</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="border border-border rounded-xl p-6 bg-background">
            <div className="text-3xl font-black mb-1">$49</div>
            <div className="text-sm text-muted-foreground mb-3">Per session</div>
            <p className="text-sm">One-time repair, diagnostic, or setup. In-person or remote.</p>
          </div>
          <div className="border border-green-500/50 rounded-xl p-6 bg-green-500/5">
            <div className="text-3xl font-black text-green-500 mb-1">$29<span className="text-lg text-muted-foreground">/mo</span></div>
            <div className="text-sm text-muted-foreground mb-3">Monthly plan</div>
            <p className="text-sm">Unlimited remote support + priority scheduling for in-person visits.</p>
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="container max-w-3xl mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl font-black mb-4">Computer Acting Up?</h2>
      <p className="text-muted-foreground mb-6">Call or text — we usually respond within 15 minutes.</p>
      <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white px-10 text-base font-bold">
        <a href="tel:3139921219">Call Now <ArrowRight className="ml-2 h-4 w-4" /></a>
      </Button>
    </section>
  </div>
);

export default ComputerRepair;
