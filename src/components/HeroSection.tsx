import { motion } from "framer-motion";
import { ArrowRight, Video, TrendingUp, Users, Clipboard, MapPin, HelpCircle, ShoppingBag, Shield, Brain, Zap, Trophy, Clock, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";
import AboutPhilosophy from "./AboutPhilosophy";
import RealityCheck from "./RealityCheck";
import ForCoaches from "./ForCoaches";

const STATS = [
  { value: "20+", label: "Years · Same Age Group" },
  { value: "50+", label: "College Athletes Produced" },
  { value: "Zero", label: "Career Injuries" },
  { value: "100%", label: "Results Rate" },
];

const DIFFERENTIATORS = [
  { icon: Brain, title: "CNS-Based Training", desc: "I understand the central nervous system at an intuitive level. After 20+ years, it's not a science — it's an art I live and breathe." },
  { icon: Shield, title: "Zero Injuries. Ever.", desc: "Not one. Healthy joints and healthy minds come first. They all get strong — I promise. No need to rush." },
  { icon: Clock, title: "72-Hour Recovery", desc: "The body needs real recovery. I build programs around science, not ego. Rushing makes you slower." },
  { icon: Zap, title: "Old-School Methods", desc: "Russian mountain strength meets American power meets Eastern energy. No gimmicks. No trends. Just what works." },
  { icon: Trophy, title: "College-Ready Athletes", desc: "My athletes don't just make the team — they exceed every expectation. Far beyond what even I predicted when I started." },
  { icon: Heart, title: "I Stayed. That's Rare.", desc: "Most trainers move up to older clients as they age. I never left this age group. That's why I'm one of the very few left who does this." },
];

const SERVICES = [
  { route: "/shop", icon: Clipboard, label: "CUSTOM · $20", title: "Your Athlete's Custom Program", sub: "Matt reads the intake, builds the program from scratch around your athlete's body, sport, and goals. No templates ever." },
  { route: "/coach", icon: TrendingUp, label: "MONTHLY · $100+", title: "Online Coaching", sub: "Full programming + weekly check-ins. Matt adjusts load, volume, and recovery in real time based on how your athlete responds." },
  { route: "/coach", icon: Video, label: "REMOTE · $20", title: "Video Form Check", sub: "Send a video of any lift. Matt sees what other trainers miss and sends back precise cues that fix it immediately." },
  { route: "/coach", icon: Users, label: "TRAINERS ONLY", title: "Trainer Mentorship", sub: "20+ years of programming, coaching, and business knowledge. If you train young athletes, Matt can show you how to do it right." },
];

const HeroSection = () => (
  <div className="min-h-screen bg-background relative overflow-hidden">
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

        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-4 text-balance leading-relaxed">
          If your child is going to play college sports, this is the training that prepares their body for it.
          <span className="text-foreground font-semibold"> Anything else is wearing them out.</span>
        </p>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6 text-balance leading-relaxed">
          This isn't TikTok fitness. This isn't a franchise gym with a clipboard.
          This is 20+ years of old-school Russian strength, American power, and Eastern energy —
          all refined by training the <span className="text-foreground font-semibold">same age group, every single day</span>.
          Most trainers move up. I stayed. That's why my athletes go to college ready.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Start Training with Matt
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

      {/* WHAT MAKES MATT DIFFERENT */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <SectionHeader title="Why M² Training" timestamp="What makes this different from every other trainer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title} className="bg-card shadow-m2 p-4">
              <div className="flex items-center gap-2 mb-2">
                <d.icon size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-foreground">{d.title}</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* PHILOSOPHY — Letter to Parents */}
      <div className="mb-12">
        <AboutPhilosophy />
      </div>

      {/* REALITY CHECK */}
      <div className="mb-12">
        <RealityCheck />
      </div>

      {/* FOR COACHES */}
      <div className="mb-12">
        <ForCoaches />
      </div>

      {/* SERVICES */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <SectionHeader title="Work with Matt" timestamp="Online or in person — wherever you are" />
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
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.sub}</p>
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

      {/* I CAN FIX IT */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div className="bg-primary/10 border border-primary/20 shadow-m2 p-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-primary">Something's Off? I Can Fix It.</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            Your kid's not getting stronger? They're always sore? Their coach has them doing things that don't look right?
            Tell me what's going on. I'll tell you exactly what's wrong and exactly how to fix it.
            20 years of fixing the same problems — I've seen it all.
          </p>
          <span className="text-xs text-primary font-bold">Pay what you feel →</span>
        </div>
      </motion.div>

      {/* THE PROMISE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.48, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div className="bg-card shadow-m2 p-6 text-center">
          <h3 className="text-lg font-bold text-foreground mb-3 tracking-display">MATT'S PROMISE</h3>
          <p className="text-sm text-foreground max-w-md mx-auto text-balance leading-relaxed mb-4">
            "They will get strong. I promise. No need to rush. Let me handle the strength protocol.
            You handle the bedtime. <span className="text-primary font-bold">Problem solved.</span>"
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Get Your Athlete Started
            <ArrowRight size={14} />
          </Link>
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
