import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Quote, Star, Newspaper, ExternalLink,
  GraduationCap, Heart, Gamepad2, Users, ShieldOff,
  Shield, Trophy, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import m2Logo from "@/assets/m2-logo.jpg";
import poiFamily from "@/assets/poi-matt-family.jpg";
import poiTraining from "@/assets/poi-matt-training.jpg";

/* ─── animation helper ─── */
const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.45, delay },
});

/* ─── data ─── */

const PRESS_ARTICLE = {
  outlet: "Grosse Pointe News — Pointer of Interest",
  title: "Strength in Motion: How One Trainer Turned Passion into Purpose",
  date: "February 26, 2025",
  author: "Anne Gryzenia",
  url: "https://www.grossepointenews.com/articles/strength-in-motion-how-one-trainer-turned-passion-into-purpose/",
  lede: "In the heart of Grosse Pointe, where the water of Lake St. Clair meets a community built on tradition and success, strength coach and personal trainer Matthew Michels has carved out his own path — one defined by passion, perseverance and a relentless drive to uplift those around him.",
  pullQuotes: [
    "His business, built entirely by word of mouth, is a testament to the impact he's had on his clients. Whether he's coaching middle schoolers, training college-bound athletes or helping everyday individuals move and feel better, Michels is, at his core, a teacher.",
    "I don't just train athletes; I aim to make everyone more athletic. I make athletes — that's what I do.",
    "My family and the M2 family I've built over the years are the most significant parts of my life. I put my heart and soul into my clients and they see it.",
  ],
};

const STORY_BEATS = [
  {
    icon: GraduationCap,
    title: "The Pivot",
    text: "Matt studied computer engineering at Wayne State. An internship in software programming quickly revealed the cubicle life wasn't for him. He found himself drawn to personal training — realizing his unique ability to connect with, motivate, and mentor others.",
  },
  {
    icon: Heart,
    title: "The Motivation",
    text: "When Matt's father passed, it reshaped his perspective in profound ways. \"After the first six months, his loss began to be my motivation. I just wanted to make him proud.\" That drive propelled Matt to build M2 Training from nothing — entirely by word of mouth.",
  },
  {
    icon: Gamepad2,
    title: "The Competitor",
    text: "Before esports went mainstream, Matt was a professional gamer competing in world championships. He's also a history buff with deep knowledge of WWII battles and generals. That competitive edge and strategic mind carry into every program he designs.",
  },
  {
    icon: ShieldOff,
    title: "The Anti-Influencer",
    text: "Matt never wanted to be the social media trainer guy. He's an old-school strength trainer trying to spread real knowledge before the AI bots completely take over everyone's feed. Getting strong is hard. It's an achievement nobody can ever take away from you.",
  },
  {
    icon: Users,
    title: "The Family Man",
    text: "When asked what he's most proud of, Matt doesn't mention championships or accolades. His first thought is his wife Janelle and their young son Harrison. \"When I decided against a stable career in computer engineering to follow my passion, she was fully supportive. She continues to support and amaze me.\"",
  },
];

const FALLBACK_TESTIMONIALS = [
  {
    id: "ft1",
    quote: "My son trained with Matt for three years. He walked on at Michigan as a freshman and started by his junior year. Matt didn't just make him stronger — he made him durable.",
    author_name: "Parent of D1 Athlete",
    author_role: "Grosse Pointe, MI",
    author_initials: "KR",
  },
  {
    id: "ft3",
    quote: "I've worked with online coaches before and they send you a PDF and disappear. Matt actually watches my videos, replies the same day, and adjusts my program.",
    author_name: "Jake R.",
    author_role: "College Athlete · Remote",
    author_initials: "JR",
  },
  {
    id: "ft4",
    quote: "We were spending $200/month on a trainer who had our daughter doing the same exercises as adults. Matt's youth program is age-appropriate, affordable, and she actually enjoys it.",
    author_name: "Lisa & Tom K.",
    author_role: "Parents · St. Clair Shores",
    author_initials: "LT",
  },
];

const FALLBACK_STATS = [
  { value: "20+", label: "Years Training" },
  { value: "50+", label: "College Athletes" },
  { value: "1000s", label: "Clients Coached" },
  { value: "Zero", label: "Injuries — Ever" },
];

/* ─── page ─── */

const About = () => {
  // CMS stats
  const { data: cmsStats } = useQuery({
    queryKey: ["homepage-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_key, content_value")
        .eq("section", "homepage_stats")
        .order("sort_order", { ascending: true });
      if (!data || data.length === 0) return null;
      const map: Record<string, string> = {};
      data.forEach((d: any) => { map[d.content_key] = d.content_value; });
      return [
        { value: map["stat_1_value"] || "", label: map["stat_1_label"] || "" },
        { value: map["stat_2_value"] || "", label: map["stat_2_label"] || "" },
        { value: map["stat_3_value"] || "", label: map["stat_3_label"] || "" },
        { value: map["stat_4_value"] || "", label: map["stat_4_label"] || "" },
      ].filter((s) => s.value && s.label);
    },
    staleTime: 5 * 60_000,
  });

  // CMS testimonials for about page
  const { data: cmsTestimonials } = useQuery({
    queryKey: ["testimonials", "about"],
    queryFn: async () => {
      const { data } = await supabase
        .from("testimonials" as any)
        .select("id, quote, author_name, author_role, author_initials")
        .eq("page", "about")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const STATS = cmsStats && cmsStats.length > 0 ? cmsStats : FALLBACK_STATS;
  const TESTIMONIALS = cmsTestimonials && cmsTestimonials.length > 0 ? cmsTestimonials : FALLBACK_TESTIMONIALS;

  return (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="About Coach Matt Michels"
      description="Meet Matt Michels — 20+ years training youth athletes in Grosse Pointe. Anti-influencer strength coach who's sent 50+ athletes to the college level with zero injuries."
      path="/about"
    />
    <AppNavbar />
    <div className="container pt-20 pb-16 max-w-4xl mx-auto px-4">

      {/* ═══════════════════════════════════════════
          1. HERO — Matt's identity at a glance
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0)} className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          {/* Photo */}
          <div className="md:col-span-2">
            <img
              src={poiTraining}
              alt="Matt Michels — Strength Coach, M² Training"
              className="w-full aspect-[4/5] object-cover shadow-m2"
            />
          </div>
          {/* Intro */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3 mb-3">
              <img src={m2Logo} alt="M² Training" className="w-10 h-10 object-contain" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
                About Matt Michels
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-display text-foreground leading-tight mb-3">
              I make athletes —{" "}
              <span className="text-primary">that's what I do.</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Born and raised in Grosse Pointe. 20+ years of training athletes
              of every age — from middle schoolers learning their first squat to college-bound
              competitors chasing scholarships. Built entirely by word of mouth.
            </p>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-card shadow-m2 p-2.5 text-center">
                  <span className="text-base md:text-lg font-bold text-primary font-mono block">{s.value}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Matt lives and breathes helping his clients. He gets genuinely excited when someone
              hits a new PR, masters a movement, or finally understands <em>why</em> strength training
              matters for their life. He has a great sense of humor, loves his job, and wants nothing
              more than to share everything he's learned over two decades with the world.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════
          2. PRESS FEATURE — Pointer of Interest
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.1)} className="mb-12">
        <a
          href={PRESS_ARTICLE.url}
          target="_blank"
          rel="noreferrer"
          className="block bg-card shadow-m2 overflow-hidden hover:shadow-lg transition-all duration-300 group"
        >
          {/* Header bar */}
          <div className="bg-primary px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper size={16} className="text-primary-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                Featured Article
              </span>
            </div>
            <span className="text-[10px] text-primary-foreground/70 font-mono">{PRESS_ARTICLE.date}</span>
          </div>

          <div className="p-5 md:p-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
              {PRESS_ARTICLE.outlet}
            </span>
            <h2 className="text-lg md:text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-3">
              "{PRESS_ARTICLE.title}"
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {PRESS_ARTICLE.lede}
            </p>

            {/* Pull quotes */}
            <div className="space-y-3 mb-4">
              {PRESS_ARTICLE.pullQuotes.map((q, i) => (
                <div key={i} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">"{q}"</p>
                </div>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs text-primary font-bold group-hover:gap-2.5 transition-all">
              Read the full Grosse Pointe News article <ExternalLink size={12} />
            </span>
          </div>
        </a>
      </motion.div>

      {/* ═══════════════════════════════════════════
          3. FAMILY PHOTO + LIFE MOTTO
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.15)} className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <div className="overflow-hidden shadow-m2">
            <img
              src={poiFamily}
              alt="Matthew Michels, his wife Janelle, and their young son Harrison — Grosse Pointe News"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="bg-card shadow-m2 p-5 md:p-6 flex flex-col justify-center">
            <div className="border-l-4 border-primary pl-4 mb-4">
              <p className="text-base md:text-lg italic text-foreground leading-relaxed">
                "If you're going through hell, keep going."
              </p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary mt-2 block">
                Winston Churchill — Matt's life motto
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Matt with his wife Janelle and their son Harrison. When asked what he's most proud of,
              championships and accolades aren't even on the list — family comes first, always.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "When I decided against a stable career in computer engineering to follow my passion,
              she was fully supportive. She continues to support and amaze me."
            </p>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════
          4. THE MAN BEHIND M² — Story beats
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.2)} className="mb-12">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          The Man Behind M²
        </span>
        <h2 className="text-lg font-bold text-foreground mb-4">
          Born & raised in Grosse Pointe
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STORY_BEATS.map((beat) => (
            <div key={beat.title} className="bg-card shadow-m2 p-4">
              <div className="flex items-center gap-2 mb-2">
                <beat.icon size={16} className="text-primary flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  {beat.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{beat.text}</p>
            </div>
          ))}
        </div>
      </motion.div>


      {/* ═══════════════════════════════════════════
          6. TESTIMONIALS — What families say
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.3)} className="mb-12">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          What Parents & Athletes Say
        </span>
        <h2 className="text-lg font-bold text-foreground mb-4">
          Real results from real families
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TESTIMONIALS.map((t: any) => (
            <div key={t.id || t.author_name} className="bg-card shadow-m2 p-5 flex flex-col">
              <Quote size={16} className="text-primary/40 mb-2" />
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
                "{t.quote}"
              </p>
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={10} className="text-primary fill-primary" />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">{t.author_initials}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">{t.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">{t.author_role}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* SUCCESS STORIES — REMOVED: Do not re-add until real athlete stories are collected */}

      {/* ═══════════════════════════════════════════
          8. SOCIAL + CONTACT
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.4)} className="mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://www.facebook.com/mattmichelstraining"
            target="_blank"
            rel="noreferrer"
            className="bg-card shadow-m2 p-4 hover:bg-secondary/50 transition-m2 group"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Facebook</span>
            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 block mb-1">Matt Michels Training</span>
            <span className="text-[11px] text-muted-foreground">Workout of the Week series — real exercises, real coaching cues, zero fluff</span>
          </a>
          <a
            href="https://www.instagram.com/mattmichelstraining/"
            target="_blank"
            rel="noreferrer"
            className="bg-card shadow-m2 p-4 hover:bg-secondary/50 transition-m2 group"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Instagram</span>
            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 block mb-1">@mattmichelstraining</span>
            <span className="text-[11px] text-muted-foreground">Training clips, athlete highlights, and the science behind the movement</span>
          </a>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════
          9. CTA
      ═══════════════════════════════════════════ */}
      <motion.div {...fade(0.45)} className="text-center mb-8">
        <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
          Ready to train with Matt? Start with a free 14-day trial or grab a $20 program.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/auth?redirect=/trial-welcome"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Start Free Trial
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
          >
            Browse Programs
          </Link>
        </div>
      </motion.div>

      {/* FOOTER */}
      <div className="pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M² Training</span> · Grosse Pointe Park, MI
        </p>
      </div>
    </div>
  </div>
  );
};

export default About;
