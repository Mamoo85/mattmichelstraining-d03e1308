import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, Phone, Mail, ArrowRight, CheckCircle2,
  Search, BarChart3, Target, FileText, MessageSquare,
  RefreshCw, TrendingUp, MapPin, Star
} from "lucide-react";

const PHONE = "(313) 992-1219";
const EMAIL = "matt@mattmichelstraining.com";

/* ── Web Design packages (the core 80%) ── */
const WEB_PACKAGES = [
  {
    name: "Starter",
    price: "$499",
    desc: "Perfect for new businesses that need a professional online presence fast.",
    features: [
      "Custom 3-page responsive website",
      "Mobile-first design",
      "Basic SEO setup",
      "Contact form integration",
      "Google Analytics installed",
      "Delivered in 5 business days",
    ],
  },
  {
    name: "Professional",
    price: "$499",
    tag: "Most Popular",
    desc: "For growing businesses ready to convert more visitors into paying customers.",
    features: [
      "Custom 5-7 page website",
      "Conversion-optimized layout",
      "Advanced SEO + blog setup",
      "Google Business Profile optimization",
      "Speed optimization (90+ scores)",
      "2 rounds of revisions",
      "Delivered in 10 business days",
    ],
  },
  {
    name: "Business",
    price: "$3,499",
    desc: "Full digital launch — website, SEO, and ongoing content strategy.",
    features: [
      "Custom 10+ page website",
      "Full SEO keyword strategy",
      "Blog content calendar",
      "Social media integration",
      "Lead capture funnels",
      "Priority support + 3 revision rounds",
      "Delivered in 15 business days",
    ],
  },
];

/* ── Monthly retainer options ── */
const RETAINERS = [
  { name: "Maintenance", price: "$49/mo", desc: "Monthly updates, backups, and security monitoring." },
  { name: "Growth", price: "$99/mo", desc: "SEO content updates, analytics reports, and conversion tweaks." },
  { name: "Full Service", price: "$199/mo", desc: "Everything in Growth + social posting, GBP management, and priority support." },
];

/* ── Add-on services (the other 20%) — only real, deliverable products ── */
interface AddOn {
  icon: typeof Globe;
  title: string;
  price: string;
  desc: string;
  link: string;
  tag?: string;
}

const ADDONS: AddOn[] = [
  { icon: Search, title: "Website Audit", price: "$9", desc: "AI-powered audit with SEO, speed, mobile, and conversion analysis — delivered instantly.", link: "/ai-website-audit", tag: "Instant" },
  { icon: FileText, title: "Competitor Report", price: "$9", desc: "Side-by-side analysis of your site vs. a competitor — strengths, weaknesses, and quick wins.", link: "/ai-competitor-report", tag: "Instant" },
  { icon: MapPin, title: "GBP Post Pack", price: "$19", desc: "4 Google Business Profile posts written and ready to copy-paste. Boost local visibility.", link: "/ai-gbp-post-pack", tag: "Instant" },
  { icon: RefreshCw, title: "Website Refresh", price: "$199", desc: "Homepage copy rewrite, CTA updates, mobile fixes, and speed optimization.", link: "/web-design-services" },
  { icon: Target, title: "Local SEO Pages", price: "$299", desc: "10 keyword-targeted landing pages to dominate local search results.", link: "/local-seo-pages" },
  { icon: BarChart3, title: "GBP Management", price: "$49/mo", desc: "Weekly posts, review responses, and profile optimization. Rank higher on Google Maps.", link: "/local-marketing" },
  { icon: TrendingUp, title: "SEO Reports", price: "$149/mo", desc: "Monthly SEO tracking with keyword rankings, traffic analysis, and action items.", link: "/seo-reports" },
];

/* ── Industries served ── */
const INDUSTRIES = [
  "Contractors & Trades", "Dental & Medical", "Restaurants & Food",
  "Real Estate", "Fitness & Wellness", "Auto & Marine",
  "Legal & Financial", "Home Services", "Retail & E-commerce",
  "Salons & Spas", "Churches & Nonprofits", "Manufacturing",
];

const M2Development = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M2 Development | Custom Websites & Digital Marketing | Grosse Pointe"
      description="Custom websites built to convert — starting at $499. SEO, Google Business Profile management, and AI-powered marketing add-ons. M2 Development, Grosse Pointe, MI."
      path="/m2-development"
    />

    {/* Hero */}
    <section className="relative overflow-hidden pt-20 pb-16" style={{ background: "#0a0a0f" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0a0f 100%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(6,182,212,0.07) 0%, transparent 70%)" }} />
      <div className="container max-w-4xl mx-auto text-center relative z-10 px-4">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: "rgba(6,182,212,0.15)", transform: "scale(1.3)" }} />
          <img
            src="/images/DWA_Dark_Logo.png"
            alt="Detroit Web Agency"
            width={200}
            height={200}
            className="relative mx-auto w-36 sm:w-44 h-auto object-contain"
            style={{ filter: "drop-shadow(0 0 32px rgba(6,182,212,0.25))" }}
          />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: "#22d3ee" }}>
          Web Design · SEO · Local Marketing
        </p>
        <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3 uppercase" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>
          We Handle<br />
          <span style={{ color: "#22d3ee", textShadow: "0 0 40px rgba(6,182,212,0.4)" }}>The Tech.</span>
        </h1>
        <p className="text-lg font-semibold mb-4" style={{ color: "#94a3b8" }}>Detroit's Secure Web Agency.</p>
        <p className="text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "#64748b" }}>
          Custom-built, mobile-first websites with SEO baked in. 16+ industry templates.
          Most sites delivered in under a week. No ongoing contracts required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="font-bold uppercase tracking-wider text-sm" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 24px rgba(6,182,212,0.3)" }}>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
              <Phone size={16} className="mr-2" />
              Start Secured Consultation
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-bold uppercase tracking-wider text-sm" style={{ background: "transparent", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}>
            <Link to="/ai-website-audit">
              <Search size={16} className="mr-2" />
              Get a Free Audit First
            </Link>
          </Button>
        </div>
      </div>
    </section>

    {/* Stats */}
    <div style={{ borderTop: "1px solid rgba(34,211,238,0.08)", borderBottom: "1px solid rgba(34,211,238,0.08)", background: "rgba(6,182,212,0.02)" }}>
      <div className="container max-w-4xl mx-auto py-6 px-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        {[
          { val: "16+", label: "Industry Templates" },
          { val: "5 Days", label: "Average Delivery" },
          { val: "$499", label: "Starting Price" },
          { val: "100%", label: "Done For You" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xl sm:text-2xl font-black" style={{ color: "#22d3ee" }}>{s.val}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#475569" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-16">

      {/* ── Web Design Packages ── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-foreground">Website Packages</h2>
          <p className="text-sm text-muted-foreground mt-2">One-time build. No monthly fees required. You own everything.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {WEB_PACKAGES.map(pkg => (
            <Card key={pkg.name} className={`relative border-border/50 bg-card/50 backdrop-blur-sm ${pkg.tag ? "ring-2 ring-primary/50" : ""}`}>
              {pkg.tag && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-primary-foreground">
                    {pkg.tag}
                  </span>
                </div>
              )}
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-foreground">{pkg.name}</h3>
                  <div className="text-2xl font-black text-primary mt-1">{pkg.price}</div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{pkg.desc}</p>
                </div>
                <ul className="space-y-2">
                  {pkg.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider">
                  <a href={`tel:${PHONE.replace(/\D/g, "")}`}>Get Started</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Monthly Retainers ── */}
      <section>
        <div className="text-center mb-6">
          <h2 className="text-lg font-black text-foreground">Optional Monthly Retainers</h2>
          <p className="text-xs text-muted-foreground mt-1">Keep your site fresh, fast, and ranking — without lifting a finger.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {RETAINERS.map(r => (
            <Card key={r.name} className="border-border/50 bg-card/50">
              <CardContent className="p-4 text-center space-y-2">
                <h3 className="text-sm font-bold text-foreground">{r.name}</h3>
                <div className="text-lg font-black text-primary">{r.price}</div>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Industries ── */}
      <section>
        <h2 className="text-lg font-black text-foreground text-center mb-4">Industries We Serve</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {INDUSTRIES.map(ind => (
            <span key={ind} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-border bg-card/50 text-muted-foreground">
              {ind}
            </span>
          ))}
        </div>
      </section>

      {/* ── Add-On Services ── */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-black text-foreground">Add-On Services</h2>
          <p className="text-xs text-muted-foreground mt-1">Boost your site's performance with these standalone services.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADDONS.map(a => (
            <Link to={a.link} key={a.title} className="block group">
              <Card className="h-full border-border/50 bg-card/50 hover:border-primary/40 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <a.icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{a.title}</h3>
                      {a.tag && (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary">{a.tag}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-primary">{a.price}</span>
                      <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Social Proof / Process ── */}
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 sm:p-10 space-y-6">
        <h2 className="text-xl font-black text-white text-center">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: "1", title: "Free Consultation", desc: "15-minute call to understand your business, goals, and timeline." },
            { step: "2", title: "We Build It", desc: "Your site is designed, written, and optimized — you approve the final version." },
            { step: "3", title: "Launch & Grow", desc: "Site goes live. Optional retainer keeps it ranking and converting." },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-black text-lg flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <h3 className="text-sm font-bold text-white">{s.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star size={16} className="text-primary fill-primary" />
          <Star size={16} className="text-primary fill-primary" />
          <Star size={16} className="text-primary fill-primary" />
          <Star size={16} className="text-primary fill-primary" />
          <Star size={16} className="text-primary fill-primary" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-foreground">
          Ready to get a website that works?
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Call for a free consultation — no pressure, no contracts. Just a conversation about what your business needs.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
              <Phone size={16} className="mr-2" />
              {PHONE}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-bold">
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
          © {new Date().getFullYear()} M2 Development · Grosse Pointe Park, MI
        </p>
        <p className="text-[10px] text-muted-foreground">
          A division of{" "}
          <Link to="/" className="text-primary hover:opacity-80">M2 Training</Link>
        </p>
      </div>
    </div>
  </div>
);

export default M2Development;
