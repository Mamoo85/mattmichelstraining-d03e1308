import { useMemo } from "react";
import { Activity, Target, CalendarCheck } from "lucide-react";

interface Log {
  id: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
}

interface LiftInsightsProps {
  logs: Log[];
  liftName: string;
}

const LiftInsights = ({ logs, liftName }: LiftInsightsProps) => {
  const insights = useMemo(() => {
    if (logs.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentLogs = logs.filter((l) => new Date(l.logged_at) >= thirtyDaysAgo);
    const volume = recentLogs.reduce((sum, l) => sum + l.weight * l.reps, 0);

    let best1RM = 0;
    logs.forEach((l) => {
      const e1rm = l.reps === 1 ? l.weight : l.weight * (36 / (37 - Math.min(l.reps, 36)));
      if (e1rm > best1RM) best1RM = e1rm;
    });

    const firstLog = new Date(logs[0].logged_at);
    const totalWeeks = Math.max(1, (now.getTime() - firstLog.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const avgPerWeek = logs.length / totalWeeks;
    const recentWeeks = Math.min(totalWeeks, 30 / 7);
    const expectedRecent = avgPerWeek * recentWeeks;
    const consistency = expectedRecent > 0 ? Math.min(100, Math.round((recentLogs.length / expectedRecent) * 100)) : 0;

    return { volume: Math.round(volume), best1RM: Math.round(best1RM), consistency };
  }, [logs]);

  if (!insights) return null;

  const cards = [
    {
      icon: <Activity size={16} />,
      label: "Volume (30d)",
      value: insights.volume >= 1000 ? `${(insights.volume / 1000).toFixed(1)}k` : `${insights.volume}`,
      unit: "lbs",
      accent: "cyan",
    },
    {
      icon: <Target size={16} />,
      label: "Est. 1RM",
      value: `${insights.best1RM}`,
      unit: "lbs",
      accent: "pink",
    },
    {
      icon: <CalendarCheck size={16} />,
      label: "Consistency",
      value: `${insights.consistency}`,
      unit: "%",
      accent: "orange",
    },
  ];

  const accentColors: Record<string, string> = {
    cyan: "hsl(var(--synth-cyan))",
    pink: "hsl(var(--synth-pink))",
    orange: "hsl(var(--synth-orange))",
  };

  const accentBorders: Record<string, string> = {
    cyan: "hsl(var(--synth-cyan) / 0.25)",
    pink: "hsl(var(--synth-pink) / 0.25)",
    orange: "hsl(var(--synth-orange) / 0.25)",
  };

  return (
    <div className="mt-4">
      <span
        className="text-sm font-mono font-bold uppercase tracking-widest mb-3 block"
        style={{ color: "hsl(var(--synth-pink))", textShadow: "0 0 10px hsl(300 100% 46% / 0.3)" }}
      >
        Lift Insights — {liftName}
      </span>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="p-4 rounded-lg"
            style={{
              background: "hsl(var(--synth-card))",
              border: `1px solid ${accentBorders[c.accent]}`,
              boxShadow: `0 0 20px -6px ${accentColors[c.accent]}30`,
            }}
          >
            <div className="flex items-center gap-2 mb-2" style={{ color: accentColors[c.accent] }}>
              {c.icon}
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
                {c.label}
              </span>
            </div>
            <span
              className="text-3xl font-mono font-bold"
              style={{ color: accentColors[c.accent], textShadow: `0 0 16px ${accentColors[c.accent]}30` }}
            >
              {c.value}
              <span className="text-sm text-muted-foreground"> {c.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiftInsights;
