import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Testimonial {
  quote: string;
  name: string;
  trade: string;
  initials: string;
}

interface WallOfLoveProps {
  testimonials: Testimonial[];
  accentColor?: string;
  theme?: "dark" | "light";
  title?: string;
}

export default function WallOfLove({
  testimonials,
  accentColor = "#e8621a",
  theme = "light",
  title = "What DWA Partners Say",
}: WallOfLoveProps) {
  const isDark = theme === "dark";

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className={`text-xl font-black text-center mb-2 uppercase tracking-tight ${isDark ? "text-white" : "text-foreground"}`}>
          {title}
        </h2>
        <p className={`text-center text-sm mb-10 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
          Verified results from active DWA partners
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <Card
              key={i}
              style={{ borderColor: `${accentColor}33` }}
              className={isDark ? "bg-[#0d2137] border" : "bg-card border"}
            >
              <CardContent className="p-5">
                <div className="text-[#f59e0b] text-base mb-3 tracking-wider">★★★★★</div>
                <blockquote className={`text-sm font-semibold italic leading-relaxed mb-4 ${isDark ? "text-white" : "text-foreground"}`}>
                  "{t.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-foreground"}`}>{t.name}</p>
                    <p className={`text-[11px] truncate ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>{t.trade}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] whitespace-nowrap flex-shrink-0"
                    style={{ color: accentColor, borderColor: `${accentColor}66` }}
                  >
                    ✓ Verified
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
