import { motion } from "framer-motion";
import SectionHeader from "./SectionHeader";

const AboutPhilosophy = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
  >
    <SectionHeader title="To All the Parents of Young Athletes" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      <p className="text-sm text-foreground text-balance leading-relaxed">
        If your child is going to play college sports, this is the type of training they need to prepare their bodies.
        <span className="text-primary font-bold"> Anything else is wearing them out.</span> I will teach them, step-by-step,
        allowing their bodies to build the proper <span className="font-bold text-foreground">WORK CAPACITY</span> so they
        don't get hurt when they get to college — or worse, senior year.
      </p>
      <p className="text-sm text-foreground text-balance leading-relaxed">
        What many don't realize: they play <span className="font-semibold">way better</span> when they aren't dealing with any pain.
        I prioritize healthy joints and a healthy mind over numbers on a board. They all get strong, I promise.
        No need to rush; rushing actually makes it slower because it takes their bodies 72 hours minimum to really recover.
        More so nowadays because they sit in front of their phones all night and don't get enough sleep.
      </p>

      <div className="bg-primary/10 border border-primary/20 p-4">
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">The Deal</p>
        <p className="text-sm text-foreground font-semibold text-balance">
          Sleep is the #1 reason they get hurt. Bad or over-training is #2.
          So, let me train them, and you tell them to go to bed. Problem solved.
        </p>
      </div>

      <div className="bg-muted p-4">
        <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-2">Why Matt Is Different</p>
        <p className="text-sm text-muted-foreground text-balance leading-relaxed">
          Most trainers move up to older, higher-paying clients as they build their career.
          Matt never did. He's trained the same age group for over 20 years — middle school through college prep.
          That makes him a unicorn in this profession. One of the very few left who has dedicated their entire career
          to developing young athletes. It's not a science for him anymore — it's an art he lives and breathes.
        </p>
      </div>

      <p className="text-sm text-foreground text-balance leading-relaxed">
        His athletes don't just get strong. They go on to achieve things that
        <span className="text-primary font-semibold"> far exceed every expectation</span> —
        including Matt's own. 50+ college athletes. Zero injuries. Every single one of them trained the right way,
        at the right pace, with the right recovery.
      </p>

      <span className="text-[10px] font-mono text-primary block">— Matt Michels, M² Training</span>
    </div>
  </motion.div>
);

export default AboutPhilosophy;
