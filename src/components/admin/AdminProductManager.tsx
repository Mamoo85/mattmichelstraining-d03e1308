import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Save, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  product_type: string;
  price: number;
  description: string;
  image_url: string | null;
  external_url: string | null;
  category: string;
  is_live: boolean;
  sort_order: number;
}

const EMPTY: Omit<Product, "id"> = {
  name: "",
  product_type: "digital",
  price: 0,
  description: "",
  image_url: "",
  external_url: "",
  category: "general",
  is_live: false,
  sort_order: 0,
};

const TYPES = ["digital", "physical", "merch", "pdf"];
const CATEGORIES = ["general", "program", "merch-tops", "merch-accessories", "guide", "assessment"];

const AdminProductManager = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | (Omit<Product, "id"> & { id?: undefined }) | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Product[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (p: Omit<Product, "id"> & { id?: string }) => {
      const payload = {
        name: p.name,
        product_type: p.product_type,
        price: p.price,
        description: p.description,
        image_url: p.image_url || null,
        external_url: p.external_url || null,
        category: p.category,
        is_live: p.is_live,
        sort_order: p.sort_order,
      };
      if (p.id) {
        const { error } = await supabase.from("products" as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product saved" });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product deleted" });
    },
  });

  const toggleLive = async (id: string, live: boolean) => {
    await supabase.from("products" as any).update({ is_live: live }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  if (editing) {
    return (
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {editing.id ? "Edit Product" : "New Product"}
          </h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Name</label>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Price ($)</label>
            <Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Type</label>
            <select
              value={editing.product_type}
              onChange={(e) => setEditing({ ...editing, product_type: e.target.value })}
              className="w-full bg-background border border-border p-2 text-sm text-foreground"
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Category</label>
            <select
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              className="w-full bg-background border border-border p-2 text-sm text-foreground"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3}
              className="w-full bg-background border border-border p-2 text-sm text-foreground resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Image URL</label>
            <Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">External URL</label>
            <Input value={editing.external_url || ""} onChange={(e) => setEditing({ ...editing, external_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sort Order</label>
            <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch checked={editing.is_live} onCheckedChange={(v) => setEditing({ ...editing, is_live: v })} />
            <span className="text-xs font-bold text-foreground">{editing.is_live ? "Live" : "Hidden"}</span>
          </div>
        </div>

        <button
          onClick={() => saveMutation.mutate(editing)}
          disabled={saveMutation.isPending || !editing.name.trim()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Product
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Storefront Manager</h2>
          <p className="text-[10px] text-muted-foreground">Manage products for Shop & Merch pages</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
        >
          <Plus size={12} /> Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No products yet. Add your first product above.</p>
        </div>
      ) : (
        <div className="bg-card border border-border divide-y divide-border">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover border border-border shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  ${p.price.toFixed(2)} · {p.product_type} · {p.category}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleLive(p.id, !p.is_live)} title={p.is_live ? "Make hidden" : "Make live"}>
                  {p.is_live ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
                </button>
                <button onClick={() => setEditing(p)} className="text-muted-foreground hover:text-foreground">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(p.id); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminProductManager;
