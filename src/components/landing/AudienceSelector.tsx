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
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 text-center">
        What brings you here?
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {AUDIENCES.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.route)}
            className="bg-card shadow-m2 p-4 text-left hover:border-primary/50 border-2 border-transparent transition-m2 group"
          >
            <a.icon size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-foreground block mb-0.5 group-hover:text-primary transition-m2">
              {a.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{a.desc}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default AudienceSelector;
