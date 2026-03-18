import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import SectionHeader from "../SectionHeader";
import { useContentMap } from "@/hooks/useSiteContent";

const GUIDES = [
  { title: "Baseball Strength", price: "$9" },
  { title: "Football Strength", price: "$9" },
  { title: "Basketball Strength", price: "$9" },
  { title: "Hockey Strength", price: "$9" },
  { title: "Soccer Strength", price: "$9" },
  { title: "Lacrosse Strength", price: "$9" },
  { title: "Pre & Post Pregnancy", price: "$12" },
  { title: "Youth Starter Strength", price: "$12" },
];

const GuidesGrid = () => {
  const { content: c } = useContentMap("guides");

  const sectionTitle = c.section_title || "Sport-Specific Training Plans";
  const sectionSubtitle = c.section_subtitle || "PDF · Written by Matt · Instant download · Keep forever";
  const sectionDesc = c.section_description || "Each plan gives your athlete Matt's top exercises for their sport — with the WHY behind every movement. Built for youth athletes from middle school through college prep. No filler.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="mb-6"
    >
      <SectionHeader title={sectionTitle} timestamp={sectionSubtitle} />
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed max-w-2xl">{sectionDesc}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GUIDES.map((g) => (
          <Link
            key={g.title}
            to="/shop"
            className="bg-card shadow-m2 p-3 hover:bg-secondary/50 transition-m2 group flex items-center justify-between"
          >
            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 truncate">
              {g.title}
            </span>
            <span className="text-xs font-mono font-bold text-primary flex-shrink-0 ml-2">{g.price}</span>
          </Link>
        ))}
      </div>
      <div className="mt-2 text-center">
        <Link to="/shop" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">
          View all guides & programs →
        </Link>
      </div>
    </motion.div>
  );
};

export default GuidesGrid;
