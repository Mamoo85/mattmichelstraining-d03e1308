import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Globe, Zap, Users, Calendar, ShieldCheck, Star, ArrowRight, CheckCircle } from "lucide-react";

const portfolioCards = [
  {
    title: "The Contractor",
    subtitle: "Built for Roofers, Plumbers, & HVAC",
    features: ["Instant quote forms", "Click-to-call buttons", "Mobile-first design"],
    icon: Zap,
    gradient: "from-orange-600/20 to-amber-600/10",
    demos: [
      { label: "Plumber Demo", to: "/demo-plumber" },
      { label: "Electrician Demo", to: "/demo-electrician" },
      { label: "Roofing Demo", to: "/demo-roofing" },
    ],
  },
  {
    title: "The Local Shop",
    subtitle: "Built for Retail & Restaurants",
    features: ["Clean menus", "Business hours & Google Maps", "Photo galleries"],
    icon: Globe,
    gradient: "from-blue-600/20 to-cyan-600/10",
    demos: [
      { label: "Landscaper Demo", to: "/demo-landscaping" },
    ],
  },
  {
    title: "The Pro",
    subtitle: "Built for Lawyers, CPAs, & Consultants",
    features: ["Professional aesthetic", "Booking calendars", "Client trust badges"],
    icon: ShieldCheck,
    gradient: "from-emerald-600/20 to-green-600/10",
    demos: [
      { label: "Attorney Demo", to: "/demo-lawyer" },
      { label: "MedSpa Demo", to: "/demo-clinic" },
    ],
  },
];

const WebDesignAgency = () => {
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", description: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      toast.error("Please fill in your name, email, and phone.");
      return;
    }
    setSending(true);
    try {
      await supabase.functions.invoke("notify-coach-question", {
        body: {
          subject: `🌐 New Web Design Lead: ${form.business || form.name}`,
          message: `Name: ${form.name}\nBusiness: ${form.business}\nPhone: ${form.phone}\nEmail: ${form.email}\n\nWhat they do:\n${form.description}`,
          userEmail: form.email,
        },
      });
      toast.success("Got it! I'll be in touch within 24 hours.");
      setForm({ name: "", business: "", phone: "", email: "", description: "" });
    } catch {
      toast.error("Something went wrong. Call me directly instead!");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Grosse Pointe & Detroit Web Design | Sites That Get You Clients"
        description="Affordable, high-converting websites for contractors, trades, and local businesses in Metro Detroit. Built by a local business owner."
        path="/detroit-web-design"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Matt Michels Web Design",
          description: "High-converting websites for Detroit-area contractors and local businesses.",
          areaServed: ["Grosse Pointe", "Detroit", "Metro Detroit"],
          priceRange: "$$",
        }}
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="relative overflow-hidden pt-20 pb-24 px-4">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-widest uppercase mb-6">
              Metro Detroit Web Design
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6">
              Stop Losing Local Jobs to{" "}
              <span className="text-primary">Ugly Websites.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              I build simple, lightning-fast, high-converting websites for Detroit-area contractors and local businesses. No agency BS. Just a site that makes your phone ring.
            </p>
            <Button
              size="lg"
              className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20"
              onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Get Your Site Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>

        {/* Trust / About Matt */}
        <section className="px-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <Card className="border-border/50 bg-card/60 backdrop-blur">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
                <div className="shrink-0 w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-black">
                  M
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-2">Built by a Local Business Owner, Not an Agency.</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    I'm Matt. I run a local business in Grosse Pointe. I built my own complex AI web platform, and I use those same development skills to help local tradesmen get more leads. You get my direct cell phone number, not an outsourced help desk.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Portfolio Mockups */}
        <section className="px-4 pb-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">What You Get</h2>
              <p className="text-muted-foreground">Clean, fast sites purpose-built for your industry.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {portfolioCards.map((card) => (
                <Card key={card.title} className="border-border/40 bg-card/50 overflow-hidden group hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-5`}>
                      <card.icon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{card.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{card.subtitle}</p>
                    <ul className="space-y-2">
                      {card.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {card.demos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border/30">
                        {card.demos.map((d) => (
                          <Link key={d.to} to={d.to} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {d.label} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="px-4 pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Simple, Honest Pricing</h2>
            <p className="text-muted-foreground mb-10">No hidden fees. No surprise invoices. No 12-month contracts.</p>
            <div className="grid sm:grid-cols-2 gap-6">
              <Card className="border-primary/30 bg-card/60">
                <CardContent className="p-8 text-center">
                  <Star className="h-8 w-8 text-primary mx-auto mb-4" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">The Setup</p>
                  <p className="text-4xl font-black text-primary mb-2">$499</p>
                  <p className="text-sm font-medium mb-4">Flat Build Fee</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We write the copy, build the site, and get it live in 7 days.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/40 bg-card/60">
                <CardContent className="p-8 text-center">
                  <Users className="h-8 w-8 text-primary mx-auto mb-4" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">The Engine</p>
                  <p className="text-4xl font-black mb-2">$49<span className="text-lg font-medium text-muted-foreground">/mo</span></p>
                  <p className="text-sm font-medium mb-4">Hosting & Management</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    I keep the servers running, handle all tech updates, and make text/image changes whenever you need them. You just focus on your business.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Intake Form */}
        <section id="intake-form" className="px-4 pb-24">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Let's Talk</h2>
              <p className="text-muted-foreground text-sm">Fill this out and I'll call you within 24 hours. No pressure, no contracts.</p>
            </div>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="wd-name">Your Name *</Label>
                    <Input id="wd-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
                  </div>
                  <div>
                    <Label htmlFor="wd-biz">Business Name</Label>
                    <Input id="wd-biz" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Smith Roofing LLC" />
                  </div>
                  <div>
                    <Label htmlFor="wd-phone">Phone *</Label>
                    <Input id="wd-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-1234" required />
                  </div>
                  <div>
                    <Label htmlFor="wd-email">Email *</Label>
                    <Input id="wd-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@smithroofing.com" required />
                  </div>
                  <div>
                    <Label htmlFor="wd-desc">What does your business do?</Label>
                    <Textarea id="wd-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="We do residential roofing in the Grosse Pointe area..." rows={4} />
                  </div>
                  <Button type="submit" className="w-full py-6 text-base" disabled={sending}>
                    {sending ? "Sending..." : "Get My Free Consultation"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="border-t border-border/30 py-8 px-4 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels · Grosse Pointe, MI</p>
        </footer>
      </div>
    </>
  );
};

export default WebDesignAgency;