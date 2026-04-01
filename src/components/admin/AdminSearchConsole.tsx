import { memo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Search, TrendingUp, Eye, MousePointer, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface GscRow {
  page_url: string;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
}

const AdminSearchConsole = memo(() => {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<"total_clicks" | "total_impressions" | "avg_position">("total_clicks");

  const { data: rows = [], isLoading, refetch } = useQuery<GscRow[]>({
    queryKey: ["gsc-data"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("search_console_data")
        .select("page_url, clicks, impressions, ctr, position")
        .order("date", { ascending: false })
        .limit(5000);
      if (error) throw error;

      // Aggregate by page_url
      const map = new Map<string, { clicks: number; impressions: number; ctrSum: number; posSum: number; count: number }>();
      for (const r of data || []) {
        const key = r.page_url;
        const existing = map.get(key) || { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
        existing.clicks += r.clicks || 0;
        existing.impressions += r.impressions || 0;
        existing.ctrSum += Number(r.ctr) || 0;
        existing.posSum += Number(r.position) || 0;
        existing.count += 1;
        map.set(key, existing);
      }

      return Array.from(map.entries()).map(([url, d]) => ({
        page_url: url,
        total_clicks: d.clicks,
        total_impressions: d.impressions,
        avg_ctr: d.count > 0 ? d.ctrSum / d.count : 0,
        avg_position: d.count > 0 ? d.posSum / d.count : 0,
      }));
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("fetch-search-console", {
        body: { days: 28 },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data?.rows_synced || 0} rows from Search Console`);
      refetch();
    },
    onError: (e) => {
      toast.error(`Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    },
  });

  const filtered = rows
    .filter(r => !filter || r.page_url.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "avg_position") return a.avg_position - b.avg_position;
      return (b as any)[sortKey] - (a as any)[sortKey];
    });

  const totals = filtered.reduce(
    (acc, r) => ({ clicks: acc.clicks + r.total_clicks, impressions: acc.impressions + r.total_impressions }),
    { clicks: 0, impressions: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#e8621a]/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-[#e8621a]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Search Console</h2>
            <p className="text-sm text-slate-400">Track impressions & clicks from Google Search</p>
          </div>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          size="sm"
          className="bg-[#e8621a] hover:bg-[#d4551a] text-white"
        >
          {syncMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
          Sync GSC
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3 text-center">
            <MousePointer className="h-5 w-5 text-[#e8621a] mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{totals.clicks.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Total Clicks</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3 text-center">
            <Eye className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{totals.impressions.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Total Impressions</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{filtered.length}</div>
            <div className="text-xs text-slate-400">Pages Tracked</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + sort */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by URL..."
            className="pl-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-1">
          {(["total_clicks", "total_impressions", "avg_position"] as const).map(key => (
            <Button
              key={key}
              size="sm"
              variant={sortKey === key ? "default" : "ghost"}
              onClick={() => setSortKey(key)}
              className={sortKey === key ? "bg-[#e8621a] text-white" : "text-slate-400 hover:text-white"}
            >
              {key === "total_clicks" ? "Clicks" : key === "total_impressions" ? "Impressions" : "Position"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 py-12 text-center">
          <p className="text-slate-500 text-sm">No data yet. Click "Sync GSC" to pull data from Google Search Console.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-2.5 px-4 text-slate-400 font-medium">Page URL</th>
                <th className="text-right py-2.5 px-4 text-slate-400 font-medium">Clicks</th>
                <th className="text-right py-2.5 px-4 text-slate-400 font-medium">Impressions</th>
                <th className="text-right py-2.5 px-4 text-slate-400 font-medium">CTR</th>
                <th className="text-right py-2.5 px-4 text-slate-400 font-medium">Avg Pos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((row) => {
                const shortUrl = row.page_url.replace("https://www.mattmichelstraining.com", "").replace("https://mattmichelstraining.lovable.app", "") || "/";
                return (
                  <tr key={row.page_url} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 text-[#e8621a] font-mono text-xs truncate max-w-xs" title={row.page_url}>
                      {shortUrl}
                    </td>
                    <td className="py-2.5 px-4 text-right text-white font-semibold">{row.total_clicks.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">{row.total_impressions.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{(row.avg_ctr * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{row.avg_position.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

AdminSearchConsole.displayName = "AdminSearchConsole";
export default AdminSearchConsole;
