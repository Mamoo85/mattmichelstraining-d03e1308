import { motion } from "framer-motion";
import { Video, Calendar, Trophy, Users } from "lucide-react";
import SectionHeader from "../SectionHeader";

const SERVICES = [
  {
    tag: "REMOTE · $20",
    title: "Form Check",
    desc: "Send a video. Get cues back.",
    icon: Video,
  },
  {
    tag: "MONTHLY · $100+",
    title: "Online Coaching",
    desc: "Programming + weekly check-ins.",
    icon: Calendar,
  },
  {
    tag: "12–16 WEEKS",
    title: "Meet Prep",
    desc: "Peak for your competition.",
    icon: Trophy,
  },
  {
    tag: "TRAINERS ONLY",
    title: "Mentorship",
    desc: "Programming, coaching, business.",
    icon: Users,
  },
];

const OnlineServices = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Work with Matt Online" timestamp="No commute. No gym required." />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {SERVICES.map((s) => (
        <a
          key={s.title}
          href="mailto:matthewmichels4@gmail.com?subject=Inquiry%20-%20Online%20Services"
          className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group block"
        >
          <s.icon size={18} className="text-primary mb-2" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">{s.tag}</span>
          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 mb-1">{s.title}</h3>
          <p className="text-[11px] text-muted-foreground">{s.desc}</p>
        </a>
      ))}
    </div>
  </motion.div>
);

export default OnlineServices;
