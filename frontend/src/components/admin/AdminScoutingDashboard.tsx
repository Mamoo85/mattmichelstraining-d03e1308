import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, MapPin, BarChart2, Layers } from "lucide-react";

const STATUS_NEW = ["new", "New"];
const STATUS_CONTACTED = ["contacted", "Contacted", "emailed"];
const STATUS_REPLIED = ["replied", "Replied", "Responded"];
const STATUS_WON = ["won", "Won", "converted"];

function normalize(status: string): "new" | "contacted" | "replied" | "won" | "other" {
  if (STATUS_NEW.includes(status)) return "new";
  if (STATUS_CONTACTED.includes(status)) return "contacted";
  if (STATUS_REPLIED.includes(status)) return "replied";
  if (STATUS_WON.includes(status)) return "won";
  return "other";
}

export default function AdminScoutingDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-scouting-dashboard"],
    staleTime: 30000,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: leads, error } = await (supabase as any)
        .from("outreach_leads")
        .select("id, status, industry, city, lead_score, created_at");

      if (error) throw error;
      const rows: any[] = leads || [];

      // Funnel counts
      const funnel = { new: 0, contacted: 0, replied: 0, won: 0 };
      rows.forEach((r) => {
        const s = normalize(r.status || "");
        if (s !== "other") funnel[s]++;
      });

      // Conversion rates
      const replyRate = funnel.contacted > 0 ? Math.round((funnel.replied / funnel.contacted) * 100) : 0;
      const winRate = funnel.replied > 0 ? Math.round((funnel.won / funnel.replied) * 100) : 0;

      // Industry breakdown — top 10
      const industryMap: Record<string, number> = {};
      rows.forEach((r) => {
        const ind = r.industry || "Unknown";
        industryMap[ind] = (industryMap[ind] || 0) + 1;
      });
      const industries = Object.entries(industryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Geography — top 10 cities
      const cityMap: Record<string, number> = {};
      rows.forEach((r) => {
        const city = r.city || "Unknown";
        cityMap[city] = (cityMap[city] || 0) + 1;
      });
      const cities = Object.entries(cityMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Lead score histogram — buckets 0-20, 21-40, 41-60, 61-80, 81-100
      const buckets = [0, 0, 0, 0, 0];
      rows.forEach((r) => {
        const s = Number(r.lead_score) || 0;
        if (s <= 20) buckets[0]++;
        else if (s <= 40) buckets[1]++;
        else if (s <= 60) buckets[2]++;
        else if (s <= 80) buckets[3]++;
        else buckets[4]++;
      });

      return { funnel, replyRate, winRate, industries, cities, buckets, total: rows.length };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading scouting data…
      </div>
    );
  }

  const d = data!;
  const funnelStages = [
    { label: "New", count: d.funnel.new, color: "bg-blue-500" },
    { label: "Contacted", count: d.funnel.contacted, color: "bg-yellow-500" },
    { label: "Replied", count: d.funnel.replied, color: "bg-orange-500" },
    { label: "Won", count: d.funnel.won, color: "bg-green-500" },
  ];
  const funnelMax = Math.max(...funnelStages.map((s) => s.count), 1);

  const industryMax = d.industries.length > 0 ? d.industries[0][1] : 1;
  const bucketLabels = ["0–20", "21–40", "41–60", "61–80", "81–100"];
  const bucketMax = Math.max(...d.buckets, 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-[#e8621a]" />
        <span className="font-bold text-sm text-foreground">Scouting Dashboard</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{d.total.toLocaleString()} total leads</span>
      </div>

      {/* Row 1: Funnel + Conversion Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Funnel */}
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-2">
              <Layers className="w-3 h-3 text-[#e8621a]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Pipeline Funnel</span>
            </div>
            <div className="space-y-2">
              {funnelStages.map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground w-14 shrink-0">{stage.label}</span>
                  <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-sm transition-all`}
                      style={{ width: `${Math.round((stage.count / funnelMax) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-foreground w-8 text-right">{stage.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Stats */}
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="w-3 h-3 text-[#e8621a]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Conversion Rates</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#e8621a]">{d.replyRate}%</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Reply Rate</div>
                <div className="text-[8px] text-muted-foreground">(Replied / Contacted)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">{d.winRate}%</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Close Rate</div>
                <div className="text-[8px] text-muted-foreground">(Won / Replied)</div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border grid grid-cols-4 gap-1 text-center">
              {funnelStages.map((s) => (
                <div key={s.label}>
                  <div className={`text-xs font-bold ${s.color.replace("bg-", "text-")}`}>{s.count}</div>
                  <div className="text-[8px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Industry Breakdown + Geography */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Industry Breakdown */}
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-2">
              <BarChart2 className="w-3 h-3 text-[#e8621a]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Top Industries</span>
            </div>
            <div className="space-y-1.5">
              {d.industries.length === 0 && (
                <p className="text-[10px] text-muted-foreground">No data</p>
              )}
              {d.industries.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-[8px] text-muted-foreground w-3 shrink-0 text-right">{i + 1}</span>
                  <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#e8621a] rounded-sm transition-all"
                      style={{ width: `${Math.round((count / industryMax) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-foreground truncate max-w-[90px]" title={name}>{name}</span>
                  <span className="text-[9px] font-bold text-foreground w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Geography */}
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-2">
              <MapPin className="w-3 h-3 text-[#e8621a]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Top Cities</span>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground font-medium pb-1">#</th>
                    <th className="text-left text-muted-foreground font-medium pb-1">City</th>
                    <th className="text-right text-muted-foreground font-medium pb-1">Leads</th>
                    <th className="text-right text-muted-foreground font-medium pb-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cities.length === 0 && (
                    <tr><td colSpan={4} className="text-muted-foreground py-1">No data</td></tr>
                  )}
                  {d.cities.map(([city, count], i) => (
                    <tr key={city} className="border-b border-border/40 last:border-0">
                      <td className="py-0.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-0.5 text-foreground truncate max-w-[80px]" title={city}>{city}</td>
                      <td className="py-0.5 text-right font-bold text-foreground">{count}</td>
                      <td className="py-0.5 text-right text-muted-foreground">
                        {d.total > 0 ? Math.round((count / d.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Lead Quality Histogram */}
      <Card className="bg-card border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-1 mb-2">
            <Target className="w-3 h-3 text-[#e8621a]" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Lead Score Distribution</span>
          </div>
          <div className="flex items-end gap-2 h-20">
            {d.buckets.map((count, i) => {
              const pct = Math.round((count / bucketMax) * 100);
              const colors = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500"];
              return (
                <div key={bucketLabels[i]} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-foreground">{count}</span>
                  <div className="w-full flex items-end" style={{ height: "48px" }}>
                    <div
                      className={`w-full ${colors[i]} rounded-t-sm transition-all`}
                      style={{ height: `${pct}%`, minHeight: count > 0 ? "2px" : "0" }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground">{bucketLabels[i]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
