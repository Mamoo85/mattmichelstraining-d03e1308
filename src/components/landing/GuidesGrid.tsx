import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeader from "../SectionHeader";

const GUIDES = [
  { title: "Baseball", price: "$9" },
  { title: "Football", price: "$9" },
  { title: "Basketball", price: "$9" },
  { title: "Hockey", price: "$9" },
  { title: "Soccer", price: "$9" },
  { title: "Lacrosse", price: "$9" },
  { title: "Pre & Post Pregnancy", price: "$12" },
  { title: "Youth Starter Guide", price: "$12" },
];

const GuidesGrid = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.25 }}
    className="mb-6"
  >
    <SectionHeader title="Sport-Specific Guides" timestamp="PDF · Written by Matt · Instant download" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {GUIDES.map((g) => (
        <Link
          key={g.title}
          to="/shop"
          className="bg-card shadow-m2 p-3 hover:bg-m2-surface-hover transition-m2 group flex items-center justify-between"
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
        View all guides →
      </Link>
    </div>
  </motion.div>
);

export default GuidesGrid;
