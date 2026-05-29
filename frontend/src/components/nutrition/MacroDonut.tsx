import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface MacroDonutProps {
  protein: number;
  carbs: number;
  fat: number;
}

const COLORS = [
  "hsl(0, 72%, 51%)",   // protein red
  "hsl(38, 92%, 50%)",  // carbs amber
  "hsl(217, 91%, 60%)", // fat blue
];

const MacroDonut = ({ protein, carbs, fat }: MacroDonutProps) => {
  const data = useMemo(() => {
    const total = protein + carbs + fat;
    if (total === 0) return [];
    return [
      { name: "Protein", value: protein, pct: Math.round((protein / total) * 100) },
      { name: "Carbs", value: carbs, pct: Math.round((carbs / total) * 100) },
      { name: "Fat", value: fat, pct: Math.round((fat / total) * 100) },
    ];
  }, [protein, carbs, fat]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">
        No macros logged today
      </div>
    );
  }

  const total = protein + carbs + fat;

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 h-28 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={48}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-foreground">{Math.round(total)}g</span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold text-foreground">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MacroDonut;
