import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  clientId?: string;
}

/**
 * Batch 4 DR-16/17/19/20 — Trend chart, AI brief, expiry note, vertical pivot link.
 */
export const DemandRadarBatch4 = ({ clientId }: Props) => {
  const [brief, setBrief] = useState<string>("");
  const [trend, setTrend] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadBrief();
    void loadTrend();
  }, []);

  const loadBrief = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("demand-radar-summarizer", { body: { client_id: clientId } });
      setBrief((data as any)?.brief || "");
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async () => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data } = await supabase
      .from("growth_radar_signals" as any)
      .select("detected_at")
      .gte("detected_at", since);

    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toLocaleDateString(undefined, { weekday: "short" });
      buckets[key] = 0;
    }
    ((data as any[]) || []).forEach((s) => {
      const key = new Date(s.detected_at).toLocaleDateString(undefined, { weekday: "short" });
      if (key in buckets) buckets[key]++;
    });
    setTrend(Object.entries(buckets).map(([day, count]) => ({ day, count })));
  };

  return (
    <div className="space-y-4">
      {/* AI Brief */}
      <Card className="p-5 bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Today's AI Brief</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={loadBrief} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {loading && !brief ? (
          <p className="text-xs text-muted-foreground">Generating brief…</p>
        ) : (
          <div className="text-sm whitespace-pre-line text-foreground/90 leading-relaxed">{brief || "No brief yet — click refresh."}</div>
        )}
      </Card>

      {/* Trend chart */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">7-Day Signal Volume</h3>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Signal expiry note */}
      <Card className="p-4 bg-muted/10 border-dashed">
        <p className="text-xs text-muted-foreground">
          📅 Signals auto-archive after 30 days to keep your feed sharp. Want a different industry? <a href="mailto:matt@detroitwebagent.com" className="text-primary hover:underline">Email Matt to pivot verticals</a>.
        </p>
      </Card>
    </div>
  );
};
