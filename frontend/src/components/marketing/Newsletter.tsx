import SectionHeader from "@/components/shared/SectionHeader";

const Newsletter = () => (
  <div>
    <SectionHeader title="From Matt's Desk" timestamp="Preparing for College Sports? Read this first." />
    <div className="bg-card shadow-m2 p-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">To the parents of our young athletes:</p>
      <p className="text-sm text-foreground text-balance leading-relaxed">
        Is your child training to prepare, or are they just training to get worn out?
        If they want to play at the next level, they need to perform without pain.
      </p>
      <p className="text-sm text-foreground text-balance leading-relaxed">
        I prioritize longevity and healthy joints over a leaderboard. My program builds
        <span className="font-bold"> WORK CAPACITY</span> so they don't get sidelined by injuries
        in high school or college. But there's a catch: they need 72 hours to recover,
        and they need to stay off their phones at night.
      </p>
      <div className="bg-muted p-3 space-y-1">
        <p className="text-xs text-foreground"><span className="text-primary font-bold">The Goal:</span> Strong bodies, healthy minds, and zero pain.</p>
        <p className="text-xs text-foreground"><span className="text-primary font-bold">The Strategy:</span> I'll train them; you get them to bed.</p>
      </div>
      <span className="text-[10px] font-mono text-primary block">Stay strong, Matt | M2 Training</span>
    </div>
  </div>
);

export default Newsletter;
