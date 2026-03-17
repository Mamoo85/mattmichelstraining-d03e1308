import AppNavbar from "@/components/AppNavbar";
import MattsStory from "@/components/landing/MattsStory";
import WhyM2 from "@/components/landing/WhyM2";
import CanFixIt from "@/components/landing/CanFixIt";
import AboutPhilosophy from "@/components/AboutPhilosophy";
import { useSectionVisible } from "@/hooks/useSiteContent";

const About = () => {
  const showWhyM2 = useSectionVisible("why_m2");
  const showStory = useSectionVisible("matts_story");
  const showFixIt = useSectionVisible("can_fix_it");

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        <AboutPhilosophy />
        {showWhyM2 && <div className="mt-10"><WhyM2 /></div>}
        {showStory && <div className="mt-6"><MattsStory /></div>}
        {showFixIt && <div className="mt-6"><CanFixIt /></div>}

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
