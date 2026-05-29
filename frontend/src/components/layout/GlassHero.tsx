import { ReactNode } from "react";

interface GlassHeroProps {
  badge?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Extra classes on the outer section */
  className?: string;
}

const GlassHero = ({ badge, title, subtitle, children, className = "" }: GlassHeroProps) => (
  <section
    className={`relative overflow-hidden py-16 md:py-24 ${className}`}
    data-reveal
  >
    {/* Gradient wash */}
    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

    <div className="container relative z-10 text-center max-w-3xl mx-auto">
      {badge && (
        <span className="inline-block mb-4 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full bg-primary/10 text-primary border border-primary/20">
          {badge}
        </span>
      )}

      <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground mb-4">
        {title}
      </h1>

      {subtitle && (
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
          {subtitle}
        </p>
      )}

      {children}
    </div>
  </section>
);

export default GlassHero;
