import { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3;
  className?: string;
}

const FeatureGrid = ({ features, columns = 3, className = "" }: FeatureGridProps) => (
  <div
    className={`grid gap-4 md:gap-6 ${
      columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"
    } ${className}`}
  >
    {features.map((f, i) => (
      <div
        key={f.title}
        className="glass-card group p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(232,98,26,0.08)]"
        data-reveal
        style={{ transitionDelay: `${i * 60}ms` }}
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
          <f.icon size={20} className="text-primary" />
        </div>
        <h3 className="font-display text-base font-bold text-foreground mb-2">
          {f.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {f.description}
        </p>
      </div>
    ))}
  </div>
);

export default FeatureGrid;
