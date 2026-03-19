import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { TrendingUp, Calendar, Zap } from "lucide-react";

interface NutritionLog {
  logged_at: string;
  total_calories: number;
}

interface NutritionStatsProps {
  logs: NutritionLog[];
}

const NutritionStats = ({ logs }: NutritionStatsProps) => {
  const stats = useMemo(() => {
    // Streak: consecutive days with at least 1 log
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const dayKey = format(subDays(new Date(), i), "yyyy-MM-dd");
      const hasLog = logs.some((l) => l.logged_at?.startsWith(dayKey));
      if (hasLog) streak++;
      else break;
    }

    // 7-day average calories
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentLogs = logs.filter((l) => new Date(l.logged_at) >= sevenDaysAgo);
    const avgCal = recentLogs.length > 0
      ? Math.round(recentLogs.reduce((s, l) => s + (l.total_calories || 0), 0) / 7)
      : 0;

    // Total meals logged
    const totalMeals = logs.length;

    return { streak, avgCal, totalMeals };
  }, [logs]);

  const items = [
    { icon: Zap, label: "Streak", value: `${stats.streak}d`, color: "text-amber-500" },
    { icon: TrendingUp, label: "7d Avg", value: `${stats.avgCal}`, color: "text-orange-500" },
    { icon: Calendar, label: "Meals", value: `${stats.totalMeals}`, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="flex flex-col items-center rounded-xl bg-muted/50 py-2.5 px-2">
          <Icon size={14} className={`${color} mb-1`} />
          <span className="text-base font-bold text-foreground">{value}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
      ))}
    </div>
  );
};

export default NutritionStats;
