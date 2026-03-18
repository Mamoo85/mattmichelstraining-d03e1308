import AppNavbar from "@/components/AppNavbar";
import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import PortalShowcase from "@/components/landing/PortalShowcase";
import ParentChildManager from "@/components/ParentChildManager";
import { useContentMap } from "@/hooks/useSiteContent";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight, Shield, AlertTriangle, TrendingUp, Clock,
  ChevronRight, GraduationCap, Heart, Zap, BookOpen,
  Calendar, Mail, Phone, MapPin, Users
} from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";

/* ---------- data ---------- */

const INJURY_STATS = [
  { stat: "3.5 million", label: "youth sports injuries per year in the U.S. — most from overuse, not contact", source: "Stanford Children's Health" },
  { stat: "50%", label: "are preventable with proper strength training and recovery programming", source: "American Academy of Pediatrics" },
  { stat: "62%", label: "of organized-sport injuries happen during practice — not games", source: "Safe Kids Worldwide" },
  { stat: "#1 cause", label: "Overuse and bad programming. Not bad luck. Proper strength training prevents this.", source: "Johns Hopkins Medicine" },
];

const PRESS_QUOTE = {
  outlet: "Grosse Pointe News",
  quote: "His business, built entirely by word of mouth, is a testament to the impact he's had on his clients. Whether he's coaching middle schoolers, training college-bound athletes or helping everyday individuals move and feel better, Michels is, at his core, a teacher.",
  url: "https://www.grossepointenews.com/articles/strength-in-motion-how-one-trainer-turned-passion-into-purpose/",
};

const TIMELINE = [
  {
    age: "11–13",
    title: "Foundation Phase — Youth Strength Basics",
    desc: "Movement quality, body awareness, and coordination through age-appropriate strength training. No heavy loading — ever. This is about building the operating system their body will run on for the next decade.",
    action: "Youth Foundation Program — $20",
    link: "/shop",
  },
  {
    age: "14–15",
    title: "Work Capacity Phase — Building Durability",
    desc: "Introduce structured resistance training focused on joints, tendons, and connective tissue BEFORE adding load. This is the phase most youth programs skip — and where injuries start.",
    action: "Sport-specific program — from $20",
    link: "/shop",
  },
  {
    age: "16–17",
    title: "Strength & Power Phase — Sport Performance",
    desc: "Now they're ready. Progressive overload, sport-specific strength development, and competition prep. Their body can handle it because you didn't rush the first two phases.",
    action: "Custom strength program by Matt — $20",
    link: "/shop",
  },
  {
    age: "18+",
    title: "College Prep Phase — Peak Durability",
    desc: "Peak performance strength programming. Matt has sent 50+ athletes to the college level. This phase is about durability under volume.",
    action: "Full strength training with Matt →",
    link: "/pricing",
  },
];

const FUNNEL_STEPS = [
  {
    step: "1",
    title: "Start Your Free 14-Day Trial",
    desc: "Create a free parent account. You get full portal access for 14 days — programs, progress tracking, and direct access to Matt. No card required.",
    icon: Shield,
    cta: "Start Free Trial",
    link: "/auth?redirect=/trial-welcome",
  },
  {
    step: "2",
    title: "Invite Your Athlete",
    desc: "Send your kid an invite link. They create their own login, and their account is automatically linked to yours. You see everything they log.",
    icon: Users,
    cta: "Set Up Below",
    link: "#parent-portal",
  },
  {
    step: "3",
    title: "Pick a Plan That Fits",
    desc: "After the trial, choose a membership tier or grab a one-time $20 program. In-person sessions available in Grosse Pointe for local families.",
    icon: GraduationCap,
    cta: "View Plans",
    link: "/pricing",
  },
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


        {/* COLLEGE PREP TIMELINE */}
        <motion.div {...fade(0.15)} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Youth Strength Development Timeline
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
            There's a right time for everything. Rush the process and your athlete pays for it — usually with an overuse injury.
          </p>
          <div className="space-y-3">
            {TIMELINE.map((t) => (
              <div key={t.age} className="bg-card shadow-m2 p-5 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <span className="text-sm font-mono font-bold text-primary">{t.age}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm md:text-base font-bold text-foreground mb-1">{t.title}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-3">{t.desc}</p>
                    <Link
                      to={t.link}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80 transition-m2"
                    >
                      {t.action}
                      <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>



        {/* CLEAR PATH */}
        <motion.div {...fade(0.25)} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Your Path to Stronger, Safer Athletes
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FUNNEL_STEPS.map((f) => (
              <div key={f.step} className="bg-card shadow-m2 p-5 flex flex-col relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <span className="text-3xl font-mono font-bold text-primary/15">{f.step}</span>
                </div>
                <f.icon size={22} className="text-primary mb-3" />
                <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{f.desc}</p>
                {f.link.startsWith("#") ? (
                  <a
                    href={f.link}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80 transition-m2"
                  >
                    {f.cta}
                    <ArrowRight size={12} />
                  </a>
                ) : (
                  <Link
                    to={f.link}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80 transition-m2"
                  >
                    {f.cta}
                    <ArrowRight size={12} />
                  </Link>
                )}
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

        {/* TESTIMONIAL */}
        <motion.div {...fade(0.35)} className="mb-12">
          <div className="bg-card shadow-m2 p-5 md:p-6 border-l-4 border-primary">
            <p className="text-sm md:text-base italic text-muted-foreground leading-relaxed mb-3">
              "{cms.testimonial_text || "My son trained with Matt for three years. He walked on at Michigan as a freshman and started by his junior year. Matt didn't just make him stronger — he made him durable. Three years of college ball, zero time missed to injury."}"
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">KR</span>
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">{cms.testimonial_name || "Parent of D1 Athlete"}</span>
                <span className="text-[10px] text-muted-foreground">{cms.testimonial_location || "Grosse Pointe, MI"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* PRESS */}
        <motion.div {...fade(0.38)} className="mb-12">
          <a
            href={PRESS_QUOTE.url}
            target="_blank"
            rel="noreferrer"
            className="block bg-card shadow-m2 p-5 md:p-6 border-l-4 border-primary hover:bg-secondary/50 transition-m2"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
              {PRESS_QUOTE.outlet}
            </span>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              "{PRESS_QUOTE.quote}"
            </p>
            <span className="text-[10px] text-primary font-bold mt-2 block">Read full article →</span>
          </a>
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
