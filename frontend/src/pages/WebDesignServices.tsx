import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone, ArrowRight, CheckCircle, Check, Building2, Zap,
  Bell, BarChart3, Shield, Clock, Users, Radar, Home, PhoneCall,
  TrendingUp, ShoppingCart, MapPin, Globe, Mail,
} from "lucide-react";

const PHONE = "(313) 992-1219";
const ACCENT = "#00d4ff";

const SITE_RADAR_FEATURES = [
  { icon: <Building2 size={18} />, t: "Company-level identification", b: "We resolve visitor IPs to real company names, cities, and pages — using ipinfo + Clearbit Reveal." },
  { icon: <Zap size={18} />, t: "High-intent SMS alerts", b: "Text alerts when a visitor hits /pricing or /contact, or when one company visits 3+ times in a week." },
  { icon: <BarChart3 size={18} />, t: "Live visitor feed", b: "A clean, real-time dashboard. Filter by company, page, or repeat-visitor score." },
  { icon: <Bell size={18} />, t: "Weekly Monday digest", b: "Every Monday at 7am, an email summary of who showed up — sortable, exportable." },
  { icon: <Shield size={18} />, t: "Privacy-first", b: "We identify companies, not individuals. GDPR / CCPA-friendly. No cookies. No PII." },
  { icon: <Clock size={18} />, t: "5-minute install", b: "One script tag before </body>. Works with WordPress, Webflow, Wix, custom — anything." },
];

const TOP_ADDONS = [
  {
    icon: BarChart3,
    color: ACCENT,
    name: "SiteRadar",
    price: "$49/mo",
    desc: "See which businesses visit your site before they call anyone else. Real-time B2B visitor identification with SMS alerts.",
    href: "/site-radar",
  },
  {
    icon: PhoneCall,
    color: "#f59e0b",
    name: "Missed-Call Catch",
    price: "$99/mo",
    desc: "Auto-text every missed caller within 30 seconds. First business to respond wins the job — every time.",
    href: "/missed-call-catch",
  },
  {
    icon: Radar,
    color: "#8b5cf6",
    name: "Trade Radar",
    price: "$149/mo",
    desc: "Live permit, storm, and homeowner buying signals routed to your trade vertical. One contractor per lead.",
    href: "/trade-radar",
  },
  {
    icon: Users,
    color: "#10b981",
    name: "Contractor Leads",
    price: "$399/mo",
    desc: "Exclusive verified homeowner project leads in your market. Budget confirmed, phone verified. No bidding.",
    href: "/contractor-leads",
  },
];

const WebDesignServices = () => {
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", service: "", details: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: "", business: "", email: "", phone: "", how_they_heard: "" });
  const [partnerSending, setPartnerSending] = useState(false);
  const [partnerSent, setPartnerSent] = useState(false);

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerSending(true);
    try {
      const { error } = await supabase.functions.invoke("partner-onboarding", {
        body: partnerForm,
      });
      if (error) throw error;
      setPartnerSent(true);
    } catch {
      toast.error("Something went wrong. Text me directly at (313) 992-1219");
    } finally {
      setPartnerSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await supabase.functions.invoke("notify-coach-question", {
        body: {
          subject: `🌐 Web Design Service Inquiry: ${form.service || "General"} — ${form.business || form.name}`,
          message: `Name: ${form.name}\nBusiness: ${form.business}\nPhone: ${form.phone}\nEmail: ${form.email}\nService Interest: ${form.service}\n\nMessage:\n${form.details}`,
          userEmail: form.email,
        },
      });
      await supabase.from("web_design_leads" as any).insert({
        name: form.name,
        business: form.business,
        phone: form.phone,
        email: form.email,
        description: `Service interest: ${form.service}. ${form.details}`,
        status: "new",
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong. Call me directly — (313) 992-1219");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Web Design & Digital Automation | Detroit Web Agency"
        description="We build sites that generate leads, then layer in live signals, visitor tracking, and automation that keep the phone ringing. Local. Direct. No agency fluff."
        path="/web-design-services"
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* ── HERO ── */}
        <section className="relative pt-24 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Detroit Web Agency · Grosse Pointe, MI
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-5 tracking-tight">
              A website that works<br />
              <span className="text-primary">while you sleep.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              We build, host, and run sites for local contractors and service businesses — then layer in live signals, visitor tracking, and automation that keep the phone ringing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-base px-8 py-5 rounded-xl font-bold"
                onClick={() => document.getElementById("site-radar-section")?.scrollIntoView({ behavior: "smooth" })}
              >
                See what's included <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="inline-flex items-center justify-center gap-2 text-base px-6 py-3 rounded-xl border border-border/60 hover:border-primary/50 transition-colors font-medium"
              >
                <Phone size={15} /> {PHONE}
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Live signals · 47 businesses tracked today</span>
              <span className="flex items-center gap-1.5"><ShoppingCart size={11} />Stripe ecommerce ready</span>
              <span className="flex items-center gap-1.5"><MapPin size={11} />SE Michigan &amp; nationwide</span>
            </div>
          </div>
        </section>

        {/* ── SITE RADAR — HERO FEATURE ── */}
        <section id="site-radar-section" className="px-4 py-24 bg-muted/10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-bold tracking-widest uppercase"
                style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}44`, color: ACCENT }}>
                Featured Add-On · $49/mo
              </div>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight mb-4 tracking-tight">
                See which businesses visit<br />
                <span style={{ color: ACCENT }}>before they call anyone else.</span>
              </h2>
              <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
                SiteRadar resolves your anonymous web traffic to real company names. When a roofing supplier hits your pricing page 3 times in a week, you get a text — before your competitor picks up the phone.
              </p>
            </div>

            {/* Browser mockup */}
            <div className="rounded-xl overflow-hidden border border-border/60 shadow-2xl mb-8 max-w-3xl mx-auto"
              style={{ background: "#0a1628" }}>
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10" style={{ background: "#06101e" }}>
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs text-white/30 font-mono">SiteRadar — Live Visitor Feed</span>
              </div>
              {/* Header row */}
              <div className="grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/30">
                <span>Company</span>
                <span>Page</span>
                <span>Visits</span>
                <span>Last seen</span>
              </div>
              {/* Rows */}
              {[
                { co: "Allied Roofing Supply", page: "/pricing", visits: 3, when: "2 hours ago", hot: true },
                { co: "Motor City HVAC Co.", page: "/contact", visits: 1, when: "Just now", hot: false },
                { co: "Detroit Steel Fabrication", page: "/services", visits: 5, when: "Yesterday", hot: true },
                { co: "Lakewood Contracting LLC", page: "/home", visits: 1, when: "3 hours ago", hot: false },
                { co: "Macomb Plumbing & Heat", page: "/pricing", visits: 2, when: "4 hours ago", hot: false },
              ].map((row) => (
                <div key={row.co} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-white/5 items-center hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 w-2 h-2 rounded-full ${row.hot ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-white/20"}`} />
                    <span className="text-xs text-white font-medium truncate">{row.co}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: ACCENT }}>{row.page}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white">{row.visits}</span>
                    {row.hot && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-black" style={{ background: ACCENT }}>HIGH INTENT</span>}
                  </div>
                  <span className="text-xs text-white/40">{row.when}</span>
                </div>
              ))}
            </div>

            {/* SMS mockup */}
            <div className="flex justify-center mb-12">
              <div className="w-64 rounded-3xl border-2 border-border/50 overflow-hidden shadow-xl" style={{ background: "#1c1c1e" }}>
                <div className="text-center py-2 text-[10px] text-white/40 border-b border-white/10">SiteRadar Alert</div>
                <div className="p-4">
                  <div className="rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed text-white" style={{ background: "#2c2c2e" }}>
                    🔔 <strong>Allied Roofing Supply</strong> hit your pricing page 3× this week — they haven't called yet.
                  </div>
                  <p className="text-[10px] text-white/30 mt-2 text-right">Now · SiteRadar</p>
                </div>
              </div>
            </div>

            {/* Testimonial */}
            <div className="rounded-2xl p-8 text-center mb-14 max-w-3xl mx-auto"
              style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30` }}>
              <p className="text-lg font-semibold leading-relaxed mb-4" style={{ color: "#e2e8f0" }}>
                "Got an SMS at 9:14 AM that a roofing supplier had hit our pricing page three times that morning. Called them at 10. Closed a $12K contract by Friday. SiteRadar paid for itself in week one."
              </p>
              <p className="text-sm font-bold" style={{ color: ACCENT }}>— Mike T., HVAC contractor, Warren MI</p>
            </div>

            {/* Features grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {SITE_RADAR_FEATURES.map((f) => (
                <div key={f.t} className="rounded-xl p-5 border border-border/40" style={{ background: "#0a1628" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${ACCENT}20`, color: ACCENT }}>
                    {f.icon}
                  </div>
                  <p className="font-bold text-sm mb-1">{f.t}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.b}</p>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="rounded-xl overflow-hidden border border-border/40 mb-10 max-w-3xl mx-auto" style={{ background: "#0a1628" }}>
              <div className="grid grid-cols-4 gap-3 px-5 py-3">
                <span />
                <span className="text-sm font-black text-center" style={{ color: ACCENT }}>SiteRadar</span>
                <span className="text-xs text-muted-foreground text-center">Leadfeeder</span>
                <span className="text-xs text-muted-foreground text-center">Albacross</span>
              </div>
              {[
                ["Starting price", "$49/mo", "$199/mo", "$149/mo"],
                ["Real-time SMS alerts", true, false, false],
                ["Weekly digest email", true, true, true],
                ["Setup time", "5 min", "30+ min", "20+ min"],
                ["Per-visit overage fees", "None", "Yes", "Yes"],
                ["Local support", true, false, false],
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-3 px-5 py-3 border-t border-border/30 items-center">
                  <span className="text-xs text-muted-foreground">{row[0]}</span>
                  {[row[1], row[2], row[3]].map((v, j) => (
                    <span key={j} className="text-center">
                      {v === true ? <Check size={14} className="mx-auto" style={{ color: j === 0 ? ACCENT : "#475569" }} />
                        : v === false ? <span className="text-muted-foreground text-xs">—</span>
                        : <span className={`text-xs ${j === 0 ? "font-bold text-white" : "text-muted-foreground"}`}>{v}</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link to="/site-radar">
                <Button size="lg" className="text-base px-8 py-5 rounded-xl font-bold" style={{ background: ACCENT, color: "#0a1628" }}>
                  Add SiteRadar to your site — $49/mo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">5-minute setup · Cancel anytime · No long-term contract</p>
            </div>
          </div>
        </section>

        {/* ── DWA PLATFORM ── */}
        <section className="px-4 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">
                One platform. Every lead signal.<br />All in one place.
              </h2>
              <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
                Every client gets access to the Detroit Web Agency intelligence platform — live permit signals, storm alerts, homeowner buying intent, and radar feeds across 11 trade verticals.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 mb-12">
              {[
                {
                  icon: Radar, color: "#8b5cf6",
                  name: "11 Trade Radars",
                  desc: "Live HVAC, roofing, plumbing, electrical, and 7 more verticals. Sources: BSEED permits, storm alerts, FEMA, court records, assessor data.",
                },
                {
                  icon: Home, color: "#f59e0b",
                  name: "Mortgage Radar",
                  desc: "Foreclosure, probate, estate sale, and pre-distress signals. Daily signals for referral businesses, law firms, and real estate.",
                },
                {
                  icon: PhoneCall, color: "#ef4444",
                  name: "Missed-Call Catch",
                  desc: "Auto-text every missed caller in 30 seconds. Voicemail transcription, Google review push, and callback reminders — automatic.",
                },
                {
                  icon: BarChart3, color: ACCENT,
                  name: "SiteRadar",
                  desc: "B2B visitor identification with high-intent SMS alerts. Know who's evaluating you before they call your competitor.",
                },
              ].map((item) => (
                <div key={item.name} className="rounded-xl p-6 border border-border/40 bg-card/60">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${item.color}18` }}>
                      <item.icon size={20} style={{ color: item.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base mb-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Admin feed mockup */}
            <div className="rounded-xl border border-border/40 overflow-hidden max-w-2xl mx-auto mb-10" style={{ background: "#0a1628" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest">DWA Intelligence Feed · Last 24hrs</span>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              {[
                { type: "🔥 PERMIT", msg: "Roofing permit filed — 4812 Lakeshore Dr, Detroit · Score 9/10", time: "12 min ago" },
                { type: "⚡ STORM", msg: "NOAA hail alert · Oakland County · 3 contractors notified", time: "1 hr ago" },
                { type: "📞 MISSED", msg: "Missed call at Troy HVAC — auto-text sent in 28 sec", time: "2 hrs ago" },
                { type: "👁 VISITOR", msg: "Allied Roofing Supply · 3 visits to /pricing — SMS alert sent", time: "3 hrs ago" },
                { type: "🏠 COURT", msg: "Foreclosure filing · Macomb County · Mortgage Radar client notified", time: "5 hrs ago" },
              ].map((row) => (
                <div key={row.msg} className="flex items-start gap-3 px-4 py-3 border-b border-white/5">
                  <span className="text-xs font-mono shrink-0 w-20 text-white/40">{row.type}</span>
                  <span className="text-xs text-white/80 flex-1 leading-relaxed">{row.msg}</span>
                  <span className="text-xs text-white/30 shrink-0">{row.time}</span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 rounded-xl font-semibold border-primary/40 hover:border-primary hover:text-primary"
                onClick={() => document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Ask about the full platform <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ── TRAFFIC + ECOMMERCE ── */}
        <section className="px-4 py-24 bg-muted/10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">
                We drive traffic.<br />We close it.
              </h2>
              <p className="text-muted-foreground text-base max-w-xl mx-auto">
                Your site shouldn't just look good — it should take money while you sleep.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/15">
                    <TrendingUp size={18} className="text-blue-400" />
                  </div>
                  <h3 className="font-black text-lg">Get found first</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Google Ads management — $99/mo · keyword research, ad copy, bid management",
                    "Local SEO landing pages — 10 city/service pages targeting your exact market",
                    "Google Business Profile setup + weekly posts + review response management",
                    "Schema markup, Core Web Vitals, and mobile speed — included in every build",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/15">
                    <ShoppingCart size={18} className="text-green-400" />
                  </div>
                  <h3 className="font-black text-lg">Close it automatically</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Stripe checkout wiring — sell services, deposits, or subscriptions directly from your site",
                    "Appointment booking — no-shows down, confirmations automatic, reminders sent for you",
                    "Payment links + invoice automation — send, track, and collect without chasing anyone",
                    "Ecommerce ready — product pages, cart, and checkout fully integrated and mobile-first",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── TOP-SHELF ADD-ONS ── */}
        <section className="px-4 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-black mb-3">Add what you need. Drop what you don't.</h2>
              <p className="text-muted-foreground text-sm">Month-to-month on everything. No long-term contracts.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {TOP_ADDONS.map((addon) => (
                <Card key={addon.name} className="border-border/40 bg-card/60 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${addon.color}18` }}>
                        <addon.icon size={20} style={{ color: addon.color }} />
                      </div>
                      <div>
                        <h3 className="font-black text-base">{addon.name}</h3>
                        <span className="text-sm font-black" style={{ color: addon.color }}>{addon.price}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{addon.desc}</p>
                    <Link to={addon.href}>
                      <Button variant="outline" size="sm" className="w-full text-xs border-border/60 hover:border-primary/50 hover:text-primary">
                        Learn more <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── INQUIRY FORM ── */}
        <section id="inquiry-form" className="px-4 pb-24 bg-muted/10">
          <div className="max-w-lg mx-auto py-16">
            {sent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Got it. I'll reach out today.</h2>
                <p className="text-muted-foreground text-sm">You'll hear from me within a few hours. Or call/text me directly:</p>
                <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="text-primary font-semibold hover:underline mt-2 block">{PHONE}</a>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3">Let's talk about your site.</h2>
                  <p className="text-muted-foreground text-sm">No commitment, no pitch — just an honest conversation about what makes sense for your business.</p>
                </div>
                <Card className="border-border/40 bg-card/80">
                  <CardContent className="p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ws-name">Your Name *</Label>
                          <Input id="ws-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
                        </div>
                        <div>
                          <Label htmlFor="ws-biz">Business Name</Label>
                          <Input id="ws-biz" value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} placeholder="Smith Roofing LLC" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ws-phone">Phone *</Label>
                          <Input id="ws-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-1234" required />
                        </div>
                        <div>
                          <Label htmlFor="ws-email">Email</Label>
                          <Input id="ws-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@smithroofing.com" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="ws-service">What are you looking for?</Label>
                        <Input id="ws-service" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} placeholder="e.g. New website, SiteRadar, Trade Radar, Leads..." />
                      </div>
                      <div>
                        <Label htmlFor="ws-details">Tell me about your business</Label>
                        <Textarea
                          id="ws-details"
                          value={form.details}
                          onChange={e => setForm({ ...form, details: e.target.value })}
                          placeholder="What you do, where you're located, what you're trying to achieve..."
                          rows={4}
                        />
                      </div>
                      <Button type="submit" className="w-full py-5 text-base font-bold" disabled={sending}>
                        {sending ? "Sending..." : "Get in Touch →"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Or call/text: <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="font-semibold text-foreground hover:text-primary">{PHONE}</a>
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        {/* ── REFERRAL PARTNER ── */}
        <section id="partner-program" className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Users size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Referral Partner Program</h3>
                    <p className="text-sm text-muted-foreground">Earn $100 cash for every client you send my way</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { step: "01", text: "Sign up below — get your personal referral link" },
                    { step: "02", text: "Share it with a business owner who needs a website" },
                    { step: "03", text: "They sign up → you get $100 cash within 7 days of launch" },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex gap-3 items-start">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center">{step}</span>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
                {partnerSent ? (
                  <div className="text-center py-6">
                    <CheckCircle size={32} className="text-primary mx-auto mb-3" />
                    <p className="font-bold text-base mb-1">You're in the program!</p>
                    <p className="text-sm text-muted-foreground">Check your email — your referral link is on its way.</p>
                  </div>
                ) : (
                  <form onSubmit={handlePartnerSubmit} className="space-y-3 pt-2 border-t border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-1">Sign Up as a Partner</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="p-name" className="text-xs">Your Name *</Label>
                        <Input id="p-name" value={partnerForm.name} onChange={e => setPartnerForm(f => ({...f, name: e.target.value}))} placeholder="John Smith" required />
                      </div>
                      <div>
                        <Label htmlFor="p-biz" className="text-xs">Your Business / Occupation</Label>
                        <Input id="p-biz" value={partnerForm.business} onChange={e => setPartnerForm(f => ({...f, business: e.target.value}))} placeholder="Smith Roofing LLC" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="p-email" className="text-xs">Email *</Label>
                        <Input id="p-email" type="email" value={partnerForm.email} onChange={e => setPartnerForm(f => ({...f, email: e.target.value}))} placeholder="john@email.com" required />
                      </div>
                      <div>
                        <Label htmlFor="p-phone" className="text-xs">Phone</Label>
                        <Input id="p-phone" type="tel" value={partnerForm.phone} onChange={e => setPartnerForm(f => ({...f, phone: e.target.value}))} placeholder="(313) 555-1234" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="p-heard" className="text-xs">How did you hear about this?</Label>
                      <Input id="p-heard" value={partnerForm.how_they_heard} onChange={e => setPartnerForm(f => ({...f, how_they_heard: e.target.value}))} placeholder="Friend, social media, existing client..." />
                    </div>
                    <Button type="submit" className="w-full font-bold" disabled={partnerSending}>
                      {partnerSending ? "Signing up..." : "Join the Partner Program — Get My Referral Link →"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/30 py-8 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Detroit Web Agency · Grosse Pointe, MI</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/detroit-web-design" className="hover:text-foreground transition-colors">Main Site</Link>
              <Link to="/site-radar" className="hover:text-foreground transition-colors">SiteRadar</Link>
              <Link to="/contractor-leads" className="hover:text-foreground transition-colors">Contractor Leads</Link>
              <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="hover:text-foreground transition-colors flex items-center gap-1"><Phone size={11} /> {PHONE}</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default WebDesignServices;
