import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ExternalLink, Phone, Globe, MapPin, MessageSquare } from "lucide-react";

const PROJECTS = [
  {
    name: "Stewart Orthopedics",
    industry: "Medical / Orthopedic Surgery",
    description:
      "Professional medical practice website with service pages, provider bios, and patient-focused design. Mobile-first, fast-loading, HIPAA-adjacent (no patient data).",
    services: ["Custom Website", "Hosting & Maintenance"],
    status: "Live",
  },
];

const CAPABILITIES = [
  {
    icon: Globe,
    title: "Custom Websites",
    desc: "Mobile-first, fast-loading sites built for your trade. Not templates — built around your business.",
  },
  {
    icon: MapPin,
    title: "Google Business Auto-Posts",
    desc: "AI writes and publishes 3x/week to your Google Business Profile. More visibility, zero effort.",
  },
  {
    icon: MessageSquare,
    title: "Missed Call Text-Back",
    desc: "Every missed call triggers an instant text to the caller. Never lose a lead to voicemail again.",
  },
];

export default function Portfolio() {
  return (
    <>
      <SEOHead
        title="Portfolio — M² Development | Grosse Pointe Web Design"
        description="Websites and digital tools built for local service businesses. See our work."
        path="/portfolio"
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 bg-[#1e293b] text-white">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8621a]/20 text-[#e8621a] text-[11px] font-bold tracking-widest uppercase mb-6">
              <Globe size={11} /> Our Work
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Built for <span className="text-[#e8621a]">Local Businesses</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Real websites and digital tools for contractors, medical practices,
              and service businesses in Metro Detroit.
            </p>
          </div>
        </section>

        {/* Projects */}
        <section className="px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black mb-8">Recent Projects</h2>
            <div className="space-y-6">
              {PROJECTS.map((project) => (
                <Card key={project.name} className="border-border/40 bg-card/60">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#e8621a] mb-1">
                          {project.industry}
                        </p>
                        <h3 className="text-xl font-black mb-2">
                          {project.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mb-4">
                          {project.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {project.services.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-1 rounded-md bg-[#e8621a]/10 text-[#e8621a] text-xs font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-bold">
                        {project.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-sm text-muted-foreground mt-8 text-center">
              More projects coming soon. Each client gets a custom build — no
              templates, no cookie-cutter designs.
            </p>
          </div>
        </section>

        {/* What We Build */}
        <section className="px-4 py-16 bg-[#f8fafc] dark:bg-card/30 border-y border-border/40">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">
              What We Build
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {CAPABILITIES.map((cap) => (
                <Card key={cap.title} className="border-border/40 bg-card/60">
                  <CardContent className="p-6 text-center">
                    <cap.icon className="mx-auto text-[#e8621a] mb-3" size={28} />
                    <h3 className="font-bold mb-2">{cap.title}</h3>
                    <p className="text-sm text-muted-foreground">{cap.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 text-center">
          <h2 className="text-2xl font-black mb-3">Want Something Like This?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Free website audit + a conversation about what your business actually
            needs. No pressure, no contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/digital-foundation">
              <Button className="bg-[#e8621a] hover:bg-[#d4570f] text-white px-6 py-3 font-bold">
                See Our Packages <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <a
              href="tel:+13138064952"
              className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 rounded-lg font-medium hover:bg-muted/50 transition"
            >
              <Phone size={14} /> (313) 806-4952
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
