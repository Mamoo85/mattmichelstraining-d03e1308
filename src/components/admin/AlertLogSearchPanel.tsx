import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Download, Search } from "lucide-react";

interface AlertRow {
  id: string;
  kind: string;
  severity: string;
  message: string;
  sms_sent: boolean;
  meta: any;
  value: number | null;
  created_at: string;
}

const RANGES: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

export default function AlertLogSearchPanel({ compact }: { compact?: boolean }) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [severity, setSeverity] = useState<string>("all");
  const [reason, setReason] = useState<string>("all");
  const [range, setRange] = useState<string>("7d");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - RANGES[range] * 86400_000).toISOString();
    let q = supabase
      .from("outreach_alerts_log")
      .select("id, kind, severity, message, sms_sent, meta, value, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(compact ? 50 : 500);
    if (severity !== "all") q = q.eq("severity", severity);
    if (reason !== "all") q = q.eq("kind", reason);
    const { data } = await q;
    setRows((data as any[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [severity, reason, range]);

  const distinctKinds = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.kind));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      r.message.toLowerCase().includes(s) || JSON.stringify(r.meta).toLowerCase().includes(s),
    );
  }, [rows, search]);

  function exportCsv() {
    const header = "id,severity,kind,message,sms_sent,value,created_at\n";
    const body = filtered
      .map((r) =>
        [r.id, r.severity, r.kind, JSON.stringify(r.message), r.sms_sent, r.value ?? "", r.created_at].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alerts-${range}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetCooldown(kind: string) {
    await supabase.rpc("reset_alert_cooldown" as any, { _kind: kind });
    load();
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5" />
        <h3 className="font-semibold">Alert log</h3>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} rows</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <Label>Severity</Label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="warn">warn</option>
            <option value="crit">crit</option>
          </select>
        </div>
        <div>
          <Label>Reason / kind</Label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            {distinctKinds.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Range</Label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-3 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter messages…" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </div>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2">When</th>
              <th className="text-left p-2">Sev</th>
              <th className="text-left p-2">Kind</th>
              <th className="text-left p-2">Message</th>
              <th className="text-left p-2">SMS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No alerts</td></tr>
            )}
            {filtered.map((r) => (
              <>
                <tr
                  key={r.id}
                  className="border-t hover:bg-muted/20 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="p-2 font-mono">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    <span className={r.severity === "crit" ? "text-rose-400 font-semibold" : "text-amber-400"}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-2 font-mono">{r.kind}</td>
                  <td className="p-2">{r.message}</td>
                  <td className="p-2">{r.sms_sent ? "✓" : "—"}</td>
                </tr>
                {expanded === r.id && (
                  <tr key={r.id + "-x"} className="bg-muted/20">
                    <td colSpan={5} className="p-3">
                      <pre className="text-xs overflow-auto max-h-48">{JSON.stringify(r.meta, null, 2)}</pre>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => resetCooldown(r.kind)}>
                        Reset cooldown for "{r.kind}"
                      </Button>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
