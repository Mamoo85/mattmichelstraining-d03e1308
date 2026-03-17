import { motion } from "framer-motion";
import { Heart, Gamepad2, GraduationCap, Users, ShieldOff } from "lucide-react";
import SectionHeader from "../SectionHeader";

const STORY_BEATS = [
  {
    icon: GraduationCap,
    title: "The Pivot",
    text: "Matt studied computer engineering at Wayne State University. An internship in software programming quickly revealed that the cubicle life wasn't for him. He found himself drawn to personal training — realizing his unique ability to connect with, motivate, and mentor others.",
  },
  {
    icon: Heart,
    title: "The Motivation",
    text: "When Matt's father passed, it reshaped his perspective in profound ways. \"After the first six months, his loss began to be my motivation. I just wanted to make him proud.\" That drive propelled Matt to build M2 Training from nothing — entirely by word of mouth.",
  },
  {
    icon: Gamepad2,
    title: "The Competitor",
    text: "Before esports went mainstream, Matt was a professional gamer competing in world championships. He's also a history buff with deep knowledge of WWII battles and generals. That competitive edge and strategic mind carry into every program he designs.",
  },
  {
    icon: Users,
    title: "The Family",
    text: "When asked what he's most proud of, Matt doesn't mention championships or accolades. His first thought is his wife Janelle and their young son Harrison. \"My family and the M2 family I've built over the years are the most significant parts of my life.\"",
  },
];

const MattsStory = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader
      title="The Man Behind M²"
      timestamp="Born & raised in Grosse Pointe"
    />

    <div className="bg-card shadow-m2 p-5 md:p-6 mb-3 border-l-4 border-primary">
      <p className="text-sm md:text-base italic text-muted-foreground leading-relaxed">
        "If you're going through hell, keep going."
      </p>
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary mt-2 block">
        Winston Churchill — Matt's life motto
      </span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {STORY_BEATS.map((beat) => (
        <div key={beat.title} className="bg-card shadow-m2 p-4">
          <div className="flex items-center gap-2 mb-2">
            <beat.icon size={16} className="text-primary flex-shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {beat.title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {beat.text}
          </p>
        </div>
      ))}
    </div>
  </motion.div>
);

export default MattsStory;
