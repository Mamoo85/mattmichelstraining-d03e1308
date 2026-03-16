import SectionHeader from "./SectionHeader";

const Newsletter = () => (
  <div>
    <SectionHeader title="Words from Matt" />
    <div className="bg-card shadow-m2 p-5">
      <p className="text-sm text-foreground text-balance leading-relaxed">
        "Most people don't need a new program. They need someone to look at what they're doing 
        and fix the three things that are holding them back. That's what I do. I've been doing it 
        for over twenty years. If you're stuck, reach out. I'll tell you what's wrong and how to fix it."
      </p>
      <span className="text-[10px] font-mono text-primary mt-3 block">— Matt Michels, M² Training</span>
    </div>
  </div>
);

export default Newsletter;
