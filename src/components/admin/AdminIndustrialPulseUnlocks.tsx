import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, Search, Download } from "lucide-react";

type UnlockRow = {
  id: string;
  email: string;
  plan: "snapshot_50" | "firehose_199";
  status: "pending" | "active" | "canceled" | "refunded";
  amount_cents: number | null;
  week_start: string | null;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  activated_at: string | null;
  canceled_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const STATUS_COLORS: Record<UnlockRow["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  canceled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  refunded: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const PLAN_LABEL: Record<UnlockRow["plan"], string> = {
  snapshot_50: "$50 Snapshot",
  firehose_199: "$199/mo Firehose",
};

export default function AdminIndustrialPulseUnlocks() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>(""); // YYYY-MM-DD
  const [search, setSearch] = useState<string>("");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["industrial-pulse-unlocks"],
    queryFn: async () => {
      // deno-lint-ignore no-explicit-any
      const { data, error } = await (supabase.from as any)("industrial_pulse_unlocks")
        .select("id, email, plan, status, amount_cents, week_start, stripe_session_id, stripe_subscription_id, activated_at, canceled_at, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as UnlockRow[];
    },
  });

  const availableWeeks = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.week_start) set.add(r.week_start); });
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (planFilter !== "all" && r.plan !== planFilter) return false;
      if (weekFilter && r.week_start !== weekFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const biz = (r.metadata?.business_name as string | undefined) || "";
        if (!r.email.toLowerCase().includes(q) && !biz.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, planFilter, weekFilter, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter(r => r.status === "active").length;
    const pending = filtered.filter(r => r.status === "pending").length;
    const revenue = filtered
      .filter(r => r.status === "active")
      .reduce((sum, r) => sum + (r.amount_cents || 0), 0);
    return { total, active, pending, revenue };
  }, [filtered]);

  const resendMutation = useMutation({
    mutationFn: async (unlockId: string) => {
      setResendingId(unlockId);
      const { data, error } = await supabase.functions.invoke("resend-industrial-pulse-unlock", {
        body: { unlock_id: unlockId },
      });
      if (error) throw error;
      // deno-lint-ignore no-explicit-any
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data) => {
      // deno-lint-ignore no-explicit-any
      const d = data as any;
      toast.success(`Email resent to ${d?.to} — ${d?.signal_count || 0} signals`);
      setResendingId(null);
    },
    onError: (e: Error) => {
      toast.error(`Resend failed: ${e.message}`);
      setResendingId(null);
    },
  });

  function exportCSV() {
    const header = ["created_at","status","plan","email","business_name","week_start","amount_cents","activated_at","canceled_at","stripe_session_id","stripe_subscription_id"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const biz = (r.metadata?.business_name as string | undefined) || "";
      const cells = [
        r.created_at, r.status, r.plan, r.email, biz,
        r.week_start || "", String(r.amount_cents || 0),
        r.activated_at || "", r.canceled_at || "",
        r.stripe_session_id || "", r.stripe_subscription_id || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `industrial-pulse-unlocks-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">🔓 Industrial Pulse Unlocks</h2>
          <p className="text-xs text-muted-foreground">Channel 3 — $50 snapshot + $199/mo firehose purchases.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download size={14} />
            <span className="ml-1.5">Export CSV ({filtered.length})</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400">Active</div>
          <div className="text-2xl font-semibold text-foreground">{stats.active}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-400">Pending</div>
          <div className="text-2xl font-semibold text-foreground">{stats.pending}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-cyan-400">Active Revenue</div>
          <div className="text-2xl font-semibold text-foreground">${(stats.revenue / 100).toLocaleString()}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email or business name…"
              className="pl-7 h-8 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="canceled" className="text-xs">Canceled</SelectItem>
              <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All plans</SelectItem>
              <SelectItem value="snapshot_50" className="text-xs">$50 Snapshot</SelectItem>
              <SelectItem value="firehose_199" className="text-xs">$199/mo Firehose</SelectItem>
            </SelectContent>
          </Select>
          <Select value={weekFilter || "all"} onValueChange={(v) => setWeekFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Week" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all" className="text-xs">All weeks</SelectItem>
              {availableWeeks.map(w => (
                <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-muted-foreground">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading unlocks…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No unlocks match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Business</TableHead>
                  <TableHead className="text-xs">Week</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const biz = (r.metadata?.business_name as string | undefined) || "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                        <div className="text-[10px] opacity-60">{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{PLAN_LABEL[r.plan]}</TableCell>
                      <TableCell className="text-xs font-mono">{r.email}</TableCell>
                      <TableCell className="text-xs">{biz}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{r.week_start || "—"}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">${((r.amount_cents || 0) / 100).toFixed(0)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          disabled={r.status !== "active" || resendingId === r.id}
                          onClick={() => resendMutation.mutate(r.id)}
                          title={r.status !== "active" ? "Only active unlocks can be resent" : "Resend unlock email"}
                        >
                          {resendingId === r.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Mail size={12} />}
                          <span className="ml-1.5">Resend</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
