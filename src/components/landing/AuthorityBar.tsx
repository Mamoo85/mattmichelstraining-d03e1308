import { motion } from "framer-motion";
import { useIsMichigan } from "@/hooks/useGeoState";

const ALL_CREDS = [
  "B.S. Kinesiology",
  "20+ Years Training Athletes",
  "50+ College Athletes Produced",
  "Zero Injuries — Ever",
];

const AuthorityBar = () => {
  const isMI = useIsMichigan();
  const creds = isMI ? ALL_CREDS.filter((c) => c !== "B.S. Kinesiology") : ALL_CREDS;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mb-10"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {creds.map((c, i) => (
          <span key={c} className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {i > 0 && <span className="w-1 h-1 rounded-full bg-primary" />}
            {c}
          </span>
        ))}
      </div>
    </motion.div>
  );
};

export default AuthorityBar;
