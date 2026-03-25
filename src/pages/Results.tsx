import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Zap, Users, Quote } from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import AthleteResults from "@/components/landing/AthleteResults";
import InstagramSocialBox from "@/components/landing/InstagramSocialBox";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

const SPORTS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "M² Training",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Grosse Pointe Park",
    addressLocality: "Grosse Pointe Park",
    addressRegion: "MI",
    postalCode: "48230",
  },
  telephone: "313-806-4952",
  url: "https://mattmichelstraining.com",
  sport: ["Strength Training", "Youth Athletic Development", "Sports Performance"],
};

const PARENT_TESTIMONIALS = [
  {
    sport: "Football · Offensive Line",
    quote: "My son went from barely squatting 135 to 275 in 4 months. He's starting varsity as a sophomore. Matt fixed his form issues that 3 other trainers missed.",
    attribution: "— Father of D.R., Grosse Pointe South HS",
  },
  {
    sport: "Wrestling · 170lb Class",
    quote: "Zero injuries this season. First time in 3 years. Matt's programming built him up properly instead of just loading weight.",
    attribution: "— Parent of T.M.",
  },
  {
    sport: "Baseball · Pitcher",
    quote: "Velocity went from 78 to 82mph in 8 weeks. College coaches noticed at camp. We're grateful.",
    attribution: "— Parent of J.P.",
  },
];

const Results = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Results — Real Athletes, Real Gains | M² Training"
      description="See real results from M² Training clients — youth athletes, adults, and sport-specific performance gains in Grosse Pointe and Metro Detroit."
      path="/results"
      jsonLd={SPORTS_SCHEMA}
    />
    <AppNavbar />

    <div className="container pt-20 pb-16 max-w-4xl">
      {/* YOUTH TESTIMONIALS */}
      <motion.section {...fade(0)} className="mb-12">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          Youth Athletic Development · Grosse Pointe & Metro Detroit
        </span>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground mb-6">
          What Parents Are Saying
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PARENT_TESTIMONIALS.map((t) => (
            <div key={t.sport} className="bg-card border border-border p-5 flex flex-col">
              <Quote size={18} className="text-primary mb-3 opacity-60" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{t.sport}</p>
              <p className="text-xs text-foreground leading-relaxed italic flex-1">"{t.quote}"</p>
              <p className="text-[10px] text-muted-foreground mt-3 font-semibold">{t.attribution}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* MAIN RESULTS GRID */}
      <motion.div {...fade(0.1)}>
        <AthleteResults />
      </motion.div>

      {/* INSTAGRAM */}
      <motion.section {...fade(0.2)} className="mb-12">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">See More</span>
        <p className="text-xs text-muted-foreground mb-4">
          Follow @m2training for weekly client wins, training tips, and behind-the-scenes from the studio.
        </p>
        <InstagramSocialBox />
      </motion.section>

      {/* BOTTOM CTAs */}
      <motion.section {...fade(0.25)} className="space-y-3">
        <Link
          to="/schedule"
          className="flex items-center justify-between bg-card border border-border p-4 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-primary" />
            <div>
              <span className="text-sm font-bold text-foreground block">Train In-Person</span>
              <span className="text-[10px] text-muted-foreground">Book a session in Grosse Pointe Park</span>
            </div>
          </div>
          <span className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </Link>
        <Link
          to="/auth?redirect=/trial-welcome"
          className="flex items-center justify-between bg-card border border-border p-4 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-primary" />
            <div>
              <span className="text-sm font-bold text-foreground block">Try the App Free</span>
              <span className="text-[10px] text-muted-foreground">Start your free trial — no credit card required</span>
            </div>
          </div>
          <span className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </Link>
        <Link
          to="/for-parents"
          className="flex items-center justify-between bg-card border border-border p-4 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <div>
              <span className="text-sm font-bold text-foreground block">Youth Athlete Inquiry</span>
              <span className="text-[10px] text-muted-foreground">Learn about programs for high school athletes</span>
            </div>
          </div>
          <span className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </Link>
      </motion.section>

      <div className="pt-8 border-t border-border text-center mt-8">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI ·{" "}
          <Link to="/" className="text-primary hover:opacity-80 transition-all">Back to home</Link>
        </p>
      </div>
    </div>
  </div>
);

export default Results;
