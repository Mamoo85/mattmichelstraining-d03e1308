import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, LogIn, Dumbbell, Shield, Zap, Heart, Target, Camera, Brain, Cpu, Sparkles, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import AiIntakeAnalyzer from "../programs/AiIntakeAnalyzer";
import TrialCTA from "../TrialCTA";
import aiBiomechanicsHero from "@/assets/ai-biomechanics-hero.jpg";
import aiPostureSide from "@/assets/ai-posture-side.jpg";

const SignUpButton = ({ size = "default" }: { size?: "default" | "small" }) => (
  <Link
    to="/auth"
    className={`inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:opacity-90 transition-m2 ${
      size === "small" ? "px-4 py-2 text-[10px] mt-2" : "px-6 py-3 text-xs"
    }`}
  >
    Create Free Account
    <ArrowRight size={size === "small" ? 12 : 14} />
  </Link>
);

const StoreGettingStarted = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* ═══════════ HERO: In-Person First ═══════════ */}
      <div className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1">
              Grosse Pointe Park, MI
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground leading-tight">
            Train With Matt.<br />
            <span className="text-primary">In Person. One-on-One.</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Start with a monthly 1-on-1 session. Matt builds your foundation, tracks your movement with 
            <strong className="text-foreground"> advanced biomechanics technology</strong>, and programs 
            everything around what your body actually needs. Add sessions at a discount as you grow.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
            >
              <Calendar size={14} /> Book Your First Session
            </Link>
            <a
              href="mailto:matthewmichels4@gmail.com?subject=Training%20Inquiry"
              className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
            >
              Email Matt
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════ THE EDGE: AI Tech Showcase ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <Brain size={14} /> The M² Edge
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-primary/50 to-transparent" />
        </div>

        <div className="bg-card border border-border overflow-hidden">
          <div className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-primary" />
              <h2 className="text-base font-black uppercase tracking-tight text-foreground">
                Computer Science Meets Strength & Conditioning
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Matt's two loves — <strong className="text-foreground">computers and exercise</strong> — fused into something 
              nobody else has. A front photo. A side photo. That's all it takes. Our advanced biomechanics system 
              analyzes joint angles, postural alignment, muscle activation patterns, and movement compensations in seconds — giving Matt data no other trainer has.
            </p>
            <p className="text-xs text-primary font-bold italic">
              "Always 5 years ahead. I can't help it."
            </p>
          </div>

          {/* AI showcase images with floating data effect */}
          <div className="grid grid-cols-2 gap-0 border-t border-border">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative group overflow-hidden"
            >
              <img
                src={aiBiomechanicsHero}
                alt="Biomechanics Analysis — Front View"
                className="w-full h-48 sm:h-64 object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-background/80 backdrop-blur-sm px-2 py-1 border border-primary/30">
                  Front Analysis
                </span>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative group overflow-hidden"
            >
              <img
                src={aiPostureSide}
                alt="AI Posture Analysis — Side View"
                className="w-full h-48 sm:h-64 object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-background/80 backdrop-blur-sm px-2 py-1 border border-primary/30">
                  Side Analysis
                </span>
              </div>
            </motion.div>
          </div>

          {/* What the AI does */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-border">
            {[
              { icon: Camera, label: "2 Photos", desc: "Front + side view" },
              { icon: Cpu, label: "Full Scan", desc: "Joint angles & alignment" },
              { icon: Sparkles, label: "Correctives", desc: "Personalized protocols" },
              { icon: Target, label: "Track", desc: "Progress over time" },
            ].map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="p-4 text-center border-r last:border-r-0 border-border"
              >
                <Icon size={18} className="text-primary mx-auto mb-1.5" />
                <p className="text-xs font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ HOW IT WORKS: In-Person Flow ═══════════ */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Dumbbell size={16} className="text-primary" />
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card shadow-m2 p-5 border-t-4 border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-mono font-bold text-primary">1</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">Book a Session</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start with a monthly 1-on-1 session in Grosse Pointe Park. Matt assesses your movement, 
              takes your front and side photos, and runs his AI analysis. You walk out with a program built for YOUR body.
            </p>
          </div>

          <div className="bg-card shadow-m2 p-5 border-t-4 border-primary/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-mono font-bold text-primary">2</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">Train & Track</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Log every workout in the portal. Matt monitors your progress, adjusts your programming, 
              and coaches you between sessions. AI tracks your biomechanics progress month over month.
            </p>
          </div>

          <div className="bg-card shadow-m2 p-5 border-t-4 border-primary">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-mono font-bold text-primary">3</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">Add Sessions & Save</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              As you grow, add extra sessions at a <strong className="text-primary">member discount</strong>. 
              Unlock the full M² portal — exercise library, AI nutrition tracking, Fix It recovery protocols, 
              challenges, and more.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════ PRICING: Sessions + Subscription ═══════════ */}
      <div className="bg-card shadow-m2 border border-primary/20 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          In-Person Session Pricing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-background border-2 border-primary/30 p-4 text-center">
            <div className="text-2xl font-mono font-black text-primary mb-1">1×</div>
            <p className="text-xs font-bold text-foreground mb-0.5">Monthly Session</p>
            <p className="text-[10px] text-muted-foreground">Assessment + AI analysis + custom program</p>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-3"
            >
              Book Now
            </Link>
          </div>
          <div className="bg-background border border-border p-4 text-center">
            <div className="text-2xl font-mono font-black text-primary mb-1">2×</div>
            <p className="text-xs font-bold text-foreground mb-0.5">Twice Monthly</p>
            <p className="text-[10px] text-muted-foreground">More coaching time, faster progress</p>
            <p className="text-[10px] text-primary font-bold mt-2">Member discount applied</p>
          </div>
          <div className="bg-background border border-border p-4 text-center">
            <div className="text-2xl font-mono font-black text-primary mb-1">4×</div>
            <p className="text-xs font-bold text-foreground mb-0.5">Weekly Sessions</p>
            <p className="text-[10px] text-muted-foreground">Maximum accountability & results</p>
            <p className="text-[10px] text-primary font-bold mt-2">Best per-session rate</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          All in-person clients receive <strong className="text-foreground">full M² Legend portal access</strong> — exercise library, AI nutrition, 
          progress tracking, challenges, and direct messaging with Matt.
        </p>
      </div>

      {/* ═══════════ NOT LOCAL? Online Options ═══════════ */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Not Local? Train Online.
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-card shadow-m2 p-4 flex gap-3 border border-primary/20">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$15</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Basic <span className="text-[8px] bg-muted text-muted-foreground px-1.5 py-0.5 uppercase ml-1">Starting</span></p>
              <p className="text-[11px] text-muted-foreground">Full 85+ exercise library, workout logging, challenges, monthly focus plans.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3 border-2 border-primary/40">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$40</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Foundation <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 uppercase ml-1">Popular</span></p>
              <p className="text-[11px] text-muted-foreground">Custom programming + Fix It library + form review + child invites.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$100</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Custom</p>
              <p className="text-[11px] text-muted-foreground">Fully custom program from Matt + 1-on-1 video assessment + direct messaging.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$150</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Team / Elite</p>
              <p className="text-[11px] text-muted-foreground">Full roster management, team programming, and full-season training plans.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Compare All Plans <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Trial CTA */}
      <TrialCTA variant="banner" />

      {/* Program Finder */}
      {user && (
        <div>
          <AiIntakeAnalyzer />
        </div>
      )}

      {/* ═══════════ Matt's Edge — The Fusion ═══════════ */}
      <div className="bg-primary/5 border border-primary/20 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Brain size={24} className="text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-tight text-foreground">
              Computer Engineer Turned Strength Coach
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              20 years of training. A degree in computer engineering. 50+ college athletes. Zero injuries. 
              Matt didn't just pick up a certification — he spent two decades merging the science of movement with 
              the power of technology. The biomechanics system isn't a gimmick. It's what happens when someone 
              who actually understands both worlds builds the tools he wished existed.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <Shield size={12} className="text-primary" />
                <span className="text-[10px] text-foreground font-bold">0 injuries in 20 years</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy size={12} className="text-primary" />
                <span className="text-[10px] text-foreground font-bold">50+ college athletes trained</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu size={12} className="text-primary" />
                <span className="text-[10px] text-foreground font-bold">Advanced biomechanics tech</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Who Matt trains */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Dumbbell size={16} className="text-primary" />
          Who Matt Trains
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Target, label: "Youth Athletes", sub: "Build it right from day one" },
            { icon: Users, label: "Parents", sub: "Train with — or for — your kids" },
            { icon: Heart, label: "Adults", sub: "Feel strong again at any age" },
            { icon: Zap, label: "Coaches", sub: "Practice what you preach" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-card shadow-m2 p-3 text-center">
              <Icon size={20} className="text-primary mx-auto mb-1.5" />
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Free features */}
      <div className="bg-card shadow-m2 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Free With Every Account</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5">
            <Star size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Monthly Focus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Challenges</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dumbbell size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Workout Log</span>
          </div>
        </div>
        {!user && (
          <div className="mt-3 pt-3 border-t border-border">
            <SignUpButton size="small" />
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {!user && (
        <div className="text-center py-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <p className="text-sm font-bold text-foreground mb-1">Don't overthink it.</p>
          <p className="text-xs text-muted-foreground mb-4">Free account. See for yourself.</p>
          <SignUpButton />
        </div>
      )}
    </div>
  );
};

export default StoreGettingStarted;
