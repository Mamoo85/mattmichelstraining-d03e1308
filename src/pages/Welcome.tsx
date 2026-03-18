import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Dumbbell,
  Users,
  Trophy,
  Star,
  Heart,
  Eye,
  MessageCircle,
  Video,
  Zap,
  CheckCircle2,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import m2Logo from "@/assets/m2-logo.jpg";
import ParentTestimonialCard from "@/components/landing/ParentTestimonialCard";

const SELL_POINTS = [
  "20+ years of one-on-one training experience",
  "50+ college athletes developed — zero injuries",
  "Tested, proven workouts backed by 20+ years of experience",
  "One app for everything you'll ever need",
];

const Welcome = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-16 max-w-3xl mx-auto px-4">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <img
          src={m2Logo}
          alt="M² Training"
          className="w-24 h-24 object-contain mx-auto mb-4"
        />
        <h1 className="text-2xl md:text-3xl font-bold tracking-display text-foreground mb-3">
          Welcome to <span className="text-primary">M² Training</span>
        </h1>
        <p className="text-sm text-foreground-soft max-w-lg mx-auto leading-relaxed">
          Your free account is ready. Now let's talk about how we can take your
          training — or your athlete's training — to the next level.
        </p>
      </motion.div>

      {/* AUTHORITY STRIP */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
      >
        {SELL_POINTS.map((p) => (
          <div key={p} className="flex items-start gap-2 bg-card shadow-m2 p-3">
            <CheckCircle2 size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-foreground leading-snug">{p}</span>
          </div>
        ))}
      </motion.div>

      {/* FREE 2-WEEK STARTER PROGRAM */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="bg-card shadow-m2 p-6 mb-10 border-l-4 border-primary"
      >
        <div className="flex items-start gap-3">
          <Dumbbell size={18} className="text-primary flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Your Free 2-Week Starter Program
            </h2>
            <p className="text-sm text-foreground-soft leading-relaxed mb-3">
              We already loaded a <strong className="text-foreground">complete 2-week training program</strong> into
              your dashboard — <strong className="text-foreground">totally free, no subscription needed.</strong> It's
              the same structure every M² client follows: warmup, workout, rolling, and mobility — every session.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                "6 full sessions over 2 weeks",
                "Warmup → Strength → Rolling → Mobility",
                "Week 2 adds progressive overload",
                "Log weights — Matt sees every session",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-foreground leading-snug">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">How to start:</strong> Head to your Dashboard → find "Today's Program" →
              follow the exercises, log your weights. This is a real sample of what a full membership delivers —
              fresh programs monthly, sport-specific training, and direct access to Coach Matt.
            </p>
          </div>
        </div>
      </motion.div>

      {/* PARENT TRUST TESTIMONIAL */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mb-10"
      >
        <ParentTestimonialCard />
      </motion.div>

      {/* STRENGTH > CARDIO — MATT'S PHILOSOPHY */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="bg-card shadow-m2 p-6 mb-10 border-l-4 border-primary"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 font-mono">
          The Real Deal
        </p>
        <p className="text-sm text-foreground-soft leading-relaxed mb-3">
          This isn't purple hypothesis. This is <strong className="text-foreground">strength training</strong>.
          If you want cardio, go somewhere else — cardio eats your muscle mass and
          runs you into an early grave. It's been proven: strength training releases
          the confidence and resilience that you and your children need to succeed in
          this crazy world.
        </p>
        <p className="text-sm text-foreground-soft leading-relaxed">
          Strength lasts a lifetime. Cardio only lasts while you're doing it.
          Matt has spent 20 years proving it — 50+ college athletes, zero injuries,
          real results every single time.
        </p>
      </motion.div>

      {/* PARENT + CHILD ACCOUNTS */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="bg-primary/10 border-2 border-primary/30 p-6 mb-10"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-primary" />
          <h2 className="text-base font-bold text-foreground">
            Parents: Stay in the Loop
          </h2>
        </div>
        <p className="text-sm text-foreground-soft leading-relaxed mb-4">
          Create a <strong className="text-foreground">linked child account</strong> and monitor every workout,
          every rep, every progress milestone. Ask Coach Matt questions on behalf of
          your athlete. On Pro membership and above, request video chats and form
          checks so Matt can coach your kid directly — no matter where you are.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Track every workout</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Message Coach Matt</span>
          </div>
          <div className="flex items-center gap-2">
            <Video size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Video form checks (Pro)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          All of this for less than a gym membership. Develop your athlete the
          right way without breaking the bank.
        </p>
        <Link
          to="/for-parents"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          <Users size={14} />
          Create Child Account
          <ArrowRight size={14} />
        </Link>
      </motion.div>

      {/* MONTHLY MEMBERSHIPS */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mb-10"
      >
        <h2 className="text-lg font-bold text-foreground mb-1 text-center">
          Monthly Memberships
        </h2>
        <p className="text-xs text-muted-foreground text-center mb-4">
          Real coaching. Real programs. Starting at less than a gym membership.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              name: "Basic",
              price: "$12.99/mo",
              icon: Star,
              perks: [
                "Monthly Focus Plan from Matt",
                "Full workout logging & tracking",
                "Member challenges & leaderboard",
                "10% off all programs",
              ],
            },
            {
              name: "Pro",
              price: "$25.99/mo",
              icon: Trophy,
              perks: [
                "Everything in Basic",
                "Fix It recovery library",
                "Direct messaging with Matt",
                "Video form checks & chats",
                "15% off all programs",
              ],
              highlight: true,
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className={`bg-card shadow-m2 p-5 ${
                tier.highlight
                  ? "border-2 border-primary ring-2 ring-primary/20"
                  : "border border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <tier.icon
                  size={16}
                  className={tier.highlight ? "text-primary" : "text-muted-foreground"}
                />
                <span className="text-sm font-bold text-foreground">{tier.name}</span>
                {tier.highlight && (
                  <span className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
                    Most Popular
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-primary font-mono mb-3">
                {tier.price}
              </p>
              <ul className="space-y-1.5">
                {tier.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 size={12} className="text-primary flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            <Zap size={14} />
            View All Plans
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>

      {/* ONE-TIME PROGRAMS */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="bg-card shadow-m2 p-6 mb-10"
      >
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell size={18} className="text-primary" />
          <h2 className="text-base font-bold text-foreground">
            One-Time Programs — No Subscription Needed
          </h2>
        </div>
        <p className="text-sm text-foreground-soft leading-relaxed mb-3">
          Older athlete? Parent on the road for work? Grab a one-time custom
          program built by Matt personally. Starting at <strong className="text-foreground">$20</strong>.
          Sport-specific, foundation, or fully custom — real workouts from a real
          trainer, not an algorithm.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
        >
          Browse Programs
          <ArrowRight size={14} />
        </Link>
      </motion.div>

      {/* YOUR ONE STOP SHOP */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        className="text-center mb-10"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Heart size={16} className="text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
            Your One Stop Shop
          </p>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Everything you'll ever need for working out — in one place. Tested,
          proven workouts and exercises from a trainer with 20 years of one-on-one
          experience. The results speak for themselves.
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.4 }}
        className="text-center"
      >
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Enter Your Training Portal
          <ArrowRight size={14} />
        </Link>
        <p className="text-[10px] text-muted-foreground mt-4">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI ·
          Real training, real results.
        </p>
      </motion.div>
    </div>
  </div>
);

export default Welcome;
