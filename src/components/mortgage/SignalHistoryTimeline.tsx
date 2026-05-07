import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type RawSignal = {
  type?: string;
  signal_type?: string;
  source?: string;
  date?: string;
  signal_date?: string;
  score?: number;
};

interface Props {
  history: RawSignal[];
}

const SIGNAL_COLORS: Record<string, string> = {
  fsbo: "#00d4ff",
  divorce: "#f97316",
  probate: "#a855f7",
  rate_trigger: "#22c55e",
  permit: "#facc15",
  foreclosure: "#ef4444",
  estate_sale: "#f472b6",
  default: "#64748b",
};

function colorFor(type: string): string {
  const key = Object.keys(SIGNAL_COLORS).find((k) => type.toLowerCase().includes(k));
  return key ? SIGNAL_COLORS[key] : SIGNAL_COLORS.default;
}

function formatDate(d?: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d.toString().slice(0, 10);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SignalHistoryTimeline({ history }: Props) {
  const sorted = useMemo(() => {
    return [...history]
      .map((h) => ({
        type: (h.type || h.signal_type || "signal") as string,
        source: h.source || "",
        date: (h.date || h.signal_date || "") as string,
        score: typeof h.score === "number" ? h.score : 5,
      }))
      .filter((h) => h.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  if (sorted.length === 0) return null;

  const chartData = sorted.map((s, i) => ({
    idx: i,
    label: formatDate(s.date),
    score: s.score,
    type: s.type,
    source: s.source,
    color: colorFor(s.type),
  }));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest text-[#00d4ff]">
          Signal history ({sorted.length})
        </p>
        <p className="text-[10px] text-[#64748b]">
          {formatDate(sorted[0].date)} → {formatDate(sorted[sorted.length - 1].date)}
        </p>
      </div>

      {/* Mini bar chart */}
      <div className="h-20 bg-[#0a1628] rounded border border-[#1e3a5f]/60 p-1 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 10]} />
            <Tooltip
              cursor={{ fill: "rgba(0,212,255,0.08)" }}
              contentStyle={{ background: "#030711", border: "1px solid #1e3a5f", borderRadius: 4, fontSize: 11, padding: "4px 8px" }}
              labelStyle={{ color: "#94a3b8", fontSize: 10 }}
              formatter={(_v: any, _n: any, p: any) => [
                `${p.payload.type.replace(/_/g, " ")} · score ${p.payload.score}`,
                p.payload.source || "signal",
              ]}
            />
            <Bar dataKey="score" radius={[2, 2, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compact timeline pills */}
      <ol className="relative border-l border-[#1e3a5f] pl-3 space-y-1.5 max-h-40 overflow-y-auto">
        {sorted.slice(-8).reverse().map((s, i) => (
          <li key={i} className="relative">
            <span
              className="absolute -left-[15px] top-1.5 w-2 h-2 rounded-full ring-2 ring-[#0a1628]"
              style={{ background: colorFor(s.type) }}
            />
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-[#cbd5e1] truncate">
                {s.type.replace(/_/g, " ")}
                {s.source && <span className="text-[#64748b]"> · {s.source}</span>}
              </span>
              <span className="shrink-0 text-[#64748b]">{formatDate(s.date)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
