import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BookOpen, Shield, Dumbbell, ArrowRight, Target, Heart, Brain,
  Play, ChevronDown, ChevronUp, Flame, Clock, Users, Share2, Check, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import AppNavbar from "@/components/AppNavbar";
import MonthlyFocus from "@/components/landing/MonthlyFocus";

import TrialCTA from "@/components/TrialCTA";

/* ── Featured Videos ── */
const VIDEOS = [
  {
    title: "Why Most Youth Athletes Get Injured",
    description: "Matt breaks down the #1 reason young athletes get hurt — and what parents can do about it before it's too late.",
    embedId: "",
    duration: "8 min",
    category: "Injury Prevention",
  },
  {
    title: "The Truth About Youth Strength Training",
    description: "Should kids lift weights? Matt explains the science-backed answer and shows what age-appropriate training actually looks like.",
    embedId: "",
    duration: "12 min",
    category: "Youth Development",
  },
  {
    title: "5 Exercises Every Athlete Should Master",
    description: "Before sport-specific work, these foundational movements build the body that can handle anything. Matt demos each one.",
    embedId: "",
    duration: "10 min",
    category: "Training Fundamentals",
  },
];

/* ── Training Tips ── */
const TIPS = [
  {
    icon: Flame,
    title: "Don't Skip the Warm-Up",
    content: "A proper warm-up isn't jogging for 5 minutes. It's targeted activation — glutes, core, and the specific joints you're about to load. Matt's athletes spend 8-12 minutes on movement prep before every session. The ones who skip it? They're the ones who end up in the 'Fix It' library.",
  },
  {
    icon: Clock,
    title: "Recovery Is Where Growth Happens",
    content: "Your muscles don't grow in the gym — they grow while you rest. Sleep 8+ hours, eat enough protein (0.7-1g per lb bodyweight for youth athletes), and foam roll the areas that feel tight. Recovery isn't soft. It's smart.",
  },
  {
    icon: Shield,
    title: "Tendons Before Muscles",
    content: "Muscles adapt in weeks. Tendons take months. This is why Matt's Foundation programs spend the first phase building connective tissue strength before adding real load. Skip this step, and you're building a house on sand.",
  },
  {
    icon: Target,
    title: "Train Movements, Not Muscles",
    content: "Nobody on a field isolates their biceps. Athletic performance comes from training the squat pattern, hip hinge, push, pull, carry, and rotation. Every M² program is built around these fundamental human movements.",
  },
  {
    icon: Users,
    title: "Parents: Watch the Volume",
    content: "Playing travel ball 6 days a week + club training + strength work = overtraining. The biggest mistake parents make is letting their kid do too much. More isn't better. Better is better. If your kid is always sore or tired, something needs to change.",
  },
  {
    icon: Brain,
    title: "Consistency Over Intensity",
    content: "3 solid sessions a week for 6 months beats 6 sessions a week for 6 weeks. The athletes who win long-term are the ones who show up, follow the plan, and trust the process. There's no hack. Just the work.",
  },
];

/* ── Topic Cards (existing) ── */
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

/* ── Share Button ── */
const ShareButton = ({ title, slug }: { title: string; slug: string }) => {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/learn#${slug}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `M² Training — ${title}`, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-m2 px-2 py-1"
    >
      {copied ? <Check size={12} className="text-primary" /> : <Share2 size={12} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
};

/* ── Article Card ── */
const ArticleCard = ({ article, isExpanded, onToggle }: {
  article: any;
  isExpanded: boolean;
  onToggle: () => void;
}) => (
  <motion.div
    layout
    className="bg-card shadow-m2 overflow-hidden"
    id={article.slug}
  >
    {article.cover_image_url && !isExpanded && (
      <img
        src={article.cover_image_url}
        alt={article.title}
        className="w-full h-40 object-cover"
        loading="lazy"
      />
    )}
    {article.cover_image_url && isExpanded && (
      <img
        src={article.cover_image_url}
        alt={article.title}
        className="w-full h-56 object-cover"
        loading="lazy"
      />
    )}
    <div className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">
          {article.category.replace(/-/g, " ")}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {article.published_at ? new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
        </span>
      </div>

      <button onClick={onToggle} className="text-left w-full group">
        <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-m2">
          {article.title}
        </h3>
        {!isExpanded && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {article.body.replace(/[#*_`>\-]/g, "").slice(0, 160)}…
          </p>
        )}
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <div className="prose prose-sm prose-invert max-w-none text-foreground-soft text-sm leading-relaxed
            prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
            prose-a:text-primary prose-strong:text-foreground">
            <ReactMarkdown>{article.body}</ReactMarkdown>
          </div>
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-border">
            <span className="text-[10px] text-muted-foreground">By {article.author}</span>
            <div className="flex items-center gap-2">
              <ShareButton title={article.title} slug={article.slug} />
              <button
                onClick={onToggle}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 px-2 py-1"
              >
                <X size={12} /> Close
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {!isExpanded && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={onToggle}
            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2 flex items-center gap-1"
          >
            Read Article <ArrowRight size={10} />
          </button>
          <ShareButton title={article.title} slug={article.slug} />
        </div>
      )}
    </div>
  </motion.div>
);

/* ── Video Card ── */
const VideoCard = ({ video }: { video: typeof VIDEOS[0] }) => (
  <div className="bg-card shadow-m2 overflow-hidden group">
    <div className="relative aspect-video bg-muted/50">
      {video.embedId ? (
        <iframe
          src={`https://www.youtube.com/embed/${video.embedId}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <Play size={24} className="text-primary ml-0.5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Video Coming Soon
          </span>
        </div>
      )}
    </div>
    <div className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">
          {video.category}
        </span>
        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
          <Clock size={8} /> {video.duration}
        </span>
      </div>
      <h3 className="text-sm font-bold text-foreground mb-1">{video.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{video.description}</p>
    </div>
  </div>
);

/* ── Expandable Tip ── */
const TipCard = ({ tip }: { tip: typeof TIPS[0] }) => {
  const [open, setOpen] = useState(false);
  const Icon = tip.icon;
  return (
    <div className="bg-card shadow-m2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/10 transition-m2"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 flex-shrink-0">
            <Icon size={16} className="text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">{tip.title}</span>
        </div>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4"
        >
          <p className="text-xs text-muted-foreground leading-relaxed pl-11">
            {tip.content}
          </p>
        </motion.div>
      )}
    </div>
  );
};

/* ── Page ── */
const Learn = () => {
  const { data: articles = [] } = useQuery({
    queryKey: ["learn-articles-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learn_articles")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  return (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12 px-4 sm:px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Free Resources
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Learn from Coach Matt
          </h1>
          <p className="text-sm text-foreground-soft max-w-xl leading-relaxed">
            20+ years of training knowledge — injury prevention tips, training
            fundamentals, and the hard truths most trainers won't tell you. Free.
            No paywall. No fluff.
          </p>
        </div>

        {/* CMS Articles Grid */}
        {articles.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                Latest from Matt
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((a: any) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  isExpanded={expandedArticle === a.id}
                  onToggle={() => setExpandedArticle(expandedArticle === a.id ? null : a.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Monthly Focus */}
        <div className="mb-10">
          <MonthlyFocus />
        </div>

        {/* ── Featured Videos ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Play size={16} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Featured Videos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VIDEOS.map((v) => (
              <VideoCard key={v.title} video={v} />
            ))}
          </div>
        </section>

        {/* ── Training Tips ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={16} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Training Tips from Matt
            </h2>
          </div>
          <div className="space-y-2">
            {TIPS.map((t) => (
              <TipCard key={t.title} tip={t} />
            ))}
          </div>
        </section>

        {/* ── Deep Dive Topics ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Deep Dives
            </h2>
          </div>
          <div className="space-y-4">
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
        </section>

        {/* ── Trial CTA ── */}
        <section className="mb-10">
          <TrialCTA variant="comparison" />
        </section>

      </motion.div>
    </div>
  </div>
  );
};

export default Learn;
