import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield, Target, Smartphone, Calendar, MessageSquare, Phone, Mail,
  TrendingUp, Trophy, Zap, ChevronRight,
} from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "M² Training",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Grosse Pointe Park",
    addressLocality: "Grosse Pointe Park",
    addressRegion: "MI",
    postalCode: "48230",
  },
  telephone: "313-806-4952",
  priceRange: "$19.99 - $149/mo",
  url: "https://mattmichelstraining.com",
  serviceType: "Youth Athletic Training",
};

const CONCERNS = [
  {
    icon: Shield,
    q: "I don't want my kid getting injured lifting weights.",
    a: "Injury prevention is the first priority of every program Matt builds. Youth athletes train with age-appropriate loads, full movement assessment, and progressive overload that develops — not damages — growing bodies.",
  },
  {
    icon: Target,
    q: "My kid plays [sport] — will this actually help performance?",
    a: "Every program is built around the athlete's sport, position, and season phase. Off-season, in-season, and pre-combine prep are all different programs. Generic fitness doesn't get recruiting attention.",
  },
  {
    icon: Smartphone,
    q: "How do I know they're training correctly when I'm not there?",
    a: "The M² app lets you monitor every logged workout, see Coach Matt's form check feedback, and track progress week by week. You're always in the loop.",
  },
];

const SPORTS = [
  "Football", "Basketball", "Baseball/Softball", "Wrestling", "Soccer",
  "Hockey", "Track & Field", "Volleyball", "Lacrosse", "General Athletic Dev",
];

const PHASES = [
  { week: "Week 1–2", title: "Movement Assessment", desc: "Full evaluation of mobility, strength imbalances, and injury history. Matt identifies what needs to be fixed before loading." },
  { week: "Week 3–6", title: "Foundation Block", desc: "Building the base. Proper squat, hip hinge, push, pull patterns. No fluff — the movements that translate to every sport." },
  { week: "Week 7+", title: "Sport-Specific Loading", desc: "Progressive overload designed around the athlete's sport demands, position, and competitive season. Programs adjust every 4 weeks." },
];

const RESULTS = [
  { icon: TrendingUp, sport: "Football", stat: "Squat 225 → 315", period: "16 weeks" },
  { icon: Trophy, sport: "Wrestling", stat: "Deadlift 185 → 265", period: "12 weeks" },
  { icon: Zap, sport: "Baseball", stat: "+4 mph pitching velo", period: "8 weeks" },
];

const ForParents = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Youth Athlete Training — Grosse Pointe Park, MI | M² Training"
      description="Sport-specific strength and performance training for high school athletes in Grosse Pointe and Metro Detroit. Coached by Matt Michels — 20 years, 50+ college athletes, zero training injuries."
      path="/for-parents"
      schema={LOCAL_BUSINESS_SCHEMA}
    />
    <AppNavbar />

    <div className="container pt-20 pb-16 max-w-4xl">
      {/* 1 — HERO */}
      <motion.section {...fade(0)} className="mb-14">
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-3 leading-[1.1]">
          Your Athlete Deserves More Than a Generic Workout Plan.
        </h1>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mb-6">
          Sport-specific strength training for high school athletes in Grosse Pointe and Metro Detroit.
          Real programming that builds durable, powerful athletes.
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <Button asChild>
            <Link to="/schedule" className="gap-2">
              <Calendar size={14} /> Schedule a Consult
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="sms:3138064952" className="gap-2">
              <MessageSquare size={14} /> Text Matt
            </a>
          </Button>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          20 years · 50+ college athletes · Zero training injuries
        </p>
      </motion.section>

      {/* 2 — PARENT CONCERNS */}
      <motion.section {...fade(0.05)} className="mb-14">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          Straight answers for parents
        </span>
        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-5">
          You're Not Looking for a Gym. You're Looking for an Expert.
        </h2>
        <div className="space-y-4">
          {CONCERNS.map((c) => (
            <div key={c.q} className="bg-card border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <c.icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">"{c.q}"</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 3 — SPORTS SERVED */}
      <motion.section {...fade(0.1)} className="mb-14">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Sports We Train For</span>
        <div className="flex flex-wrap gap-2 mt-3">
          {SPORTS.map((s) => (
            <span key={s} className="text-[10px] font-bold uppercase tracking-widest border border-border bg-card px-3 py-1.5 text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      </motion.section>

      {/* 4 — PROGRAM PHASES */}
      <motion.section {...fade(0.15)} className="mb-14">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">What a Program Includes</span>
        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-5">
          Built in Phases. Not Guesswork.
        </h2>
        <div className="relative pl-6 border-l-2 border-primary/30 space-y-6">
          {PHASES.map((p, i) => (
            <div key={p.title} className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{p.week}</span>
              <h3 className="text-sm font-black uppercase text-foreground mt-0.5 mb-1">{p.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 5 — RESULTS */}
      <motion.section {...fade(0.2)} className="mb-14">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Youth Athlete Results</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {RESULTS.map((r) => (
            <div key={r.sport} className="bg-card border border-border p-4 text-center">
              <r.icon size={20} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-black text-primary font-mono">{r.stat}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{r.sport} · {r.period}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 6 — PRICING (simple) */}
      <motion.section {...fade(0.25)} className="mb-14">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Pricing</span>
        <div className="space-y-2 mt-3">
          <Link to="/schedule" className="flex items-center justify-between bg-card border border-border p-3 hover:border-primary/40 transition-all group">
            <div>
              <span className="text-sm font-bold text-foreground">In-Person</span>
              <span className="text-xs text-muted-foreground ml-2">Ask Matt for current rates</span>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link to="/pricing" className="flex items-center justify-between bg-card border border-border p-3 hover:border-primary/40 transition-all group">
            <div>
              <span className="text-sm font-bold text-foreground">Online Pro</span>
              <span className="text-xs text-muted-foreground ml-2">$149/mo — Custom program + weekly form checks</span>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link to="/pricing" className="flex items-center justify-between bg-card border border-border p-3 hover:border-primary/40 transition-all group">
            <div>
              <span className="text-sm font-bold text-foreground">Foundation App</span>
              <span className="text-xs text-muted-foreground ml-2">$19.99/mo — Full app, AI generator, library</span>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </motion.section>

      {/* 7 — BOTTOM CTA */}
      <motion.section {...fade(0.3)} className="mb-8 bg-card border border-primary/20 p-6 text-center">
        <h2 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
          Ready to Get Your Athlete Started?
        </h2>
        <p className="text-xs text-muted-foreground mb-5 max-w-lg mx-auto">
          Schedule a free 15-minute call to discuss your athlete's goals, sport, and current training history.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="tel:3138064952" className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:border-primary/40 transition-all">
            <Phone size={12} /> Call
          </a>
          <a href="sms:3138064952" className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:border-primary/40 transition-all">
            <MessageSquare size={12} /> Text
          </a>
          <a href="mailto:matthew.michels4@gmail.com?subject=Youth%20Athlete%20Inquiry" className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:border-primary/40 transition-all">
            <Mail size={12} /> Email
          </a>
          <Button asChild size="sm">
            <Link to="/schedule" className="gap-1.5">
              <Calendar size={12} /> Schedule
            </Link>
          </Button>
        </div>
      </motion.section>

      <div className="pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Youth Strength Training · Grosse Pointe Park, MI ·{" "}
          <Link to="/" className="text-primary hover:opacity-80 transition-all">Back to home</Link>
        </p>
      </div>
    </div>
  </div>
);

export default ForParents;
