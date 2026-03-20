import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import SectionHeader from "@/components/shared/SectionHeader";

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
          href="tel:3138064952"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          (313) 806-4952
        </a>
        <a
          href="mailto:matthew.michels4@gmail.com"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Email Matt
        </a>
        <a
          href="sms:3138064952"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Text Matt
        </a>
        <a
          href="https://maps.google.com/?q=15121+Kercheval+Ave,+Grosse+Pointe+Park,+MI+48230"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Get Directions
        </a>
        <a
          href="https://www.facebook.com/mattmichelstraining"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Facebook
        </a>
        <a
          href="https://www.instagram.com/mattmichelstraining/"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Instagram
        </a>
      </div>
      <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3">
        <Link
          to="/schedule"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          Schedule a Session →
        </Link>
        <Link
          to="/about"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          About Matt & M² Training →
        </Link>
      </div>
    </div>
  </motion.div>
);

export default FindUs;
