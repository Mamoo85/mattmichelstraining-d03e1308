import SectionHeader from "./SectionHeader";

const newsletters = [
  {
    title: "THE REAL DEAL: Why Your Squat Plateau Is a Programming Problem",
    date: "2026-03-14",
    excerpt: "Most lifters blame genetics. The data says otherwise. Here's what 200+ athlete logs reveal about breaking through sticking points.",
  },
  {
    title: "THE REAL DEAL: RPE vs Percentage — When to Use What",
    date: "2026-03-07",
    excerpt: "Autoregulation has its place. So does fixed loading. The answer isn't one or the other — it's knowing when to switch.",
  },
  {
    title: "THE REAL DEAL: The 3 Bench Press Cues That Actually Matter",
    date: "2026-02-28",
    excerpt: "Forget 'leg drive' cues that make no sense. Here are the mechanical principles that transfer to competition.",
  },
];

const Newsletter = () => (
  <div>
    <SectionHeader title="The Real Deal — Newsletter" timestamp="Published weekly" />

    <div className="space-y-3">
      {newsletters.map((item, i) => (
        <div key={i} className="bg-m2-surface shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 cursor-pointer group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-m2">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 text-balance">{item.excerpt}</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{item.date}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Newsletter;
