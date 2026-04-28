// Wave 6: admin CRUD for autonomous walker targets + alert cooldown reset.
// Lets Matt add/remove trade × city pairs the matrix walker visits, and
// kick a stuck alert cooldown so it can re-page immediately.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2, Plus, RefreshCw, Trash2, Bell } from "lucide-react";

interface WalkerTarget {
  trade: string;
  city: string;
  enabled: boolean;
  priority: number;
  max_per_run: number;
  daily_cost_cap_usd: number;
  last_walked_at: string | null;
  notes: string | null;
}

interface CooldownRow {
  kind: string;
  last_fired_at: string;
  last_severity: string;
  last_value: number | null;
}

export default function WalkerTargetsPanel() {
  const [targets, setTargets] = useState<WalkerTarget[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // form state
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [priority, setPriority] = useState(5);
  const [maxPerRun, setMaxPerRun] = useState(50);
  const [costCap, setCostCap] = useState(10);
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    const [t, c] = await Promise.all([
      supabase
        .from("enrichment_walker_targets")
        .select("*")
        .order("priority", { ascending: true })
        .order("trade", { ascending: true }),
      supabase
        .from("outreach_alert_cooldowns")
        .select("*")
        .order("last_fired_at", { ascending: false }),
    ]);
    if (t.error) toast.error(`Targets: ${t.error.message}`);
    else setTargets((t.data ?? []) as WalkerTarget[]);
    if (c.error) toast.error(`Cooldowns: ${c.error.message}`);
    else setCooldowns((c.data ?? []) as CooldownRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTarget() {
    if (!trade.trim() || !city.trim()) {
      toast.error("Trade and city are required");
      return;
    }
    setBusy("add");
    const { error } = await supabase.rpc("upsert_walker_target", {
      _trade: trade.trim().toLowerCase(),
      _city: city.trim(),
      _enabled: true,
      _priority: priority,
      _max_per_run: maxPerRun,
      _daily_cost_cap_usd: costCap,
      _notes: notes.trim() || null,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${trade}/${city}`);
    setTrade("");
    setCity("");
    setNotes("");
    await load();
  }

  async function toggleEnabled(t: WalkerTarget) {
    setBusy(`${t.trade}|${t.city}`);
    const { error } = await supabase.rpc("upsert_walker_target", {
      _trade: t.trade,
      _city: t.city,
      _enabled: !t.enabled,
      _priority: t.priority,
      _max_per_run: t.max_per_run,
      _daily_cost_cap_usd: t.daily_cost_cap_usd,
      _notes: t.notes,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  async function removeTarget(t: WalkerTarget) {
    if (!confirm(`Remove ${t.trade} / ${t.city}?`)) return;
    setBusy(`${t.trade}|${t.city}`);
    const { error } = await supabase.rpc("delete_walker_target", {
      _trade: t.trade,
      _city: t.city,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    await load();
  }

  async function resetCooldown(kind: string) {
    setBusy(`cd|${kind}`);
    const { error } = await supabase.rpc("reset_alert_cooldown", { _kind: kind });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Cooldown reset for ${kind}`);
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Add target */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          Add walker target
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            placeholder="Trade (e.g. plumber)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Detroit)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="number"
            value={priority}
            min={1}
            max={10}
            onChange={(e) => setPriority(Number(e.target.value))}
            placeholder="Priority"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            title="1 = highest priority"
          />
          <input
            type="number"
            value={maxPerRun}
            min={1}
            onChange={(e) => setMaxPerRun(Number(e.target.value))}
            placeholder="Max/run"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={costCap}
            min={0}
            step={0.5}
            onChange={(e) => setCostCap(Number(e.target.value))}
            placeholder="Daily cap $"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-3"
          />
          <button
            onClick={addTarget}
            disabled={busy === "add"}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === "add" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </div>
      </div>

      {/* Targets table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            Walker targets ({targets.length})
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : targets.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No walker targets yet. Add one above to start autonomous discovery.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Trade</th>
                  <th className="px-3 py-2 text-left">City</th>
                  <th className="px-3 py-2 text-right">Pri</th>
                  <th className="px-3 py-2 text-right">Max/run</th>
                  <th className="px-3 py-2 text-right">Cap $</th>
                  <th className="px-3 py-2 text-left">Last walked</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const k = `${t.trade}|${t.city}`;
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{t.trade}</td>
                      <td className="px-3 py-2 text-foreground">{t.city}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.priority}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.max_per_run}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ${Number(t.daily_cost_cap_usd).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {t.last_walked_at
                          ? new Date(t.last_walked_at).toLocaleString()
                          : "never"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleEnabled(t)}
                          disabled={busy === k}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.enabled
                              ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {t.enabled ? "enabled" : "paused"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeTarget(t)}
                          disabled={busy === k}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cooldown reset */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Active alert cooldowns
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reset to allow an alert to re-page immediately on the next evaluator tick.
          </p>
        </div>
        {cooldowns.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No active cooldowns.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2 text-left">Last fired</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {cooldowns.map((c) => (
                  <tr key={c.kind} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{c.kind}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.last_severity === "crit"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        {c.last_severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.last_value ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(c.last_fired_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => resetCooldown(c.kind)}
                        disabled={busy === `cd|${c.kind}`}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        {busy === `cd|${c.kind}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
