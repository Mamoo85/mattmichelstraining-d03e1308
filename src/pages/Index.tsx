import AppNavbar from "@/components/AppNavbar";
import HeroSection from "@/components/HeroSection";
import SEOHead from "@/components/SEOHead";

const Index = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M² Training | Youth Strength Coach — Grosse Pointe & Online"
      description="In-person youth strength training in Grosse Pointe Park, MI. Online programs anywhere. 20+ years, 50+ college athletes, zero injuries. Custom programs from $20."
      path="/"
    />
    <AppNavbar />
    <HeroSection />
  </div>
);

export default Index;
