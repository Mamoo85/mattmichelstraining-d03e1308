import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Play } from "lucide-react";
import { toast } from "sonner";

const PRODUCTS = [
  { key: "mortgage_radar", name: "Mortgage Radar" },
  { key: "trade_radar", name: "Trade Radar" },
  { key: "field_desk", name: "FieldDesk" },
  { key: "site_radar", name: "SiteRadar" },
  { key: "missed_call_catch", name: "Missed-Call Catch" },
  { key: "phone_answering", name: "AI Phone Answering" },
  { key: "bundle_revenue_suite", name: "Bundle Revenue Suite" },
];

const TOUCHES = [
  { key: "day3", label: "Day 3 — Value Reminder" },
  { key: "day5", label: "Day 5 — 48hr Warning + 50% off" },
  { key: "day6", label: "Day 6 — Founder note + extension" },
  { key: "day8", label: "Day 8 — Reactivation" },
  { key: "day14", label: "Day 14 — Final win-back" },
];

export default function TrialDripPreview() {
  const [running, setRunning] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].key);

  const { data: signups, refetch } = useQuery({
    queryKey: ["trial-signups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trial_signups")
        .select("id, email, product_key, status, trial_started_at, trial_ends_at, converted_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: drips } = useQuery({
    queryKey: ["trial-drip-state"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trial_drip_state")
        .select("trial_signup_id, touch_key, sent_at, status")
        .order("sent_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  async function runDryRun() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("trial-drip-runner?dry_run=1");
      if (error) throw error;
      toast.success(`Dry run: ${(data as any)?.processed ?? 0} touches would fire today`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function runLive() {
    if (!confirm("This will SEND real trial drip emails. Continue?")) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("trial-drip-runner");
      if (error) throw error;
      toast.success(`Sent ${(data as any)?.processed ?? 0} drip touches`);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">Trial Recovery Drip</h1>
        <p className="text-sm text-muted-foreground">
          5-touch sequence (D3 → D14) for trial signups that haven't converted. Cron: daily 9am ET.
        </p>
      </div>

      <div className="flex gap-3 mb-8">
        <button
          onClick={runDryRun}
          disabled={running}
          className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 text-sm font-bold rounded hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Dry Run
        </button>
        <button
          onClick={runLive}
          disabled={running}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-bold rounded hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Run Live Now
        </button>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4">5-Touch Sequence Preview</h2>
        <div className="mb-4">
          <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Product</label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="bg-card border border-border px-3 py-2 text-sm rounded"
          >
            {PRODUCTS.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          {TOUCHES.map((t) => (
            <div key={t.key} className="bg-card border border-border p-3 rounded">
              <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{t.key}</div>
              <div className="text-xs font-bold">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent Trial Signups ({signups?.length ?? 0})</h2>
        <div className="bg-card border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-widest">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Touches</th>
              </tr>
            </thead>
            <tbody>
              {(signups ?? []).map((s) => {
                const sentTouches = (drips ?? []).filter((d) => d.trial_signup_id === s.id);
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 text-xs">{s.product_key}</td>
                    <td className="px-3 py-2 text-xs">{s.converted_at ? "✅ converted" : s.status}</td>
                    <td className="px-3 py-2 text-xs">{new Date(s.trial_started_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs">{sentTouches.map((t) => t.touch_key).join(", ") || "—"}</td>
                  </tr>
                );
              })}
              {(!signups || signups.length === 0) && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-xs">No trial signups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
