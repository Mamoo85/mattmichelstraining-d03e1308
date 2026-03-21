import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, RefreshCw, Pencil, Check, X, Trash2 } from "lucide-react";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface StripeProduct {
  id: string;
  name: string;
  description: string;
}

const AdminStripeProducts = () => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StripeProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["stripe-products"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("update-stripe-product", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data.products || []) as StripeProduct[];
    },
  });

  const startEdit = (p: StripeProduct) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
  };

  const saveProduct = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-stripe-product", {
        body: { action: "update", product_id: editingId, name: editName, description: editDesc },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Product updated in Stripe");
      qc.invalidateQueries({ queryKey: ["stripe-products"] });
      cancelEdit();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-stripe-product", {
        body: { action: "archive", product_id: deleteTarget.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`"${deleteTarget.name}" archived in Stripe`);
      qc.invalidateQueries({ queryKey: ["stripe-products"] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to archive");
    } finally {
      setDeleting(false);
    }
  };

  const generateAiDescription = async (product: StripeProduct) => {
    setAiLoading(product.id);
    try {
      const prompt = `Write a concise, clear Stripe product description (1-2 sentences, no jargon) for a fitness training membership called "${product.name}". Current description: "${product.description}". Make it benefit-focused and easy to understand for parents, athletes, and coaches. Return ONLY the description text, nothing else.`;

      const response = await supabase.functions.invoke("ai-admin-assist", {
        body: { type: "stripe_product_description", context: { prompt } },
      });

      if (response.error) throw response.error;
      const aiText = response.data?.reply || response.data?.text || "";
      if (aiText) {
        if (editingId === product.id) {
          setEditDesc(aiText.trim());
        } else {
          startEdit(product);
          setTimeout(() => setEditDesc(aiText.trim()), 50);
        }
        toast.success("AI suggestion ready — review and save");
      }
    } catch (err: any) {
      toast.error("AI generation failed: " + (err.message || "Unknown error"));
    } finally {
      setAiLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Stripe Products</h3>
          <p className="text-xs text-muted-foreground mt-1">Edit names and descriptions directly — changes sync to Stripe instantly.</p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["stripe-products"] })}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {products.map((p) => {
          const isEditing = editingId === p.id;

          return (
            <div key={p.id} className="border border-border rounded-lg p-4 bg-card space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveProduct}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save to Stripe
                    </button>
                    <button
                      onClick={() => generateAiDescription(p)}
                      disabled={aiLoading === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/80 disabled:opacity-50"
                    >
                      {aiLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI Suggest
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.description || "No description"}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => generateAiDescription(p)}
                      disabled={aiLoading === p.id}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      title="AI Suggest Description"
                    >
                      {aiLoading === p.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Archive / Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <ConfirmActionModal
          open={!!deleteTarget}
          title={`Archive "${deleteTarget.name}"?`}
          description="This will deactivate the product in Stripe. It won't delete payment history — you can reactivate it from the Stripe dashboard later."
          confirmLabel={deleting ? "Archiving…" : "Archive Product"}
          onConfirm={handleArchive}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
};

export default AdminStripeProducts;
