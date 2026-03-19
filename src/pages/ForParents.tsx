import AppNavbar from "@/components/AppNavbar";

import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import PortalShowcase from "@/components/landing/PortalShowcase";
import ParentChildManager from "@/components/ParentChildManager";
import { useContentMap } from "@/hooks/useSiteContent";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight, Shield, TrendingUp,
  ChevronRight, GraduationCap, Heart, Zap,
  Calendar, MapPin, Users
} from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";
import TechShowcaseCard from "@/components/landing/TechShowcaseCard";

/* ---------- data ---------- */

const MEMBERSHIP_TIERS = [
  {
    name: "Basic",
    price: "$14.99/mo",
    highlights: [
      "Full exercise library access (200+ exercises)",
      "10 pre-loaded training workouts",
      "Monthly Focus Plan with tracking",
      "Progress logging & coach feedback",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: false,
  },
  {
    name: "Foundation",
    price: "$39.99/mo",
    highlights: [
      "Everything in Basic",
      "8-week periodized training blocks",
      "Fix It rehab & recovery library",
      "Monthly 'Real Deal' newsletter",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: true,
  },
  {
    name: "Custom",
    price: "$99.99/mo",
    highlights: [
      "Everything in Foundation",
      "1-on-1 video movement assessment",
      "Advanced biomechanics tracking",
      "Priority coach messaging",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: false,
  },
];

const PARENT_CHILD_BENEFITS = [
  { icon: Shield, title: "Full Visibility", desc: "See every workout your athlete logs — sets, reps, weights, and coach feedback." },
  { icon: TrendingUp, title: "Progress Tracking", desc: "Monitor strength gains, recovery trends, and training consistency over time." },
  { icon: Heart, title: "Independent Tiers", desc: "Choose different subscription levels for yourself and each linked athlete." },
  { icon: Zap, title: "Direct Coach Access", desc: "Flag exercises for Matt's review and message him directly from the portal." },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

/* ---------- page ---------- */

const ForParents = () => {
  const { content: cms } = useContentMap("for_parents");
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="For Parents — Youth Strength Training Safety"
        description="3.5M youth sports injuries per year — 50% are preventable. Learn how M² Training keeps your athlete safe with science-backed strength programs from $12.99/mo."
        path="/for-parents"
      />
      <AppNavbar />

      <div className="container pt-20 pb-16">

        {/* IN-PERSON / CONTACT BANNER */}
        <motion.div {...fade(0)} className="mb-6">
          <div className="bg-primary text-primary-foreground p-4 md:p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">In-Person Youth Training Available</p>
                  <p className="text-xs opacity-80">Grosse Pointe Park, MI — 1-on-1, small group & team sessions</p>
                </div>
              </div>
              <Link
                to="/schedule"
                className="inline-flex items-center gap-1.5 bg-background text-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                <Calendar size={12} />
                Book a Session
              </Link>
            </div>
          </div>
        </motion.div>

        {/* HERO */}
        <motion.div {...fade(0.05)} className="py-8 md:py-14">
          <div className="flex items-start gap-4 mb-6">
            <img src={m2Logo} alt="M² Training — Youth Strength Training" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-md flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-0.5 h-4 bg-primary" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary font-mono">
                  Youth Strength Training for Parents
                </span>
              </div>
              <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[1.1]">
                <motion.span {...fade(0.15)} className="block">{cms.hero_line_1 || "Your athlete's body"}</motion.span>
                <motion.span {...fade(0.25)} className="block">{cms.hero_line_2 || "is not a science experiment."}</motion.span>
              </h1>
            </div>
          </div>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mb-6 leading-relaxed">
            {cms.hero_subtitle || "Most youth training programs are built by people who learned from social media — not from 20 years of watching what actually breaks down in a young athlete's body. Matt has trained thousands of kids. 50+ went on to compete at the college level. Zero got injured. That's not a slogan — it's a track record."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth?redirect=/trial-welcome"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
            >
              Start Your 14-Day Free Trial
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
            >
              {cms.hero_cta_secondary || "Browse $20 Programs"}
            </Link>
          </div>
        </motion.div>


        {/* MEMBERSHIP TIERS */}
        <motion.div {...fade(0.15)} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={18} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Membership Plans for Your Athlete
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
            Every plan includes a 14-day free trial. Pick the level that fits your athlete — upgrade or cancel anytime.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MEMBERSHIP_TIERS.map((t) => (
              <div key={t.name} className={`bg-card shadow-m2 p-5 flex flex-col relative overflow-hidden ${t.accent ? "ring-2 ring-primary" : ""}`}>
                {t.accent && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest text-center py-1">
                    Most Popular
                  </div>
                )}
                <div className={t.accent ? "mt-4" : ""}>
                  <h3 className="text-base font-bold text-foreground mb-0.5">{t.name}</h3>
                  <p className="text-lg font-mono font-bold text-primary mb-3">{t.price}</p>
                  <ul className="space-y-2 mb-4 flex-1">
                    {t.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                        <ChevronRight size={10} className="text-primary mt-0.5 flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={t.link}
                    className={`inline-flex items-center justify-center gap-2 w-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                      t.accent
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-primary/40 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {t.cta}
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            <Link to="/pricing" className="text-primary hover:opacity-80 transition-m2">View full plan comparison →</Link>
          </p>
        </motion.div>

        {/* PARENT-CHILD BENEFITS */}
        <motion.div {...fade(0.25)} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Why Link Your Parent Account
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PARENT_CHILD_BENEFITS.map((b) => (
              <div key={b.title} className="bg-card shadow-m2 p-5">
                <b.icon size={20} className="text-primary mb-2" />
                <h3 className="text-sm font-bold text-foreground mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* PARENT-CHILD ACCOUNT SECTION */}
        {user && (
          <motion.div {...fade(0.3)} className="mb-12" id="parent-portal">
            <div className="bg-card shadow-m2 p-5 md:p-6">
              <ParentChildManager />
            </div>
          </motion.div>
        )}

        {!user && (
          <motion.div {...fade(0.3)} className="mb-12" id="parent-portal">
            <div className="bg-card shadow-m2 p-6 text-center">
              <Users size={32} className="mx-auto text-primary mb-3" />
              <h3 className="text-sm font-bold text-foreground mb-2">Parent Portal — Link Your Child's Account</h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                Sign in or create a free account to set up a linked child account.
                Monitor their progress, flag questions for Matt, and track their development — all from your dashboard.
              </p>
              <Link
                to="/auth?redirect=/for-parents"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                Sign In / Create Account
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        )}

        {/* TECH SHOWCASE */}
        <motion.div {...fade(0.33)} className="mb-12">
          <TechShowcaseCard />
        </motion.div>



        {/* FOOTER */}
        <div className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Youth Strength Training · Grosse Pointe Park, MI ·{" "}
            <Link to="/" className="text-primary hover:opacity-80 transition-m2">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForParents;
