import { lazy, Suspense } from "react";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useContentMap } from "@/hooks/useSiteContent";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, MapPin } from "lucide-react";
import TechShowcaseCard from "@/components/landing/TechShowcaseCard";
import ForParentsHero from "@/components/landing/ForParentsHero";
import MembershipTiers from "@/components/landing/MembershipTiers";
import BringAFriendCard from "@/components/landing/BringAFriendCard";
import { BenefitsGrid, ParentPortalSection } from "@/components/landing/ParentChildBenefits";
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const ForParents = () => {
  const { content: cms } = useContentMap("for_parents");
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="For Parents — Youth Strength Training Safety"
        description="3.5M youth sports injuries per year — 50% are preventable. Learn how M² Training keeps your athlete safe with science-backed strength programs from $12.99/mo."
        path="/for-parents"
      />
      <AppNavbar />

      <div className="container pt-20 pb-16">
        {/* IN-PERSON BANNER */}
        <motion.div {...fade(0)} className="mb-6">
          <div className="bg-primary text-primary-foreground p-4 md:p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">In-Person Youth Training Available</p>
                  <p className="text-xs opacity-80">Grosse Pointe Park, MI — 1-on-1, small group & team sessions</p>
                </div>
              </div>
              <Link
                to="/schedule"
                className="inline-flex items-center gap-1.5 bg-background text-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                <Calendar size={12} />
                Book a Session
              </Link>
            </div>
          </div>
        </motion.div>

        <ForParentsHero cms={cms} />
        <MembershipTiers />

        <motion.div {...fade(0.2)} className="mb-12">
          <BringAFriendCard />
        </motion.div>

        <BenefitsGrid />
        <ParentPortalSection user={user} />

        <motion.div {...fade(0.33)} className="mb-12">
          <TechShowcaseCard />
        </motion.div>

        <Suspense fallback={null}><DoNotPressButton /></Suspense>
        <div className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Youth Strength Training · Grosse Pointe Park, MI ·{" "}
            <Link to="/" className="text-primary hover:opacity-80 transition-m2">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForParents;
