import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";

type Row = {
  event_id: string;
  event_type: string;
  product_type: string | null;
  fulfillment_status: string | null;
  fulfillment_error: string | null;
  fulfillment_completed_at: string | null;
  processed_at: string | null;
};

const STATUS_OPTIONS = ["all", "pending", "completed", "failed"] as const;

function startOfDayIso(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayIso(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}
function defaultFromDate() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
}
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminCheckoutEvents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<typeof STATUS_OPTIONS[number]>("all");
  const [productType, setProductType] = useState<string>("all");
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [siteRadarOnly, setSiteRadarOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("processed_stripe_events" as any)
      .select("event_id, event_type, product_type, fulfillment_status, fulfillment_error, fulfillment_completed_at, processed_at")
      .gte("processed_at", startOfDayIso(new Date(fromDate)))
      .lte("processed_at", endOfDayIso(new Date(toDate)))
      .order("processed_at", { ascending: false })
      .limit(500);
    if (status !== "all") q = q.eq("fulfillment_status", status);
    if (productType !== "all") q = q.eq("product_type", productType);
    if (siteRadarOnly) q = q.ilike("product_type", "%site_radar%");
    const { data } = await q;
    setRows((data as any[] as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, productType, fromDate, toDate, siteRadarOnly]);

  // Realtime: any new/updated webhook event refreshes the table
  useEffect(() => {
    const ch = supabase
      .channel("admin-checkout-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "processed_stripe_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [status, productType, fromDate, toDate, siteRadarOnly]);

  const counts = useMemo(() => {
    const c = { completed: 0, failed: 0, pending: 0 };
    rows.forEach((r) => {
      const s = (r.fulfillment_status || "pending") as keyof typeof c;
      if (s in c) (c as any)[s]++;
    });
    return c;
  }, [rows]);

  const productTypes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.product_type) s.add(r.product_type); });
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checkout Events</h1>
          <p className="text-sm text-muted-foreground">
            Live feed of every Stripe webhook + fulfillment outcome. Source: <code>processed_stripe_events</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completed</div>
          <div className="text-2xl font-bold mt-1">{counts.completed}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="w-4 h-4 text-rose-500" /> Failed</div>
          <div className="text-2xl font-bold mt-1 text-rose-500">{counts.failed}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="w-4 h-4 text-amber-500" /> Pending</div>
          <div className="text-2xl font-bold mt-1">{counts.pending}</div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Product</label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {productTypes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={siteRadarOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setSiteRadarOnly((v) => !v)}
          >
            📡 SiteRadar only
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
            Live
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 px-2">When</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Product</th>
                <th className="text-left py-2 px-2">Stripe event</th>
                <th className="text-left py-2 px-2">Error</th>
                <th className="text-left py-2 px-2">Event ID</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No events match the current filters.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.event_id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-2 font-mono text-xs">{r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}</td>
                  <td className="py-2 px-2">
                    {r.fulfillment_status === "completed" && <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">completed</Badge>}
                    {r.fulfillment_status === "failed" && <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/30">failed</Badge>}
                    {(!r.fulfillment_status || r.fulfillment_status === "pending") && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">pending</Badge>}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{r.product_type || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-2 font-mono text-xs">{r.event_type}</td>
                  <td className="py-2 px-2 text-xs text-rose-400 max-w-md truncate" title={r.fulfillment_error || ""}>{r.fulfillment_error || ""}</td>
                  <td className="py-2 px-2 font-mono text-[10px] text-muted-foreground">{r.event_id.slice(0, 18)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        <Link to="/dwa-admin/market-targeting" className="underline">Market targeting</Link>
        {" · "}
        <Link to="/dwa-admin/market-targeting/audit" className="underline">Audit log</Link>
      </div>
    </div>
  );
}
