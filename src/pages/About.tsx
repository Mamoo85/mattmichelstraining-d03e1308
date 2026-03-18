import AppNavbar from "@/components/AppNavbar";
import MattsStory from "@/components/landing/MattsStory";
import WhyM2 from "@/components/landing/WhyM2";
import AboutPhilosophy from "@/components/AboutPhilosophy";
import Testimonial from "@/components/landing/Testimonial";
import CurrentClients from "@/components/landing/CurrentClients";
import PressAuthority from "@/components/landing/PressAuthority";
import SuccessStories from "@/components/landing/SuccessStories";
import AuthorityBar from "@/components/landing/AuthorityBar";
import { useSectionVisible, useContentMap } from "@/hooks/useSiteContent";
import TrialCTA from "@/components/TrialCTA";

const ARTICLE_HIGHLIGHTS = [
  {
    label: "On his mission",
    quote: "I don't just train athletes; I aim to make everyone more athletic. I make athletes — that's what I do.",
  },
  {
    label: "On his community",
    quote: "My family and the M2 family I've built over the years are the most significant parts of my life. I put my heart and soul into my clients and they see it.",
  },
  {
    label: "His advice",
    quote: "Just do it! Start small, build up gradually and don't focus on the results. They'll come in time.",
  },
];

const SOCIAL_PROOF = [
  {
    platform: "Facebook",
    handle: "Matt Michels Training",
    url: "https://www.facebook.com/mattmichelstraining",
    content: "Workout of the Week series — real exercises, real coaching cues, zero fluff",
  },
  {
    platform: "Instagram",
    handle: "@mattmichelstraining",
    url: "https://www.instagram.com/mattmichelstraining/",
    content: "Training clips, athlete highlights, and the science behind the movement",
  },
];

const About = () => {
  const showWhyM2 = useSectionVisible("why_m2");
  const showStory = useSectionVisible("matts_story");
  const showAuthority = useSectionVisible("authority_bar");
  const showStats = useSectionVisible("stats");
  const showTestimonial = useSectionVisible("testimonial");
  const showClients = useSectionVisible("current_clients");
  const showPress = useSectionVisible("press");
  const { content: stats } = useContentMap("stats");

  const STATS = [
    { value: stats.stat_1_value || "20+", label: stats.stat_1_label || "Years" },
    { value: stats.stat_2_value || "50+", label: stats.stat_2_label || "College Athletes" },
    { value: stats.stat_3_value || "1000s", label: stats.stat_3_label || "Clients Trained" },
    { value: stats.stat_4_value || "Zero", label: stats.stat_4_label || "Injuries" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        {showAuthority && <div className="mb-6"><AuthorityBar /></div>}

        {showStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card shadow-m2 p-4 text-center">
                <span className="text-xl md:text-2xl font-bold text-primary font-mono block">{s.value}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        <AboutPhilosophy />

        {showPress && <div className="mt-6"><PressAuthority /></div>}

        {showTestimonial && <div className="mt-6"><Testimonial /></div>}

        <div className="mt-6"><SuccessStories /></div>

        {/* Article Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 mb-3">
          {ARTICLE_HIGHLIGHTS.map((h) => (
            <div key={h.label} className="bg-card shadow-m2 p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                {h.label}
              </span>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                "{h.quote}"
              </p>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {SOCIAL_PROOF.map((s) => (
            <a
              key={s.platform}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                {s.platform}
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 block mb-1">
                {s.handle}
              </span>
              <span className="text-[11px] text-muted-foreground">{s.content}</span>
            </a>
          ))}
        </div>

        {showWhyM2 && <div className="mt-10"><WhyM2 /></div>}
        {showStory && <div className="mt-6"><MattsStory /></div>}
        
        {showClients && <div className="mt-6"><CurrentClients /></div>}

        {/* Trial CTA */}
        <div className="mt-8">
          <TrialCTA variant="inline" className="w-full justify-center py-3" />
        </div>

        {/* FOOTER */}
        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M² Training</span> · Grosse Pointe Park, MI
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
