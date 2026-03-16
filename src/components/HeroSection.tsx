import { motion } from "framer-motion";
import { ArrowRight, Video, TrendingUp, Users, Clipboard, MapPin, HelpCircle, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";
import AboutPhilosophy from "./AboutPhilosophy";
import RealityCheck from "./RealityCheck";

const STATS = [
  { value: "20+", label: "Years Same Age Group" },
  { value: "50+", label: "College Athletes Made" },
  { value: "Zero", label: "Injuries" },
  { value: "100%", label: "Results" },
];

const SERVICES = [
  { route: "/shop", icon: Clipboard, label: "CUSTOM · $20", title: "Your Athlete's Program", sub: "Matt reads the intake, builds the program from scratch. No templates.", cta: "Get Started" },
  { route: "/coach", icon: TrendingUp, label: "MONTHLY · $100+", title: "Online Coaching", sub: "Programming + weekly check-ins. Matt adjusts in real time.", cta: "Learn More" },
  { route: "/coach", icon: Video, label: "REMOTE · $20", title: "Form Check", sub: "Send a video. Get cues back. Matt sees what others miss.", cta: "Submit Video" },
  { route: "/coach", icon: Users, label: "TRAINERS ONLY", title: "Trainer Mentorship", sub: "Programming, coaching, business. 20+ years of doing it the right way.", cta: "Inquire" },
];

const HeroSection = () => (
  <div className="min-h-screen bg-background relative overflow-hidden">
    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage: `linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }}
    />

    <div className="container relative z-10 pt-20 pb-12">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        className="py-12 md:py-20"
      >
        <div className="flex items-center gap-4 mb-6">
          <img src={m2Logo} alt="M² Training" className="w-16 h-16 md:w-20 md:h-20 object-cover shadow-m2" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-0.5 h-4 bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
                Youth Athlete Strength · Grosse Pointe Park, MI
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[0.95]">
              YOUR ATHLETE'S<br />
              <span className="text-primary">SECRET WEAPON.</span>
            </h1>
          </div>
        </div>

        <p className="text-sm md:text-base text-muted-foreground max-w-lg mb-6 text-balance">
          This isn't TikTok fitness. This isn't a franchise gym with a clipboard.
          This is old-school Russian strength meets American power meets Eastern energy —
          refined over 20+ years training the same age group. Most trainers move up. I stayed.
          That's why my athletes go to college ready. Zero injuries. Every single time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Client Portal
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-m2 hover:bg-m2-surface-hover transition-m2"
          >
            <ShoppingBag size={14} />
            Get a Custom Program · $20
          </Link>
        </div>
      </motion.div>

      {/* STATS */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1] }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="bg-card shadow-m2 p-3 text-center">
            <span className="text-xl md:text-2xl font-bold text-primary font-mono block">{s.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* PHILOSOPHY */}
      <div className="mb-12">
        <AboutPhilosophy />
      </div>

      {/* REALITY CHECK */}
      <div className="mb-12">
        <RealityCheck />
      </div>

      {/* WORK ONLINE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <SectionHeader title="Work with Matt" timestamp="Online or in person" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SERVICES.map((item) => (
            <Link
              key={item.title}
              to={item.route}
              className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group block"
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.label}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-m2">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* STUDIO RENTAL */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div className="bg-card shadow-m2 p-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">For Trainers</span>
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">Lease Studio Time</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Certified trainers — rent the M² gym by the hour or block. Private, fully equipped, no overhead.
          </p>
          <span className="text-xs text-primary font-bold">Inquire about availability →</span>
        </div>
      </motion.div>

      {/* HELP */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div className="bg-primary/10 border border-primary/20 shadow-m2 p-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-primary">I Can Fix It</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Your kid's not getting stronger? Something feels off in their training? I'll tell you what's wrong and how to fix it.</p>
          <span className="text-xs text-primary font-bold">Pay what you feel →</span>
        </div>
      </motion.div>

      {/* FIND US */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5, ease: [0.2, 0, 0, 1] }}
      >
        <SectionHeader title="Find Us" />
        <div className="bg-card shadow-m2 p-5">
          <p className="text-sm font-bold text-foreground">M² Training</p>
          <p className="text-xs text-muted-foreground mt-1">15121 Kercheval Ave<br />Grosse Pointe Park, MI 48230</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href="https://maps.google.com/?q=15121+Kercheval+Ave,+Grosse+Pointe+Park,+MI+48230" target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Get Directions</a>
            <a href="https://www.facebook.com/matt-michels-training" target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Follow on Facebook</a>
            <a href="mailto:matthewmichels4@gmail.com" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Email Matt</a>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <div className="mt-12 pt-6 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI · Real training, real results.
        </p>
      </div>
    </div>
  </div>
);

export default HeroSection;
