import { motion } from "framer-motion";
import SectionHeader from "@/components/shared/SectionHeader";
import { useContentMap } from "@/hooks/useSiteContent";

const ForTrainers = () => {
  const { content: c } = useContentMap("for_trainers");

  const title = c.title || "For Trainers";
  const subtitle = c.subtitle || "Lease studio time";
  const description = c.description || "Certified trainers — rent the M2 gym by the hour or block. Private, fully equipped, no overhead.";
  const cta = c.cta || "Inquire about availability →";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-10"
    >
      <SectionHeader title={title} />
      <div className="bg-card shadow-m2 p-5 md:p-6">
        <h3 className="text-base font-bold text-foreground mb-2">{subtitle}</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{description}</p>
        <a
          href="mailto:matthewmichels4@gmail.com?subject=Studio%20Lease%20Inquiry"
          className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
        >
          {cta}
        </a>
      </div>
    </motion.div>
  );
};

export default ForTrainers;
