import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Shield, Dumbbell, ArrowRight, Target, Heart, Brain } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import MonthlyFocus from "@/components/landing/MonthlyFocus";
import NewsletterSignup from "@/components/NewsletterSignup";

const TOPICS = [
  {
    icon: Shield,
    title: "Injury Prevention for Youth Athletes",
    desc: "3.5 million youth sports injuries per year — and half are preventable. Learn what every parent should know about connective tissue strength, movement quality, and age-appropriate loading.",
    link: "/for-parents",
    cta: "Read more for parents",
  },
  {
    icon: Dumbbell,
    title: "When Should Kids Start Lifting?",
    desc: "Strength training for kids isn't about heavy barbells. It's about teaching their body how to move. Matt's Youth Foundation Programs start as young as 11 — with zero heavy loading.",
    link: "/shop",
    cta: "View youth programs",
  },
  {
    icon: Target,
    title: "Sport-Specific Training Plans",
    desc: "Baseball, soccer, hockey, basketball, football, volleyball, lacrosse — each sport has specific strength demands. Matt's plans cover the top exercises for each sport and explain the WHY behind every movement.",
    link: "/shop",
    cta: "Browse training plans",
  },
  {
    icon: Heart,
    title: "Recovery & Self-Care",
    desc: "Foam rolling isn't optional. Sleep matters more than supplements. Learn the recovery fundamentals Matt teaches every one of his athletes — from middle schoolers to college-level competitors.",
    link: "/shop",
    cta: "Explore the Fix It Library",
  },
  {
    icon: Brain,
    title: "The Mental Side of Training",
    desc: "Consistency beats intensity. Matt's training philosophy isn't just physical — it's about building habits, discipline, and confidence that transfer to every area of life.",
    link: "/about",
    cta: "Matt's philosophy",
  },
];

const Learn = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Free Resources
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Learn from Coach Matt
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            20+ years of training knowledge — injury prevention tips, training
            fundamentals, and the hard truths most trainers won't tell you. Free.
          </p>
        </div>

        {/* Monthly Focus */}
        <MonthlyFocus />

        {/* Topics */}
        <div className="space-y-4 mb-10">
          {TOPICS.map((t) => (
            <div key={t.title} className="bg-card shadow-m2 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2.5 flex-shrink-0">
                  <t.icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground mb-1">{t.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t.desc}</p>
                  <Link
                    to={t.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
                  >
                    {t.cta}
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <NewsletterSignup />
      </motion.div>
    </div>
  </div>
);

export default Learn;
