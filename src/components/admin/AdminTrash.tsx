import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import { Trash2, RotateCcw, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrashItem {
  id: string;
  original_table: string;
  original_id: string;
  deleted_at: string;
  expires_at: string;
  original_data: any;
  label: string;
}

const AdminTrash = () => {
  const queryClient = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState<TrashItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_trash" as any)
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as TrashItem[];
    },
  });

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      // Un-soft-delete the original record
      await supabase
        .from(restoreTarget.original_table as any)
        .update({ is_deleted: false } as any)
        .eq("id", restoreTarget.original_id);

      // Remove from trash
      await supabase.from("admin_trash" as any).delete().eq("id", restoreTarget.id);

      toast({ title: "Restored", description: restoreTarget.label });
      queryClient.invalidateQueries({ queryKey: ["admin-trash"] });
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    }
    setRestoreTarget(null);
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    try {
      // Permanently delete the original record
      await supabase
        .from(purgeTarget.original_table as any)
        .delete()
        .eq("id", purgeTarget.original_id);

      // Remove from trash
      await supabase.from("admin_trash" as any).delete().eq("id", purgeTarget.id);

      toast({ title: "Permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-trash"] });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
    setPurgeTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card border border-border p-8 text-center">
        <Trash2 size={28} className="mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-bold text-foreground mb-1">Trash is Empty</p>
        <p className="text-xs text-muted-foreground">Deleted items appear here for 30 days before permanent removal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 size={14} className="text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{items.length}</span> item{items.length !== 1 ? "s" : ""} in trash
        </p>
      </div>

      {items.map((item) => {
        const daysLeft = Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        return (
          <div key={item.id} className="bg-card border border-border p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{item.label || "Deleted item"}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span className="uppercase tracking-widest bg-muted px-2 py-0.5 font-bold">
                  {item.original_table.replace(/_/g, " ")}
                </span>
                <span>Deleted {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {daysLeft}d left
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => setRestoreTarget(item)}
                className="flex items-center gap-1 border border-primary/30 text-primary px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
              >
                <RotateCcw size={11} />
                Restore
              </button>
              <button
                onClick={() => setPurgeTarget(item)}
                className="flex items-center gap-1 border border-destructive/30 text-destructive px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/10 transition-all"
              >
                <Trash2 size={11} />
                Purge
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmActionModal
        open={!!restoreTarget}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}
        onConfirm={handleRestore}
        title="Restore Item"
        description={`Restore "${restoreTarget?.label}"? It will reappear in its original location.`}
        confirmLabel="Restore"
      />

      <ConfirmActionModal
        open={!!purgeTarget}
        onOpenChange={(open) => { if (!open) setPurgeTarget(null); }}
        onConfirm={handlePurge}
        title="Permanently Delete"
        description={`Permanently delete "${purgeTarget?.label}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
      />
    </div>
  );
};

export default AdminTrash;
