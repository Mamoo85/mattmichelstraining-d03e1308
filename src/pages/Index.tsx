import { lazy, Suspense } from "react";
import AppNavbar from "@/components/AppNavbar";
import HeroSection from "@/components/HeroSection";
import SEOHead from "@/components/SEOHead";

const ChallengeTeaser = lazy(() => import("@/components/landing/ChallengeTeaser"));

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What ages does M² Training work with?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "M² Training works with athletes and adults ages 12 to 60+. Youth programs start with foundational movement patterns before progressing to sport-specific training.",
      },
    },
    {
      "@type": "Question",
      name: "Is youth strength training safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When coached properly, yes. In 20+ years and thousands of athletes, M² Training has maintained a zero-injury record. Programs focus on connective tissue strength and movement quality before adding load.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer online training?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. M² offers monthly online memberships starting at $14.99/mo with a 14-day free trial. Plans include the full exercise library, structured programs, injury recovery guides, and direct coaching from Matt.",
      },
    },
    {
      "@type": "Question",
      name: "What technology does M² Training use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "M² uses AI-powered posture analysis, velocity-based training tracking, smart nutrition scanning, and an intelligent workout logger — all accessible from your phone with no extra hardware.",
      },
    },
  ],
};

const Index = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M² Training | Youth Strength Coach — Grosse Pointe & Online"
      description="In-person youth strength training in Grosse Pointe Park, MI. Online programs anywhere. 20+ years, 50+ college athletes, zero injuries. Custom programs from $20."
      path="/"
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
    />
    <AppNavbar />
    <HeroSection />
    <div className="container py-12 max-w-xl mx-auto">
      <Suspense fallback={null}>
        <ChallengeTeaser />
      </Suspense>
    </div>
  </div>
);

export default Index;
