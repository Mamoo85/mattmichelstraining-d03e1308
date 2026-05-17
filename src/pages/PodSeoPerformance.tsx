import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Minus, RefreshCw, TrendingUp, Search } from "lucide-react";

interface Listing {
  id: string;
  etsy_listing_id: number | null;
  niche: string;
  product_name: string;
  product_type: string;
  title: string | null;
  tags: string[] | null;
  retail_price_cents: number | null;
  published_at: string;
  seo_optimized_at: string | null;
  seo_baseline: {
    views?: number;
    favorites?: number;
    sales?: number;
    revenue_cents?: number;
    captured_at?: string;
  } | null;
}

interface StatRow {
  listing_id: string;
  views: number;
  num_favorers: number;
  sales_count: number;
  revenue_cents: number;
  snapshot_date: string;
}

interface Row extends Listing {
  views: number;
  favorites: number;
  sales: number;
  revenue_cents: number;
  baseViews: number;
  baseFavs: number;
  baseSales: number;
  baseRev: number;
  dViews: number;
  dFavs: number;
  dSales: number;
  dRev: number;
  pctViews: number | null;
  pctFavs: number | null;
  pctSales: number | null;
  conv: number;
  baseConv: number;
  daysSince: number;
}

const fmt$ = (c: number) => `$${(c / 100).toFixed(2)}`;
const pct = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;

function lift(curr: number, base: number): number | null {
  if (base === 0) return curr === 0 ? 0 : null; // null = "new" (no baseline)
  return ((curr - base) / base) * 100;
}

function DeltaCell({ delta, percent }: { delta: number; percent: number | null }) {
  const pos = delta > 0;
  const neg = delta < 0;
  const Icon = pos ? ArrowUp : neg ? ArrowDown : Minus;
  const color = pos ? "text-emerald-500" : neg ? "text-red-500" : "text-muted-foreground";
  return (
    <div className={`flex items-center justify-end gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      <span className="font-semibold tabular-nums">{delta > 0 ? `+${delta}` : delta}</span>
      <span className="text-xs opacity-70 ml-1">({pct(percent)})</span>
    </div>
  );
}

export default function PodSeoPerformance() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [latest, setLatest] = useState<Record<string, StatRow>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof Row>("pctViews");

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: s }] = await Promise.all([
      (supabase as any)
        .from("pod_listings")
        .select("id,etsy_listing_id,niche,product_name,product_type,title,tags,retail_price_cents,published_at,seo_optimized_at,seo_baseline")
        .order("published_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("pod_listing_stats")
        .select("listing_id,views,num_favorers,sales_count,revenue_cents,snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(2000),
    ]);
    setListings(l ?? []);
    const map: Record<string, StatRow> = {};
    for (const r of s ?? []) if (!map[r.listing_id]) map[r.listing_id] = r;
    setLatest(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true);
    const { error } = await supabase.functions.invoke("etsy-sales-sync", { body: {} });
    setSyncing(false);
    if (error) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stats synced" });
      load();
    }
  }

  const rows: Row[] = useMemo(() => {
    return listings.map((l) => {
      const s = latest[l.id];
      const views = s?.views ?? 0;
      const favorites = s?.num_favorers ?? 0;
      const sales = s?.sales_count ?? 0;
      const revenue_cents = s?.revenue_cents ?? 0;
      const baseViews = l.seo_baseline?.views ?? 0;
      const baseFavs = l.seo_baseline?.favorites ?? 0;
      const baseSales = l.seo_baseline?.sales ?? 0;
      const baseRev = l.seo_baseline?.revenue_cents ?? 0;
      const optAt = l.seo_optimized_at ? new Date(l.seo_optimized_at).getTime() : Date.now();
      const daysSince = Math.max(0, Math.floor((Date.now() - optAt) / 86400000));
      return {
        ...l,
        views, favorites, sales, revenue_cents,
        baseViews, baseFavs, baseSales, baseRev,
        dViews: views - baseViews,
        dFavs: favorites - baseFavs,
        dSales: sales - baseSales,
        dRev: revenue_cents - baseRev,
        pctViews: lift(views, baseViews),
        pctFavs: lift(favorites, baseFavs),
        pctSales: lift(sales, baseSales),
        conv: views > 0 ? (sales / views) * 100 : 0,
        baseConv: baseViews > 0 ? (baseSales / baseViews) * 100 : 0,
        daysSince,
      };
    });
  }, [listings, latest]);

  const filtered = useMemo(() => {
    const f = rows.filter(
      (r) =>
        !filter ||
        r.title?.toLowerCase().includes(filter.toLowerCase()) ||
        r.niche.toLowerCase().includes(filter.toLowerCase()) ||
        r.product_name.toLowerCase().includes(filter.toLowerCase()),
    );
    return [...f].sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as number;
      const bv = (b[sortKey] ?? -Infinity) as number;
      return bv - av;
    });
  }, [rows, filter, sortKey]);

  const winners = filtered.filter((r) => (r.pctViews ?? -1) > 20).slice(0, 5);
  const stuck = filtered.filter((r) => r.views > 0 && (r.pctViews ?? 0) < 5).slice(0, 5);

  const totals = filtered.reduce(
    (acc, r) => ({
      views: acc.views + r.views,
      baseViews: acc.baseViews + r.baseViews,
      favs: acc.favs + r.favorites,
      baseFavs: acc.baseFavs + r.baseFavs,
      sales: acc.sales + r.sales,
      baseSales: acc.baseSales + r.baseSales,
      rev: acc.rev + r.revenue_cents,
      baseRev: acc.baseRev + r.baseRev,
    }),
    { views: 0, baseViews: 0, favs: 0, baseFavs: 0, sales: 0, baseSales: 0, rev: 0, baseRev: 0 },
  );

  const totalsLiftViews = lift(totals.views, totals.baseViews);
  const totalsLiftFavs = lift(totals.favs, totals.baseFavs);
  const totalsLiftSales = lift(totals.sales, totals.baseSales);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Etsy SEO Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Tracks each optimized listing's search lift vs. its pre-optimization baseline.
          </p>
        </div>
        <Button onClick={sync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          Sync Etsy stats
        </Button>
      </header>

      {/* Topline cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total views", curr: totals.views, base: totals.baseViews, lift: totalsLiftViews },
          { label: "Favorites", curr: totals.favs, base: totals.baseFavs, lift: totalsLiftFavs },
          { label: "Sales", curr: totals.sales, base: totals.baseSales, lift: totalsLiftSales },
          {
            label: "Revenue",
            curr: totals.rev,
            base: totals.baseRev,
            lift: lift(totals.rev, totals.baseRev),
            money: true,
          },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold mt-1 tabular-nums">
              {c.money ? fmt$(c.curr) : c.curr.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              baseline {c.money ? fmt$(c.base) : c.base.toLocaleString()}
              <span
                className={`ml-2 font-semibold ${
                  (c.lift ?? 0) > 0 ? "text-emerald-500" : (c.lift ?? 0) < 0 ? "text-red-500" : ""
                }`}
              >
                {pct(c.lift)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Winners + Stuck */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Badge className="bg-emerald-500">↑ Winners</Badge>
            <span className="text-sm text-muted-foreground">+20% view lift since SEO</span>
          </h2>
          {winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No winners yet — sync stats after Etsy's next crawl.</p>
          ) : (
            <ul className="space-y-2">
              {winners.map((w) => (
                <li key={w.id} className="flex justify-between text-sm">
                  <span className="truncate max-w-[60%]" title={w.title || w.product_name}>
                    {w.title || w.product_name}
                  </span>
                  <span className="text-emerald-500 font-semibold">{pct(w.pctViews)} views</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Badge variant="secondary">⚠ Needs attention</Badge>
            <span className="text-sm text-muted-foreground">&lt;5% lift — consider re-optimizing</span>
          </h2>
          {stuck.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged.</p>
          ) : (
            <ul className="space-y-2">
              {stuck.map((w) => (
                <li key={w.id} className="flex justify-between text-sm">
                  <span className="truncate max-w-[60%]" title={w.title || w.product_name}>
                    {w.title || w.product_name}
                  </span>
                  <span className="text-muted-foreground">{pct(w.pctViews)} views</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Filter + sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by title, niche, product…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        {(["pctViews", "pctFavs", "pctSales", "dRev"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={sortKey === k ? "default" : "outline"}
            onClick={() => setSortKey(k)}
          >
            Sort: {k === "pctViews" ? "View lift" : k === "pctFavs" ? "Fav lift" : k === "pctSales" ? "Sales lift" : "Revenue Δ"}
          </Button>
        ))}
      </div>

      {/* Per-listing table */}
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead className="text-right">Days since SEO</TableHead>
              <TableHead className="text-right">Views (Δ)</TableHead>
              <TableHead className="text-right">Favorites (Δ)</TableHead>
              <TableHead className="text-right">Sales (Δ)</TableHead>
              <TableHead className="text-right">Conv %</TableHead>
              <TableHead className="text-right">Revenue Δ</TableHead>
              <TableHead>Etsy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={9}>Loading…</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center py-8">
                  No listings yet. Run "Sync Etsy stats" once a snapshot exists.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[280px]">
                  <div className="font-medium truncate" title={r.title || r.product_name}>
                    {r.title || r.product_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {(r.tags || []).slice(0, 5).join(" · ")}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{r.niche}</Badge></TableCell>
                <TableCell className="text-right text-muted-foreground">{r.daysSince}d</TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold tabular-nums">{r.views}</div>
                  <DeltaCell delta={r.dViews} percent={r.pctViews} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold tabular-nums">{r.favorites}</div>
                  <DeltaCell delta={r.dFavs} percent={r.pctFavs} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold tabular-nums">{r.sales}</div>
                  <DeltaCell delta={r.dSales} percent={r.pctSales} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.conv.toFixed(2)}%
                  <div className="text-xs text-muted-foreground">
                    was {r.baseConv.toFixed(2)}%
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={
                      r.dRev > 0 ? "text-emerald-500 font-semibold" : r.dRev < 0 ? "text-red-500" : ""
                    }
                  >
                    {r.dRev >= 0 ? "+" : ""}{fmt$(r.dRev)}
                  </span>
                </TableCell>
                <TableCell>
                  {r.etsy_listing_id ? (
                    <a
                      className="text-primary underline text-sm"
                      href={`https://www.etsy.com/listing/${r.etsy_listing_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
