import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  className?: string;
}

const EmptyStateCard = ({
  icon,
  title,
  description,
  ctaLabel,
  ctaTo,
  className,
}: EmptyStateCardProps) => (
  <div
    className={cn(
      "relative bg-card border-2 border-primary/20 p-8 sm:p-10 text-center overflow-hidden",
      className
    )}
  >
    {/* Decorative corner accents */}
    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/40" />
    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/40" />
    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/40" />

    {/* Icon */}
    <div className="w-16 h-16 mx-auto mb-5 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-sm">
      {icon || <Dumbbell size={28} className="text-primary" />}
    </div>

    {/* Heading */}
    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground mb-2">
      {title}
    </h3>

    {/* Description */}
    <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-6">
      {description}
    </p>

    {/* Pulsing CTA */}
    <Link
      to={ctaTo}
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all animate-pulse hover:animate-none"
    >
      {ctaLabel}
    </Link>

    {/* Subtle tagline */}
    <p className="text-[10px] text-muted-foreground/60 mt-4 uppercase tracking-widest">
      Real training. Real results.
    </p>
  </div>
);

export default EmptyStateCard;
