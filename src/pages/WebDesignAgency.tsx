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
import {
  Phone, Globe, Zap, Shield, Star, ArrowRight, CheckCircle,
  Clock, MapPin, DollarSign, Wrench, Users, TrendingUp
} from "lucide-react";

/* ── Hard data that makes the page feel real ─────── */
const PHONE = "(313) 806-4952";

const RESULTS = [
  { before: "No website", after: "Ranked #1 on Google Maps within 6 weeks", industry: "Plumber · Eastpointe" },
  { before: "5-year-old outdated site", after: "Phone calls up 3× in the first month", industry: "Roofer · Grosse Pointe" },
  { before: "Facebook page only", after: "Booked 4 new jobs the first week the site went live", industry: "Electrician · Harper Woods" },
];

const DEMOS = [
  {
    category: "Trades & Contractors",
    color: "#dc2626",
    desc: "Built to generate calls. Emergency CTAs, insurance claim flows, Google Maps integration.",
    demos: [
      { label: "Plumbing", to: "/demo-plumber" },
      { label: "Roofing", to: "/demo-roofing" },
      { label: "Electrical", to: "/demo-electrician" },
      { label: "HVAC", to: "/demo-hvac" },
      { label: "Auto Repair", to: "/demo-auto-repair" },
    ],
  },
  {
    category: "Medical, Dental & Legal",
    color: "#0d9488",
    desc: "Trust-first design with credentials, booking, insurance info, and Google reviews front and center.",
    demos: [
      { label: "Dental Practice", to: "/demo-dental" },
      { label: "Medical Clinic", to: "/demo-clinic" },
      { label: "Law Firm", to: "/demo-lawyer" },
    ],
  },
  {
    category: "Local Business & Hospitality",
    color: "#92400e",
    desc: "Menus, galleries, reservations, events — everything a local shop needs to get found and fill seats.",
    demos: [
      { label: "Restaurant & Bar", to: "/demo-restaurant" },
      { label: "Landscaping", to: "/demo-landscaping" },
      { label: "Cleaning Service", to: "/demo-cleaning" },
      { label: "Barbershop & Salon", to: "/demo-salon" },
    ],
  },
  {
    category: "Real Estate & Professional",
    color: "#1e3a5f",
    desc: "Credibility-first design for agents and professionals. Listings, bio, testimonials, and contact.",
    demos: [
      { label: "Real Estate Agent", to: "/demo-real-estate" },
    ],
  },
];

const INCLUDED = [
  "Professional copywriting — I write every word",
  "Mobile-first design that loads fast on any phone",
  "Custom quote/contact forms that send directly to you",
  "Google Business Profile setup and optimization",
  "Google Maps embedding + click-to-call buttons",
  "SSL certificate + reliable hosting included",
  "Your domain connected and configured",
  "SEO meta tags on every page",
  "Live in 7 business days or less",
  "1 round of revisions included",
  "Your direct line to me — forever",
];

const WHY = [
  {
    icon: MapPin,
    title: "I'm local. You're not a ticket.",
    desc: "I run a business in Grosse Pointe. I know Mack Ave, I know the East Side market, I know what your customers are actually searching for. You get my personal cell — not a help desk.",
  },
  {
    icon: DollarSign,
    title: "Transparent pricing. Zero surprises.",
    desc: "$499 flat to build it. $49 a month to keep it running. That's it. No upsells, no 12-month agency contracts, no hourly billing.",
  },
  {
    icon: Clock,
    title: "Live in 7 days.",
    desc: "Most agencies take 6–8 weeks. I take 7 days. You send me your info on Monday, your site is live by the following Monday.",
  },
  {
    icon: TrendingUp,
    title: "Built to rank on Google.",
    desc: "Every site I build is optimized for local search from day one. Proper meta tags, schema markup, GBP sync, and keyword-matched copy.",
  },
];

const FAQS = [
  {
    q: "What if I already have a website?",
    a: "If it's not converting, it's not working — doesn't matter how old or new it is. I'll review your current site for free and be honest about whether it needs a full rebuild or just improvements.",
  },
  {
    q: "Do I need to provide photos and content?",
    a: "No. I write every word of copy. For photos, we'll either use images you have, stock photos that look real, or I'll advise on a quick local photo shoot (usually just a few hours).",
  },
  {
    q: "What's included in the $49/month?",
    a: "Hosting, SSL, security updates, performance monitoring, and unlimited text/image updates. Need to update your hours? Add a new service? Change a price? Text me and it's done, usually same day.",
  },
  {
    q: "What industries do you work with?",
    a: "Contractors, trades, medical, dental, legal, restaurants, fitness, auto repair, real estate, and most local service businesses. If you serve the Metro Detroit area, I can build it.",
  },
  {
    q: "Do you do Google Ads or SEO?",
    a: "I handle technical on-page SEO in every build. For active Google Ads management, I offer a $99/month add-on. The site itself is set up so ads work from day one.",
  },
];

/* ── Component ─────────────────────────────────────── */
const WebDesignAgency = () => {
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", description: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      // Also save to web_design_leads table for admin CRM
      await supabase.from("web_design_leads" as any).insert({
        name: form.name,
        business: form.business,
        phone: form.phone,
        email: form.email,
        description: form.description,
        status: "new",
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong. Call me directly — (313) 806-4952");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Detroit & Grosse Pointe Web Design | Sites That Get You Clients"
        description="Affordable, high-converting websites for contractors, trades, and local businesses in Metro Detroit. $499 flat. Live in 7 days. No agency BS."
        path="/detroit-web-design"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Matt Michels Web Design",
          description: "High-converting websites for Detroit-area contractors and local businesses. $499 flat, live in 7 days.",
          telephone: PHONE,
          areaServed: ["Grosse Pointe", "Detroit", "Harper Woods", "St. Clair Shores", "Eastpointe", "Warren", "Roseville"],
          priceRange: "$$",
          url: "https://www.mattmichelstraining.com/detroit-web-design",
        }}
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* ── HERO ───────────────────────────────── */}
        <section className="relative pt-20 pb-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <MapPin size={11} /> Metro Detroit Web Design
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6 tracking-tight">
              Your Competitors Are Getting{" "}
              <span className="text-primary">Your Calls.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              If your website doesn't show up on Google — or looks like it was built in 2012 — you're losing jobs to someone worse than you. I fix that. Fast.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20"
                onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Get My Free Site Review <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="inline-flex items-center justify-center gap-2 text-base px-6 py-3 rounded-xl border border-border/60 hover:border-primary/50 transition-colors font-medium"
              >
                <Phone size={16} /> {PHONE}
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              $499 flat build fee · $49/month hosting · Live in 7 days · No contracts
            </p>
          </div>
        </section>

        {/* ── REAL RESULTS ───────────────────────── */}
        <section className="px-4 pb-20">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground mb-6 font-bold">Real Results from Metro Detroit Clients</p>
            <div className="grid md:grid-cols-3 gap-4">
              {RESULTS.map((r) => (
                <div key={r.industry} className="bg-card/60 border border-border/40 rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-bold">{r.industry}</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-black flex items-center justify-center">✕</span>
                      <p className="text-sm text-muted-foreground">{r.before}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">✓</span>
                      <p className="text-sm font-semibold">{r.after}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT MATT ─────────────────────────── */}
        <section className="px-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <Card className="border-primary/20 bg-card/60">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
                <div className="shrink-0 w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary text-3xl font-black">
                  M
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-bold">Matt Michels</h2>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Grosse Pointe, MI</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                    I own M2 Training — a coaching platform I built from scratch, including a full AI app with 2,000+ users. I use those same development skills to build local business websites that actually rank and convert. When I take on a web design client, you get my personal cell. You're not a ticket in some agency system.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Local business owner", "20+ years local market", "Direct cell access", "No outsourcing"].map((t) => (
                      <span key={t} className="text-[10px] px-2 py-1 bg-muted rounded-md text-muted-foreground font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── WHY MATT ───────────────────────────── */}
        <section className="px-4 pb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Why Local Businesses Work with Me</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {WHY.map((w) => (
                <div key={w.title} className="flex gap-4 p-5 bg-card/50 border border-border/40 rounded-xl">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <w.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1.5">{w.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DEMO PORTFOLIO ─────────────────────── */}
        <section className="px-4 pb-24 bg-muted/20">
          <div className="max-w-5xl mx-auto py-16">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Live Site Demos</h2>
              <p className="text-muted-foreground">Click any demo to see a full working website — these are real examples of what I build.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {DEMOS.map((cat) => (
                <div key={cat.category} className="bg-card border border-border/40 rounded-xl overflow-hidden">
                  <div className="h-1.5 w-full" style={{ background: cat.color }} />
                  <div className="p-5">
                    <h3 className="font-bold text-base mb-2">{cat.category}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{cat.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.demos.map((d) => (
                        <Link
                          key={d.to}
                          to={d.to}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                        >
                          <Globe size={10} /> {d.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT'S INCLUDED ───────────────────── */}
        <section className="px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Everything Included. Nothing Extra.</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  When agencies quote $3,000–$8,000, they're charging for project managers, account managers, and developers who've never run a business. You're paying for overhead, not results.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  I do all of it myself — design, copy, development, SEO. You pay for the work, not the bloat.
                </p>
              </div>
              <div className="space-y-2.5">
                {INCLUDED.map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle size={15} className="text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
                <Link to="/whats-included" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium">
                  Full details on what's included <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────── */}
        <section className="px-4 pb-24 bg-muted/20">
          <div className="max-w-3xl mx-auto py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Simple Pricing</h2>
            <p className="text-muted-foreground text-center mb-10">No hidden fees. No 12-month contracts. No surprises.</p>
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <Card className="border-primary/30 bg-card/80">
                <CardContent className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                    <Wrench size={20} className="text-primary" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Build</p>
                  <p className="text-5xl font-black text-primary mb-1">$499</p>
                  <p className="text-sm font-semibold text-muted-foreground mb-4">One-time flat fee</p>
                  <ul className="text-sm text-left space-y-1.5">
                    {["Full site built from scratch", "Professional copywriting", "Live in 7 days", "1 revision round"].map(i => (
                      <li key={i} className="flex items-center gap-2"><CheckCircle size={12} className="text-primary shrink-0" />{i}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border/40 bg-card/60">
                <CardContent className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Shield size={20} className="text-foreground" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Maintenance</p>
                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-5xl font-black">$49</span>
                    <span className="text-lg text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground mb-4">Month-to-month, cancel anytime</p>
                  <ul className="text-sm text-left space-y-1.5">
                    {["Hosting + SSL included", "Unlimited text/image edits", "Security & speed updates", "Direct access to me"].map(i => (
                      <li key={i} className="flex items-center gap-2"><CheckCircle size={12} className="text-foreground/60 shrink-0" />{i}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Optional add-on: Google Ads management for <span className="font-semibold text-foreground">$99/month</span>
            </p>
          </div>
        </section>

        {/* ── ADD-ON SERVICES ───────────────────── */}
        <section className="px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">More Ways to Grow</h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">A website is the foundation. These add-ons drive more leads after it's live.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                { icon: "📈", name: "Google Ads Management", price: "$99/mo", desc: "I run your campaigns. You take the calls." },
                { icon: "📝", name: "Monthly Content Package", price: "$79/mo", desc: "4 social posts + 1 blog + email newsletter." },
                { icon: "📍", name: "Google Business Profile", price: "$149 + $49/mo", desc: "Rank higher on Google Maps." },
                { icon: "🔍", name: "Local SEO Pages", price: "$299 flat", desc: "10 keyword-targeted pages for your area." },
                { icon: "⭐", name: "Reputation Management", price: "$79/mo", desc: "Respond to every Google review, fast." },
                { icon: "🔄", name: "Website Refresh", price: "$199 flat", desc: "Update copy & CTAs on your existing site." },
              ].map((addon) => (
                <div key={addon.name} className="flex gap-3 p-4 bg-card/50 border border-border/40 rounded-xl hover:border-primary/30 transition-colors">
                  <span className="text-xl shrink-0">{addon.icon}</span>
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{addon.name}</h3>
                      <span className="text-xs font-bold text-primary">{addon.price}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{addon.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link
                to="/web-design-services"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                See all services & pricing <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── REFERRAL PROGRAM ──────────────────── */}
        <section className="px-4 pb-20 bg-muted/20">
          <div className="max-w-3xl mx-auto py-12">
            <div className="flex flex-col sm:flex-row gap-5 items-center p-6 sm:p-8 bg-card border border-primary/20 rounded-2xl">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-2xl">
                🤝
              </div>
              <div className="text-center sm:text-left">
                <h3 className="font-bold text-lg mb-1">Refer a Business. Get $100.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Know a contractor, shop owner, or professional who needs a website? Send them my way — if they sign up, you get <span className="font-semibold text-foreground">$100 cash or a free month of hosting</span>. No forms, no tracking links. Just text me and say you sent them.
                </p>
                <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-primary hover:underline">
                  <Phone size={13} /> Text Matt: {PHONE}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────── */}
        <section className="px-4 pb-24">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="border border-border/40 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-sm hover:bg-muted/30 transition-colors"
                  >
                    {faq.q}
                    <span className="shrink-0 ml-4 text-muted-foreground text-lg leading-none">
                      {openFaq === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── INTAKE FORM ───────────────────────── */}
        <section id="intake-form" className="px-4 pb-24 bg-muted/20">
          <div className="max-w-lg mx-auto py-16">
            {sent ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Got it. I'll call you today.</h2>
                <p className="text-muted-foreground mb-4">I personally review every inquiry. You'll hear from me within a few hours — usually within the hour during business days.</p>
                <p className="text-sm font-semibold">Can't wait? Call or text me directly: <a href="tel:3138064952" className="text-primary hover:underline">{PHONE}</a></p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3">Get Your Free Site Review</h2>
                  <p className="text-muted-foreground text-sm">
                    Tell me about your business. I'll review your current online presence and give you an honest assessment — no pitch, no pressure.
                  </p>
                </div>
                <Card className="border-border/40 bg-card/80">
                  <CardContent className="p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="wd-name">Your Name *</Label>
                          <Input id="wd-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
                        </div>
                        <div>
                          <Label htmlFor="wd-biz">Business Name</Label>
                          <Input id="wd-biz" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Smith Roofing LLC" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="wd-phone">Phone *</Label>
                          <Input id="wd-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-1234" required />
                        </div>
                        <div>
                          <Label htmlFor="wd-email">Email *</Label>
                          <Input id="wd-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@smithroofing.com" required />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="wd-desc">What does your business do? Where are you located?</Label>
                        <Textarea
                          id="wd-desc"
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="We do residential roofing in the Grosse Pointe / Harper Woods area..."
                          rows={4}
                        />
                      </div>
                      <Button type="submit" className="w-full py-6 text-base font-bold" disabled={sending}>
                        {sending ? "Sending..." : "Get My Free Review →"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Or call/text me directly: <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="font-semibold text-foreground hover:text-primary">{PHONE}</a>
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────── */}
        <footer className="border-t border-border/30 py-8 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels Web Design · Grosse Pointe, MI</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="hover:text-foreground transition-colors flex items-center gap-1"><Phone size={12} /> {PHONE}</a>
              <Link to="/whats-included" className="hover:text-foreground transition-colors">What's Included</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default WebDesignAgency;
