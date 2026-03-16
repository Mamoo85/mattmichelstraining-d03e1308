import SectionHeader from "./SectionHeader";

const Newsletter = () => (
  <div>
    <SectionHeader title="Words from Matt" />
    <div className="bg-card shadow-m2 p-5">
      <p className="text-sm text-foreground text-balance leading-relaxed">
        "I understand the power of the central nervous system and physics. After 20+ years with the same age group,
        it's not a science for me anymore — it's an art I live and breathe. Old-school Russian mountain strength
        mixed with American power mixed with Eastern energies. It's hard, but it works. Every single time."
      </p>
      <span className="text-[10px] font-mono text-primary mt-3 block">— Matt Michels, M² Training</span>
    </div>
  </div>
);

export default Newsletter;
