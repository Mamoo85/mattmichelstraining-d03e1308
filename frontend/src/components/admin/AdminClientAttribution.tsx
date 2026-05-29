import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp } from "lucide-react";

type UtmRow = {
  utm: Record<string, string> | null;
  event_type: string;
  created_at: string;
};

type AttributionGroup = {
  source: string;
  medium: string;
  campaign: string;
  total: number;
  signups: number;
};

function groupByUtm(rows: UtmRow[]): AttributionGroup[] {
  const map = new Map<string, AttributionGroup>();
  for (const row of rows) {
    const utm = row.utm ?? {};
    const source = utm.utm_source || "(direct)";
    const medium = utm.utm_medium || "(none)";
    const campaign = utm.utm_campaign || "(not set)";
    const key = `${source}||${medium}||${campaign}`;
    if (!map.has(key)) {
      map.set(key, { source, medium, campaign, total: 0, signups: 0 });
    }
    const group = map.get(key)!;
    group.total += 1;
    if (row.event_type === "trial_success") group.signups += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.signups - a.signups || b.total - a.total);
}

export default function AdminClientAttribution() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-utm-attribution", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_funnel_events" as any)
        .select("utm, event_type, created_at")
        .gte("created_at", since)
        .limit(2000);
      if (error) throw error;
      return (data as UtmRow[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const groups = data ? groupByUtm(data) : [];
  const totalSignups = groups.reduce((s, g) => s + g.signups, 0);
  const totalEvents = groups.reduce((s, g) => s + g.total, 0);
  const withUtm = data ? data.filter((r) => r.utm && Object.keys(r.utm).length > 0).length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          UTM Attribution — Last 30 Days
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Signups and events grouped by traffic source. Based on trial funnel data.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading attribution data…
        </div>
      )}

      {error && (
        <div className="text-red-400 text-xs p-4 border border-red-500/30 rounded bg-red-500/5">
          Error loading data: {(error as Error).message}
        </div>
      )}

      {!isLoading && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-xl font-black text-foreground mt-0.5">{totalEvents.toLocaleString()}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Trial Signups</p>
              <p className="text-xl font-black text-green-400 mt-0.5">{totalSignups}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">UTM-Tagged</p>
              <p className="text-xl font-black text-primary mt-0.5">{withUtm.toLocaleString()}</p>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-10">
              No attribution data yet. UTM params will appear here once users arrive via tracked links.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_60px_60px] gap-0 px-3 py-2 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>Source</span>
                <span>Medium</span>
                <span>Campaign</span>
                <span className="text-right">Events</span>
                <span className="text-right">Signups</span>
              </div>
              <div className="divide-y divide-border">
                {groups.map((g, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1fr_60px_60px] gap-0 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors"
                  >
                    <span className="font-medium text-foreground truncate pr-2">{g.source}</span>
                    <span className="text-muted-foreground truncate pr-2">{g.medium}</span>
                    <span className="text-muted-foreground truncate pr-2">{g.campaign}</span>
                    <span className="text-right text-foreground">{g.total}</span>
                    <span className={`text-right font-bold ${g.signups > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {g.signups}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Source: trial_funnel_events table. "Signups" = trial_success events. UTM params must be passed via the trial checkout flow to appear here.
          </p>
        </>
      )}
    </div>
  );
}
