import { motion } from "framer-motion";
import { Shield, Users, Dumbbell, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AUDIENCES = [
  {
    label: "I'm a Parent",
    icon: Shield,
    route: "/for-parents",
    desc: "Injury-proof your athlete",
  },
  {
    label: "I'm an Athlete",
    icon: Dumbbell,
    route: "/shop",
    desc: "Get a real program",
  },
  {
    label: "I'm a Coach",
    icon: Users,
    route: "/pricing",
    desc: "Team & roster programs",
  },
  {
    label: "Current Member",
    icon: GraduationCap,
    route: "/dashboard",
    desc: "Log in to your portal",
  },
];

const AudienceSelector = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="mb-10"
    >
      <div className="border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Why are you here?
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {AUDIENCES.map((a, i) => (
            <motion.button
              key={a.label}
              onClick={() => navigate(a.route)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 + i * 0.08 }}
              className="bg-background border border-border p-3 sm:p-4 text-left hover:border-primary/50 transition-m2 group"
            >
              <a.icon size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-foreground block mb-0.5 group-hover:text-primary transition-m2">
                {a.label}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">{a.desc}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AudienceSelector;
