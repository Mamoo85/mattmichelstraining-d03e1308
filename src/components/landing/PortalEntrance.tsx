import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LogIn, BarChart3, Dumbbell, MessageSquare } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.png";
import portalChat from "@/assets/portal-chat.png";
import portalProgress from "@/assets/portal-progress.png";

const PILLS = [
  { icon: BarChart3, label: "Track Progress" },
  { icon: Dumbbell, label: "Log Workouts" },
  { icon: MessageSquare, label: "Coach Chat" },
];

const PortalEntrance = () => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.22 }}
    className="mb-10"
  >
    {/* Quick-access button */}
    <Link
      to="/dashboard"
      className="flex items-center justify-center gap-3 w-full bg-card border-2 border-primary/30 hover:border-primary px-5 py-4 transition-m2 group mb-4"
    >
      <LogIn size={18} className="text-primary" />
      <span className="text-sm font-bold uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
        Enter Member Portal
      </span>
    </Link>

    {/* Feature pills */}
    <div className="flex gap-2 mb-4">
      {PILLS.map((p) => (
        <div
          key={p.label}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary/5 border border-primary/10 py-2 px-2"
        >
          <p.icon size={12} className="text-primary flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {p.label}
          </span>
        </div>
      ))}
    </div>

    {/* Sneak peek — overlapping screenshots with gradient fade */}
    <div className="relative h-[180px] overflow-hidden bg-card border border-border">
      {/* Overlapping cards */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={portalProgress}
          alt="Progress tracking"
          className="absolute w-[45%] max-w-[200px] h-[160px] object-cover object-top rounded shadow-m2 -rotate-3 -translate-x-[55%] translate-y-1 opacity-70"
          loading="lazy"
        />
        <img
          src={portalPrograms}
          alt="Training programs"
          className="absolute w-[50%] max-w-[220px] h-[170px] object-cover object-top rounded shadow-m2-hover z-10"
          loading="lazy"
        />
        <img
          src={portalChat}
          alt="Coach chat"
          className="absolute w-[45%] max-w-[200px] h-[160px] object-cover object-top rounded shadow-m2 rotate-3 translate-x-[55%] translate-y-1 opacity-70"
          loading="lazy"
        />
      </div>

      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-card to-transparent z-20" />

      {/* Peek label */}
      <div className="absolute bottom-2 inset-x-0 z-30 text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Your portal awaits
        </span>
      </div>
    </div>
  </motion.div>
);

export default PortalEntrance;
