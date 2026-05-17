import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface Listing {
  id: string;
  printify_id: string;
  etsy_listing_id: number | null;
  niche: string;
  product_name: string;
  product_type: string;
  title: string | null;
  retail_price_cents: number | null;
  published_at: string;
  last_synced_at: string | null;
}

interface Perf {
  niche: string;
  listings: number;
  total_views: number;
  total_favorites: number;
  total_sales: number;
  total_revenue_cents: number;
  conversion_pct: number;
}

interface StatRow {
  listing_id: string;
  views: number;
  num_favorers: number;
  sales_count: number;
  revenue_cents: number;
}

const fmt$ = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function PodDashboard() {
  const [perf, setPerf] = useState<Perf[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: l }, { data: s }] = await Promise.all([
      (supabase as any).from("pod_niche_performance").select("*").order("total_sales", { ascending: false }),
      (supabase as any).from("pod_listings").select("*").order("published_at", { ascending: false }).limit(200),
      (supabase as any).from("pod_listing_stats").select("listing_id,views,num_favorers,sales_count,revenue_cents,snapshot_date").order("snapshot_date", { ascending: false }).limit(500),
    ]);
    setPerf(p ?? []);
    setListings(l ?? []);
    const latest: Record<string, StatRow> = {};
    for (const r of s ?? []) if (!latest[r.listing_id]) latest[r.listing_id] = r;
    setStats(latest);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function invoke(name: string, body: any = {}) {
    setActing(name);
    const { data, error } = await supabase.functions.invoke(name, { body });
    setActing(null);
    if (error) {
      toast({ title: `${name} failed`, description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${name} ok`, description: JSON.stringify(data).slice(0, 200) });
      load();
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POD Sales Performance</h1>
          <p className="text-sm text-muted-foreground">Etsy listings, niche winners, and auto-reprint triggers.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => invoke("etsy-sales-sync")} disabled={acting !== null}>Sync stats now</Button>
          <Button onClick={() => invoke("etsy-winner-prioritizer")} disabled={acting !== null} variant="secondary">Reprint winner</Button>
          <Button onClick={() => invoke("etsy-trend-scanner")} disabled={acting !== null} variant="outline">New niche scan</Button>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-2">Niche performance</h2>
        <Card className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niche</TableHead>
                <TableHead className="text-right">Listings</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Favorites</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Conv %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>}
              {!loading && perf.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No data yet. Run a sales sync.</TableCell></TableRow>}
              {perf.map((p) => {
                const isWinner = p.total_sales > 0 || p.total_views > 100;
                return (
                  <TableRow key={p.niche}>
                    <TableCell className="font-medium">
                      {p.niche} {isWinner && <Badge className="ml-2" variant="default">winner</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{p.listings}</TableCell>
                    <TableCell className="text-right">{p.total_views}</TableCell>
                    <TableCell className="text-right">{p.total_favorites}</TableCell>
                    <TableCell className="text-right">{p.total_sales}</TableCell>
                    <TableCell className="text-right">{fmt$(p.total_revenue_cents)}</TableCell>
                    <TableCell className="text-right">{p.conversion_pct}%</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" disabled={acting !== null}
                        onClick={() => invoke("etsy-winner-prioritizer", { niche: p.niche, count: 5 })}>
                        Reprint 5
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Listings ({listings.length})</h2>
        <Card className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Fav</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Rev</TableHead>
                <TableHead>Etsy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((l) => {
                const s = stats[l.id];
                return (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-xs truncate" title={l.title || l.product_name}>{l.title || l.product_name}</TableCell>
                    <TableCell>{l.niche}</TableCell>
                    <TableCell>{l.product_type}</TableCell>
                    <TableCell className="text-right">{s?.views ?? "—"}</TableCell>
                    <TableCell className="text-right">{s?.num_favorers ?? "—"}</TableCell>
                    <TableCell className="text-right">{s?.sales_count ?? "—"}</TableCell>
                    <TableCell className="text-right">{s ? fmt$(s.revenue_cents) : "—"}</TableCell>
                    <TableCell>
                      {l.etsy_listing_id
                        ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://www.etsy.com/listing/${l.etsy_listing_id}`}>open</a>
                        : <span className="text-muted-foreground">unlinked</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
