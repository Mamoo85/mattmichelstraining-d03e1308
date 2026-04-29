import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  target_id: string | null;
  city: string | null;
  state: string | null;
  trade: string | null;
  old_active: boolean | null;
  new_active: boolean | null;
  changed_by: string | null;
  changed_at: string;
};

function defaultFromDate() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
}
function todayIsoDate() { return new Date().toISOString().slice(0, 10); }

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function AdminProspectorTargetsAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(todayIsoDate());

  const load = async () => {
    setLoading(true);
    const fromIso = new Date(fromDate); fromIso.setHours(0, 0, 0, 0);
    const toIso = new Date(toDate); toIso.setHours(23, 59, 59, 999);
    const { data, error } = await supabase
      .from("prospector_targets_audit" as any)
      .select("id, target_id, city, state, trade, old_active, new_active, changed_by, changed_at")
      .gte("changed_at", fromIso.toISOString())
      .lte("changed_at", toIso.toISOString())
      .order("changed_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(`Failed to load audit log: ${error.message}`);
    setRows((data as any[] as AuditRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fromDate, toDate]);

  const stats = useMemo(() => {
    const activated = rows.filter((r) => r.new_active === true).length;
    const paused = rows.filter((r) => r.new_active === false).length;
    return { total: rows.length, activated, paused };
  }, [rows]);

  const handleExport = () => {
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const header = ["changed_at", "city", "state", "trade", "old_active", "new_active", "changed_by", "target_id"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.changed_at, r.city, r.state, r.trade, r.old_active, r.new_active, r.changed_by ?? "system", r.target_id]
        .map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospector-targets-audit-${todayIsoDate().replace(/-/g, "")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} audit rows`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dwa-admin/market-targeting" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Market Targeting
          </Link>
          <h1 className="text-2xl font-bold">Market Toggle Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Every time a market is activated or paused. Source: <code>prospector_targets_audit</code> (DB trigger).
          </p>
        </div>
        <Button onClick={handleExport} disabled={loading || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total changes</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Activations</div>
          <div className="text-2xl font-bold mt-1 text-emerald-500">{stats.activated}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pauses</div>
          <div className="text-2xl font-bold mt-1 text-amber-500">{stats.paused}</div>
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 px-2">When</th>
                <th className="text-left py-2 px-2">Market</th>
                <th className="text-left py-2 px-2">Trade</th>
                <th className="text-left py-2 px-2">Change</th>
                <th className="text-left py-2 px-2">Changed by</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No toggles in this date range.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-2 font-mono text-xs" title={new Date(r.changed_at).toLocaleString()}>
                    {relTime(r.changed_at)}
                  </td>
                  <td className="py-2 px-2">{r.city}, {r.state}</td>
                  <td className="py-2 px-2">{r.trade}</td>
                  <td className="py-2 px-2">
                    <Badge className={r.old_active ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                      {r.old_active ? "active" : "paused"}
                    </Badge>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <Badge className={r.new_active ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : "bg-amber-500/20 text-amber-500 border-amber-500/30"}>
                      {r.new_active ? "active" : "paused"}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 font-mono text-[10px] text-muted-foreground">
                    {r.changed_by ? `${r.changed_by.slice(0, 8)}…` : <span className="italic">system</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
