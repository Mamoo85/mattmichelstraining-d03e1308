import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const ForTrainers = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="For Trainers" />
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <h3 className="text-base font-bold text-foreground mb-2">Lease studio time</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Certified trainers — rent the M² gym by the hour or block. Private, fully equipped, no overhead.
      </p>
      <a
        href="mailto:matthewmichels4@gmail.com?subject=Studio%20Lease%20Inquiry"
        className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
      >
        Inquire about availability →
      </a>
    </div>
  </motion.div>
);

export default ForTrainers;
