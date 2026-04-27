import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface SuppressionRow {
  id: string;
  contact: string;
  contact_type: "email" | "phone";
  reason: string | null;
  source: string;
  created_at: string;
}

export default function OutreachSuppressionManager() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SuppressionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkType, setBulkType] = useState<"email" | "phone">("email");
  const [bulkReason, setBulkReason] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contractor_outreach_suppression" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(((data as any[]) || []) as SuppressionRow[]);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function addBulk() {
    const lines = bulk.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("Paste at least one contact"); return; }
    if (lines.length > 500) { toast.error("Max 500 at a time"); return; }
    setAdding(true);
    const payload = lines.map(c => ({
      contact: bulkType === "email" ? c.toLowerCase() : c,
      contact_type: bulkType,
      reason: bulkReason || "Manual bulk add",
      source: "manual",
    }));
    const { error } = await (supabase as any)
      .from("contractor_outreach_suppression")
      .upsert(payload, { onConflict: "contact,contact_type", ignoreDuplicates: true });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${lines.length} to suppression list`);
    setBulk("");
    setBulkReason("");
    load();
  }

  async function remove(id: string, contact: string) {
    if (!confirm(`Remove ${contact} from suppression list? They'll be eligible to receive outreach again.`)) return;
    const { error } = await supabase
      .from("contractor_outreach_suppression" as never)
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    setRows(rows.filter(r => r.id !== id));
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-red-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Suppression List (Do-Not-Contact)</span>
          {rows.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{rows.length}</span>}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Every cold email + SMS checks this list before sending. Adding here is permanent unless you remove the row manually.
          </p>

          {/* Bulk add */}
          <div className="bg-background/50 border border-border rounded p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <select
                value={bulkType}
                onChange={e => setBulkType(e.target.value as "email" | "phone")}
                className="bg-background border border-border text-xs px-2 py-1 rounded"
              >
                <option value="email">Emails</option>
                <option value="phone">Phones (E.164)</option>
              </select>
              <input
                value={bulkReason}
                onChange={e => setBulkReason(e.target.value)}
                placeholder="Reason (e.g. complaint, competitor)"
                className="flex-1 bg-background border border-border text-xs px-2 py-1 rounded"
              />
            </div>
            <textarea
              value={bulk}
              onChange={e => setBulk(e.target.value)}
              placeholder={bulkType === "email" ? "Paste emails (one per line, comma, or space)" : "Paste +1 phones in E.164"}
              rows={3}
              className="w-full bg-background border border-border text-xs px-2 py-2 rounded font-mono"
            />
            <button
              onClick={addBulk}
              disabled={adding || !bulk.trim()}
              className="text-xs font-bold px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Plus size={11} /> {adding ? "Adding…" : "Add to Suppression"}
            </button>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto border border-border rounded">
            {loading ? <p className="p-3 text-xs text-muted-foreground">Loading…</p> : rows.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Suppression list is empty.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-background/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left p-2">Contact</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-left p-2">Reason</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-background/30">
                      <td className="p-2 font-mono text-foreground">{r.contact}</td>
                      <td className="p-2 text-muted-foreground">{r.contact_type}</td>
                      <td className="p-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{r.source}</span></td>
                      <td className="p-2 text-muted-foreground truncate max-w-[200px]">{r.reason || "—"}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => remove(r.id, r.contact)}
                          className="text-red-400 hover:bg-red-500/10 p-1 rounded"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
