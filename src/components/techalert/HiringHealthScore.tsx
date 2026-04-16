import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Activity, UserCheck, Users, Eye, Phone, CalendarCheck, CheckCircle2 } from "lucide-react";

interface HiringHealthScoreProps {
  token: string;
}

interface PipelineStats {
  alerted: number;
  viewed: number;
  contacted: number;
  interviewed: number;
  hired: number;
  total_revenue: number;
  health_score: number;
  engagement_rate: number;
  contact_rate: number;
  hire_rate: number;
}

export default function HiringHealthScore({ token }: HiringHealthScoreProps) {
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const { data } = useQuery<PipelineStats | null>({
    queryKey: ["hiring-health-score", token],
    queryFn: async () => {
      const res = await fetch(
        `${baseUrl}/get-hiring-health-score?token=${token}`,
        { headers: { apikey } }
      );
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });

  if (!data) return null;

  const scoreColor = data.health_score >= 80 ? "#10b981" : data.health_score >= 50 ? "#f59e0b" : "#ef4444";
  const scoreLabel = data.health_score >= 80 ? "Excellent" : data.health_score >= 60 ? "Strong" : data.health_score >= 40 ? "Needs Attention" : "Critical";

  const funnelStages = [
    { label: "Alerted", count: data.alerted, icon: Users, color: "text-[#00d4ff]", bg: "bg-[#00d4ff]/10" },
    { label: "Viewed", count: data.viewed, icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Contacted", count: data.contacted, icon: Phone, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Interviewed", count: data.interviewed, icon: CalendarCheck, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Hired", count: data.hired, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  const maxCount = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      {/* Health Score Card */}
      <div className="rounded-xl border border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-[#00d4ff]" />
          <h3 className="text-white font-bold text-xs uppercase tracking-wider">Hiring Health Score</h3>
          <span className="text-[10px] text-slate-500 ml-auto">90-day rolling</span>
        </div>

        <div className="flex items-center gap-6">
          {/* Score circle */}
          <div className="relative shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeDasharray={`${(data.health_score / 100) * 264} 264`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dasharray 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black" style={{ color: scoreColor }}>{data.health_score}</span>
              <span className="text-[10px] text-slate-500">/100</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Engagement</span>
              <span className="text-xs font-bold text-white">{Math.round(data.engagement_rate)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-[#00d4ff]" style={{ width: `${Math.min(data.engagement_rate, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Contact Rate</span>
              <span className="text-xs font-bold text-white">{Math.round(data.contact_rate)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(data.contact_rate, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Hire Conversion</span>
              <span className="text-xs font-bold text-white">{Math.round(data.hire_rate)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(data.hire_rate, 100)}%` }} />
            </div>
          </div>
        </div>

        <p className="text-center mt-3 text-xs font-semibold" style={{ color: scoreColor }}>{scoreLabel}</p>
      </div>

      {/* Pipeline Funnel */}
      <div className="rounded-xl border border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[#00d4ff]" />
          <h3 className="text-white font-bold text-xs uppercase tracking-wider">Pipeline Funnel</h3>
          <span className="text-[10px] text-slate-500 ml-auto">90 days</span>
        </div>

        <div className="space-y-2">
          {funnelStages.map((stage) => {
            const Icon = stage.icon;
            const barWidth = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg ${stage.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${stage.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 font-medium">{stage.label}</span>
                    <span className={`text-sm font-black ${stage.color}`}>{stage.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.bg.replace("/10", "/40")}`}
                      style={{ width: `${barWidth}%`, transition: "width 0.6s ease" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ROI callout */}
        {data.total_revenue > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
            <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-1">Estimated Revenue from Hires</p>
            <p className="text-2xl font-black text-emerald-400">${data.total_revenue.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-400/60 mt-1">
              TechAlert cost: ~$447 → <strong>{Math.round(data.total_revenue / 447)}x ROI</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
