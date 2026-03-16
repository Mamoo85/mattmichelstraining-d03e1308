import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const FindUs = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.35 }}
  >
    <SectionHeader title="Find Us" />
    <div className="bg-card shadow-m2 p-5">
      <p className="text-sm font-bold text-foreground">M² Training</p>
      <p className="text-xs text-muted-foreground mt-1">
        15121 Kercheval Ave
        <br />
        Grosse Pointe Park, MI 48230
      </p>
      <div className="flex flex-wrap gap-3 mt-3">
        <a
          href="https://maps.google.com/?q=15121+Kercheval+Ave,+Grosse+Pointe+Park,+MI+48230"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Get Directions
        </a>
        <a
          href="https://www.facebook.com/matt-michels-training"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Follow on Facebook
        </a>
        <a
          href="mailto:matthewmichels4@gmail.com"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Email Matt
        </a>
      </div>
    </div>
  </motion.div>
);

export default FindUs;
