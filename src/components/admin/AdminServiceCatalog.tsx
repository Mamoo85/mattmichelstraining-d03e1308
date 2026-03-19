import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface CatalogItem {
  id: string;
  item_name: string;
  exact_price: number;
  description: string;
  category: string;
  is_active: boolean;
}

const EMPTY: CatalogItem = { id: "", item_name: "", exact_price: 0, description: "", category: "general", is_active: true };

const AdminServiceCatalog = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_catalog").select("*").order("category").order("exact_price");
      if (error) throw error;
      return data as CatalogItem[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const payload = { item_name: item.item_name, exact_price: item.exact_price, description: item.description, category: item.category, is_active: item.is_active };
      if (item.id) {
        const { error } = await supabase.from("service_catalog").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-catalog"] }); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-catalog"] }); toast.success("Deleted"); },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("service_catalog").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-catalog"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Service Catalog — Source of Truth</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={14} className="mr-1" /> Add Item
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">All AI-generated copy will reference ONLY the exact names and prices listed here. No hallucinated pricing.</p>

      {editing && (
        <div className="bg-muted p-4 space-y-3 border border-border">
          <Input placeholder="Item name (exact)" value={editing.item_name} onChange={(e) => setEditing({ ...editing, item_name: e.target.value })} className="text-sm" />
          <div className="flex gap-2">
            <Input type="number" step="0.01" placeholder="Price" value={editing.exact_price || ""} onChange={(e) => setEditing({ ...editing, exact_price: parseFloat(e.target.value) || 0 })} className="text-sm w-32" />
            <Input placeholder="Category" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="text-sm w-40" />
          </div>
          <Input placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => upsert.mutate(editing)} disabled={!editing.item_name || !editing.exact_price}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center justify-between p-3 bg-card border border-border ${!item.is_active ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{item.item_name}</span>
                  <span className="text-xs font-mono text-primary">${Number(item.exact_price).toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5">{item.category}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Switch checked={item.is_active} onCheckedChange={(v) => toggle.mutate({ id: item.id, is_active: v })} />
                <button onClick={() => setEditing(item)} className="text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm("Delete?")) remove.mutate(item.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminServiceCatalog;
