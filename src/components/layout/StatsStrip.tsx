import { useEffect, useRef, useState } from "react";

interface Stat {
  value: number;
  suffix?: string;
  label: string;
}

interface StatsStripProps {
  stats: Stat[];
  className?: string;
}

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1200;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="text-2xl md:text-3xl font-extrabold text-primary font-mono leading-none">
      {current}{suffix}
    </span>
  );
}

const StatsStrip = ({ stats, className = "" }: StatsStripProps) => (
  <div
    className={`glass-card flex items-center justify-center gap-8 md:gap-16 py-6 md:py-8 px-4 ${className}`}
    data-reveal
  >
    {stats.map((s) => (
      <div key={s.label} className="flex flex-col items-center gap-1">
        <AnimatedNumber target={s.value} suffix={s.suffix} />
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {s.label}
        </span>
      </div>
    ))}
  </div>
);

export default StatsStrip;
