import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, Zap, BarChart3, MessageSquare, Phone, Mail, Bot,
  FileText, Search, TrendingUp, Users, Shield, ArrowRight,
  Megaphone, Send, Star, Clock, Target, Layers, BookOpen,
  DollarSign, Swords, Brain
} from "lucide-react";

const PHONE = "(313) 806-4952";
const EMAIL = "matt@mattmichelstraining.com";

interface Service {
  icon: typeof Globe;
  title: string;
  desc: string;
  price: string;
  link: string;
  tag?: string;
}

const WEB_DESIGN: Service[] = [
  { icon: Globe, title: "Custom Website Build", desc: "Mobile-first, SEO-optimized sites built to convert visitors into customers. 16+ industry templates ready.", price: "From $499", link: "/web-design-services", tag: "Core" },
  { icon: Search, title: "SEO Audit & Reports", desc: "Full site audit with actionable fixes — technical SEO, speed, mobile, and local ranking analysis.", price: "$149/mo", link: "/seo-reports" },
  { icon: BarChart3, title: "Google Business Profile", desc: "AI posts 3x/week to your Google Business Profile. Rankings climb on autopilot.", price: "$49/mo", link: "/local-marketing" },
  { icon: Target, title: "Local SEO Pages", desc: "AI-generated city + service landing pages to dominate local search results.", price: "$99/mo", link: "/local-seo-pages" },
];

const AI_AUTOMATION: Service[] = [
  { icon: Bot, title: "AI Phone Answering", desc: "Never miss a call. AI answers, qualifies leads, and texts you a summary instantly.", price: "$149/mo", link: "/ai-phone-answering", tag: "Popular" },
  { icon: MessageSquare, title: "Missed Call → Text", desc: "Automatically text back every missed call within 60 seconds with a custom message.", price: "$49/mo", link: "/missed-call-text" },
  { icon: Clock, title: "Speed to Lead", desc: "Instant AI response to new form submissions — before your competitors even check email.", price: "$79/mo", link: "/speed-to-lead" },
  { icon: Send, title: "Appointment Reminders", desc: "Automated SMS reminders that cut no-shows by 40%. Set it and forget it.", price: "$39/mo", link: "/appointment-reminders" },
  { icon: Star, title: "Review Request SMS", desc: "Auto-text customers after service asking for a Google review. Build 5-star reputation fast.", price: "$49/mo", link: "/review-request-sms" },
  { icon: Shield, title: "AI Reputation Dashboard", desc: "Monitor and respond to reviews across Google, Yelp, and Facebook from one place.", price: "$99/mo", link: "/ai-reputation" },
];

const CONTENT_MARKETING: Service[] = [
  { icon: Megaphone, title: "Social Media AI", desc: "AI creates and posts to Facebook, Instagram, LinkedIn 3x/week. Content on autopilot.", price: "$199/mo", link: "/social-media-ai", tag: "Popular" },
  { icon: FileText, title: "AI Blog Posts", desc: "Monthly SEO blog articles written and published automatically. Fresh content = better rankings.", price: "$79/mo", link: "/ai-blog-posts" },
  { icon: Mail, title: "AI Newsletter Service", desc: "Weekly or monthly newsletters written, designed, and sent to your list. You just approve.", price: "$99/mo", link: "/ai-newsletter-service" },
  { icon: Layers, title: "AI Ads Copy", desc: "Google & Facebook ad copy generated, tested, and optimized by AI.", price: "$59/mo", link: "/ai-ads-copy" },
];

const LEAD_GEN: Service[] = [
  { icon: TrendingUp, title: "Contractor Lead Gen", desc: "Exclusive leads for local contractors — roofing, HVAC, plumbing, electrical. No shared leads.", price: "$399/mo", link: "/contractor-leads", tag: "Premium" },
  { icon: Users, title: "B2B Dental Database", desc: "Michigan dental office contacts updated daily. Direct access to decision-makers.", price: "$49/mo", link: "/b2b-leads" },
  { icon: Zap, title: "Field Rep AI Tools", desc: "4 Claude-powered tools for B2B field reps — objection handler, email writer, call prep, CRM notes.", price: "$29/mo", link: "/field-rep-tools" },
];

const BUSINESS_INTEL: Service[] = [
  { icon: BookOpen, title: "AI Employee Handbook", desc: "Monthly AI-updated employee handbooks with state labor law compliance. Replaces $2-5K lawyer fees.", price: "$99/mo", link: "/ai-handbook", tag: "New" },
  { icon: DollarSign, title: "AI Grant Finder", desc: "Weekly AI-curated grant opportunities matched to your business — SBA, MEDC, and federal programs.", price: "$149/mo", link: "/ai-grant-finder", tag: "New" },
  { icon: Star, title: "AI Review Response", desc: "Daily AI-drafted review responses in your brand voice. Copy, paste, done.", price: "$49/mo", link: "/ai-review-response", tag: "New" },
  { icon: Swords, title: "AI Competitive Battlecard", desc: "Monthly competitive intelligence — competitor weaknesses, your advantages, objection handlers.", price: "$39/mo", link: "/ai-battlecard", tag: "New" },
  { icon: Brain, title: "AI Market Intelligence", desc: "Weekly 2-min executive brief — industry news, competitor moves, actionable insights.", price: "$49/mo", link: "/ai-market-intel", tag: "New" },
];

const COMPLIANCE_OPS: Service[] = [
  { icon: Shield, title: "AI Permit & License Monitor", desc: "Never miss a renewal. AI tracks permits, scrapes municipal sites, sends 60/30/7-day reminders.", price: "$79/mo", link: "/ai-permit-monitor", tag: "New" },
  { icon: Shield, title: "AI OSHA/Safety Compliance", desc: "Monthly safety checklists, OSHA updates, and violation prevention — avoid $15K+ fines.", price: "$99/mo", link: "/ai-osha-compliance", tag: "New" },
  { icon: DollarSign, title: "AI Late Payment Collector", desc: "Escalating collection letters — friendly to firm to final notice. FDCPA compliant.", price: "$49/mo", link: "/ai-collections", tag: "New" },
  { icon: Layers, title: "AI Inventory Reorder Alerts", desc: "Low stock alerts, stockout predictions, and supplier suggestions. Save 20-30% on emergency orders.", price: "$49/mo", link: "/ai-inventory-alerts", tag: "New" },
  { icon: Users, title: "AI Birthday/Anniversary Campaign", desc: "Automated personalized birthday and anniversary offers via email + SMS.", price: "$29/mo", link: "/ai-birthday-campaign", tag: "New" },
];

const SECTIONS = [
  { title: "Web Design & SEO", subtitle: "Your digital storefront, built to convert", items: WEB_DESIGN },
  { title: "AI Automation", subtitle: "Never miss a lead again", items: AI_AUTOMATION },
  { title: "Content & Marketing", subtitle: "Consistent content without lifting a finger", items: CONTENT_MARKETING },
  { title: "Lead Generation", subtitle: "Fill your pipeline on autopilot", items: LEAD_GEN },
  { title: "Business Intelligence", subtitle: "AI-powered insights that drive decisions", items: BUSINESS_INTEL },
  { title: "Compliance & Operations", subtitle: "Stay compliant and efficient on autopilot", items: COMPLIANCE_OPS },
];

const ServiceCard = ({ s }: { s: Service }) => (
  <Link to={s.link} className="block group">
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <s.icon size={20} className="text-primary" />
          </div>
          {s.tag && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {s.tag}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{s.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-primary">{s.price}</span>
          <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

const M2Development = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M² Development | AI-Powered Business Solutions | Grosse Pointe, MI"
      description="Custom websites, AI automation, lead generation, and digital marketing — all done for you. M² Development builds and runs your entire digital presence so you can focus on your business."
      path="/m2-development"
    />

    {/* Hero */}
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-background pt-20 pb-16">
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />
      
      <div className="container max-w-4xl mx-auto text-center relative z-10 px-4">
        <img
          src="/images/m2-development-logo.png"
          alt="M² Development"
          className="mx-auto w-64 sm:w-80 mb-6 drop-shadow-2xl"
        />
        <p className="text-cyan-400 text-xs font-bold uppercase tracking-[0.3em] mb-3">
          Applications · Automations · Form Analysis
        </p>
        <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-4">
          Your Business Runs Itself.<br />
          <span className="text-primary">We Build The Machine.</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
          Custom websites, AI phone answering, automated marketing, lead generation — 
          all done for you. One team. One bill. Zero headaches.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-sm">
            <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
              <Phone size={16} className="mr-2" />
              Call {PHONE}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-bold uppercase tracking-wider text-sm">
            <Link to="/web-design-services">
              View Services
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>

    {/* Stats bar */}
    <div className="border-y border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container max-w-4xl mx-auto py-6 px-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        {[
          { val: "50+", label: "Services Available" },
          { val: "16+", label: "Industry Templates" },
          { val: "24/7", label: "AI Automation" },
          { val: "$29", label: "Starting At /mo" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xl sm:text-2xl font-black text-primary">{s.val}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Service sections */}
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-14">
      {SECTIONS.map(section => (
        <section key={section.title}>
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-black text-foreground">{section.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{section.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.items.map(s => <ServiceCard key={s.title} s={s} />)}
          </div>
        </section>
      ))}

      {/* More services link */}
      <div className="text-center pt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Plus 30+ more services: SMS marketing, payment chasing, warranty reminders, competitor monitoring, AI proposals, and more.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { label: "Text Marketing", to: "/text-message-marketing" },
            { label: "Payment Chaser", to: "/payment-chaser" },
            { label: "Quote Follow-up", to: "/quote-followup-sms" },
            { label: "Win-Back SMS", to: "/winback-sms" },
            { label: "AI Proposals", to: "/ai-proposal" },
            { label: "Competitor Watch", to: "/competitor-watch" },
            { label: "Hiring Assistant", to: "/hiring-assistant" },
            { label: "Warranty Reminders", to: "/warranty-reminders" },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 sm:p-10 text-center space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-white">
          Ready to automate your business?
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Book a free 15-minute call. We'll audit your current setup and show you exactly what can be automated.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
              <Phone size={16} className="mr-2" />
              {PHONE}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 font-bold">
            <a href={`mailto:${EMAIL}`}>
              <Mail size={16} className="mr-2" />
              {EMAIL}
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <div className="pt-6 border-t border-border text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} M² Development · Grosse Pointe Park, MI
        </p>
        <p className="text-[10px] text-muted-foreground">
          A division of{" "}
          <Link to="/" className="text-primary hover:opacity-80">M² Training</Link>
        </p>
      </div>
    </div>
  </div>
);

export default M2Development;
