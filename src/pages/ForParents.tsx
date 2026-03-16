import AppNavbar from "@/components/AppNavbar";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import PortalShowcase from "@/components/landing/PortalShowcase";
import {
  ArrowRight,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  ChevronRight,
  GraduationCap,
  Heart,
  Zap,
  BookOpen,
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
    desc: "Movement quality, body awareness, and coordination through age-appropriate strength training. No heavy loading — ever. This is about building the operating system their body will run on for the next decade. Middle school athletes learn proper form, develop connective tissue strength, and build the habits that prevent injury later.",
    action: "Youth Starter Strength Guide — $12",
    link: "/shop",
  },
  {
    age: "14–15",
    title: "Work Capacity Phase — Building Durability",
    desc: "Introduce structured resistance training focused on joints, tendons, and connective tissue BEFORE adding load. This is the phase most youth programs skip — and where injuries start. Affordable online strength training programs at this age set the foundation for everything that follows.",
    action: "Sport-specific strength guide — $9",
    link: "/shop",
  },
  {
    age: "16–17",
    title: "Strength & Power Phase — Sport Performance",
    desc: "Now they're ready. Progressive overload, sport-specific strength development, and competition prep. Their body can handle it because you didn't rush the first two phases. Whether it's youth baseball, soccer, hockey, or volleyball — strength is the engine behind every skill.",
    action: "Custom strength program by Matt — $20",
    link: "/shop",
  },
  {
    age: "18+",
    title: "College Prep Phase — Peak Durability",
    desc: "Peak performance strength programming. Matt has sent 50+ athletes to the college level. This phase is about durability under volume — because college coaches don't care how strong you were in high school if you're injured by October. The ultimate injury prevention is a body built to handle the workload.",
    action: "Full strength training with Matt →",
    link: "/pricing",
  },
];

const FUNNEL_STEPS = [
  {
    step: "1",
    title: "Start with a Strength Guide",
    desc: "Pick your athlete's sport. Get Matt's top strength exercises with the science behind each one. Affordable at just $9–$12 — real programming from a 20-year veteran.",
    icon: BookOpen,
    cta: "Browse Strength Guides",
    link: "/shop",
  },
  {
    step: "2",
    title: "Get a Custom Strength Program",
    desc: "Fill out the intake. Matt builds your athlete's strength program from scratch — their sport, equipment, and level. No templates. $20.",
    icon: Zap,
    cta: "Order Custom Program",
    link: "/shop",
  },
  {
    step: "3",
    title: "Train with Matt",
    desc: "In-person youth strength training in Grosse Pointe or online. 1-on-1, small group, or team programs. This is where injury prevention and performance meet.",
    icon: GraduationCap,
    cta: "View Training Plans",
    link: "/pricing",
  },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

/* ---------- page ---------- */

const ForParents = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />

    <div className="container pt-20 pb-16">
      {/* HERO */}
      <motion.div {...fade(0)} className="py-10 md:py-16">
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
              <motion.span {...fade(0.2)} className="block">Your athlete's body</motion.span>
              <motion.span {...fade(0.35)} className="block">is not a science experiment.</motion.span>
            </h1>
          </div>
        </div>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mb-6 leading-relaxed">
          Most youth strength training programs are built by people who learned from social media, not from 20 years of watching what actually breaks down in a young athlete's body. Matt Michels has trained thousands of kids through affordable, proven strength programs. 50+ went on to compete at the college level. Zero got injured. That's not a slogan — it's a record built on injury prevention, proper strength development, and patience.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Start with a $9 strength guide
            <ArrowRight size={15} />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
          >
            See strength training plans
          </Link>
        </div>
      </motion.div>

      {/* INJURY PREVENTION STATS */}
      <motion.div {...fade(0.15)} className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-destructive" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Youth Injury Prevention — The Numbers Nobody Talks About
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INJURY_STATS.map((s) => (
            <div key={s.label} className="bg-card shadow-m2 p-5">
              <span className="text-xl md:text-2xl font-bold text-primary font-mono block mb-1">{s.stat}</span>
              <p className="text-sm text-foreground leading-snug mb-1">{s.label}</p>
              <span className="text-[10px] text-muted-foreground font-mono">{s.source}</span>
            </div>
          ))}
        </div>
        <div className="bg-primary/10 border-2 border-primary/30 p-5 mt-3">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-bold mb-1">Matt's record: Zero injuries. Twenty years of youth strength training.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Not because he's lucky. Because he understands work capacity, recovery windows, and the biomechanics of growing bodies.
                Proper youth strength training is the single best injury prevention tool available — and Matt has proven it with thousands of athletes across
                youth soccer, baseball, hockey, volleyball, softball, and more.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* COLLEGE PREP TIMELINE */}
      <motion.div {...fade(0.2)} className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Youth Strength Development Timeline — From Middle School to College
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
          There's a right time for everything in youth strength training. Rush the process and your athlete pays for it — usually with an overuse injury that sidelines their senior season or worse, their college freshman year. Here's how Matt structures long-term strength development for young athletes:
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

      {/* THE DEAL — sleep & overtraining */}
      <motion.div {...fade(0.25)} className="mb-12">
        <div className="bg-card shadow-m2 p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={18} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">The Deal — Strength Training + Recovery</h2>
          </div>
          <p className="text-sm text-foreground font-semibold mb-2">
            Sleep is the #1 reason youth athletes get hurt. Bad or over-training is #2.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            So let Matt handle the strength training, and you tell them to go to bed. Problem solved. Young athletes' bodies need 72 hours minimum to really recover from proper strength work — more so now because they sit in front of their phones all night and don't get enough sleep. Matt prioritizes healthy joints and a healthy mind over numbers on a board. They all get strong. No need to rush.
          </p>
          <div className="bg-primary/10 border border-primary/20 p-4 mb-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-bold">Why Matt is different:</span> Most trainers move up to older, higher-paying clients as they build their career. Matt never did. He's delivered affordable youth strength training to the same age group for over 20 years — middle school through college prep. That makes him a unicorn in this profession. It's not a science for him anymore — it's an art he lives and breathes.
            </p>
          </div>
          <div className="bg-card border-2 border-primary/30 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-bold">When you buy a program, Matt is on the other end.</span> This is not an AI. Not a chatbot. Not a pre-written FAQ. When your athlete logs a workout and something doesn't feel right — they tap "Ask Matt" and <span className="text-foreground font-semibold">Matt personally reads it, responds, and walks them through it</span> like he's standing right there. The only things they don't get are his equipment and his sense of humor — and he's freaking hilarious. For $9–$20, your kid gets a 20-year veteran coach guiding them through every rep, at a fraction of the cost of in-person training.
            </p>
          </div>
        </div>
      </motion.div>

      {/* CLEAR PATH: Guide → Custom → Train */}
      <motion.div {...fade(0.3)} className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Your Path to Stronger, Safer Athletes
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
          You don't have to commit to anything big. Start small with an affordable strength training guide, see results, then decide how far you want to take it. Every step is designed for youth athletes — from middle school beginners to college-bound competitors.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FUNNEL_STEPS.map((f) => (
            <div key={f.step} className="bg-card shadow-m2 p-5 flex flex-col relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-3xl font-mono font-bold text-primary/15">{f.step}</span>
              </div>
              <f.icon size={22} className="text-primary mb-3" />
              <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{f.desc}</p>
              <Link
                to={f.link}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80 transition-m2"
              >
                {f.cta}
                <ArrowRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </motion.div>

      {/* PARENT TESTIMONIAL */}
      <motion.div {...fade(0.35)} className="mb-12">
        <div className="bg-card shadow-m2 p-5 md:p-6 border-l-4 border-primary">
          <p className="text-sm md:text-base italic text-muted-foreground leading-relaxed mb-3">
            "My son trained with Matt for three years. He walked on at Michigan as a freshman and started by his junior year. Matt didn't just make him stronger — he made him durable. Three years of college ball, zero time missed to injury. The strength training foundation Matt built was the difference."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">KR</span>
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">Parent of D1 Athlete</span>
              <span className="text-[10px] text-muted-foreground">Grosse Pointe, MI</span>
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

      {/* FINAL CTA */}
      <motion.div {...fade(0.4)} className="mb-12">
        <div className="bg-primary/10 border-2 border-primary/40 p-6 md:p-8 text-center">
          <h2 className="text-lg md:text-2xl font-bold text-foreground mb-2">
            Ready to invest in your athlete's strength and safety?
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
            Start with an affordable $9 sport-specific strength guide. See how Matt approaches youth strength training. Then decide if you want the full experience — online or in-person in Grosse Pointe.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
            >
              Browse Strength Guides
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
            >
              Create Free Account
            </Link>
            <a
              href="mailto:matthewmichels4@gmail.com?subject=Parent%20Inquiry%20-%20Youth%20Strength%20Training"
              className="text-xs font-bold text-primary hover:opacity-80 transition-m2"
            >
              Email Matt directly →
            </a>
          </div>
        </div>
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

export default ForParents;
