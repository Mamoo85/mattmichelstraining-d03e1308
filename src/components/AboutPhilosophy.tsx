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
        What many don't realize: they play way better when they aren't dealing with any pain.
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

      <span className="text-[10px] font-mono text-primary block">— Matt Michels, M² Training</span>
    </div>
  </motion.div>
);

export default AboutPhilosophy;
