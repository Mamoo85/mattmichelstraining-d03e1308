import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import HeroSection from "@/components/features/HeroSection";
import SEOHead from "@/components/layout/SEOHead";
import LocalTopBar from "@/components/landing/LocalTopBar";

const ChallengeTeaser = lazy(() => import("@/components/landing/ChallengeTeaser"));
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));
const FirstMonthPromo = lazy(() => import("@/components/landing/FirstMonthPromo"));
const AiGeneratorShowcase = lazy(() => import("@/components/landing/AiGeneratorShowcase"));
const ProveItShowcase = lazy(() => import("@/components/landing/ProveItShowcase"));
const InstagramSocialBox = lazy(() => import("@/components/landing/InstagramSocialBox"));

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What ages does M2 Training work with?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "M2 Training works with athletes and adults ages 12 to 60+. Youth programs start with foundational movement patterns before progressing to sport-specific training.",
      },
    },
    {
      "@type": "Question",
      name: "Is youth strength training safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When coached properly, yes. In 20+ years and thousands of athletes, M2 Training has maintained a zero-injury record. Programs focus on connective tissue strength and movement quality before adding load.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer online training?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. M2 offers monthly online memberships starting at $19.99/mo. The Foundation tier includes a 14-day free trial of the full M2 App. Pro and Elite are custom coaching packages that start immediately. All plans include the exercise library, structured programs, injury recovery guides, and direct coaching from Matt.",
      },
    },
    {
      "@type": "Question",
      name: "What technology does M2 Training use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "M2 uses advanced posture analysis, velocity-based training tracking, smart nutrition scanning, and an intelligent workout logger — all accessible from your phone with no extra hardware.",
      },
    },
  ],
};

const Index = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Matt Michels Training | M2 Elite Strength & Conditioning"
      description="Expert personal training, strength and conditioning, and sports performance coaching in Grosse Pointe, MI. Matt Michels Training (M2) specializes in youth athlete development, powerlifting, functional fitness, post-rehab training, and custom workout programming."
      path="/"
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
    />
    <AppNavbar />
    <div className="bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center">
      <Link
        to="/zone"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        🔑 Current Client? Enter The Portal →
      </Link>
    </div>
    <LocalTopBar />
    <HeroSection />
    <div className="container py-12 max-w-xl mx-auto space-y-8">
      <Suspense fallback={null}>
        <AiGeneratorShowcase />
      </Suspense>
      <Suspense fallback={null}>
        <ProveItShowcase />
      </Suspense>
      <Suspense fallback={null}>
        <FirstMonthPromo />
      </Suspense>
      <Suspense fallback={null}>
        <ChallengeTeaser />
      </Suspense>
      <Suspense fallback={null}>
        <DoNotPressButton />
      </Suspense>
      <Suspense fallback={null}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground mb-4">Follow Along</h2>
          <InstagramSocialBox />
        </div>
      </Suspense>
      {/* Footer */}
      <div className="pt-6 border-t border-border text-center space-y-2">
        <p className="text-[10px] text-muted-foreground">
          <Link to="/studio-rental" className="text-primary hover:opacity-80 transition-all">
            Trainers & Health Professionals → Studio Rental & Partnerships
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} M2 Training · Grosse Pointe Park, MI
        </p>
      </div>
    </div>
    
  </div>
);

export default Index;
