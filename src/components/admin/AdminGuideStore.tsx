import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ToggleLeft, ToggleRight, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SPORTS = ["football", "baseball", "basketball", "hockey", "soccer", "lacrosse", "wrestling", "track", "volleyball", "general"];

const AdminGuideStore = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newGuide, setNewGuide] = useState({
    title: "", sport: "general", price_cents: 1500, stripe_price_id: "", prompt_template: "", sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["admin-sport-guides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_guides" as any)
        .select("*, purchased_guides(id)")
        .order("sort_order", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: purchased = [] } = useQuery({
    queryKey: ["admin-purchased-guides-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchased_guides" as any)
        .select("guide_id");
      return (data || []) as any[];
    },
  });

  const purchaseCounts: Record<string, number> = {};
  for (const p of purchased) {
    purchaseCounts[p.guide_id] = (purchaseCounts[p.guide_id] || 0) + 1;
  }

  const totalRevenue = purchased.length * 15; // approx avg $15

  const toggleActive = async (guide: any) => {
    setToggling(guide.id);
    try {
      await supabase
        .from("sport_guides" as any)
        .update({ is_active: !guide.is_active })
        .eq("id", guide.id);
      qc.invalidateQueries({ queryKey: ["admin-sport-guides"] });
    } catch {
      toast({ title: "Error toggling guide", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const saveGuide = async () => {
    if (!newGuide.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sport_guides" as any)
        .insert({
          title: newGuide.title,
          sport: newGuide.sport,
          price_cents: newGuide.price_cents,
          stripe_price_id: newGuide.stripe_price_id || null,
          prompt_template: newGuide.prompt_template || null,
          sort_order: newGuide.sort_order,
          is_active: true,
          slug: newGuide.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        });
      if (error) throw error;
      toast({ title: "Guide added" });
      setNewGuide({ title: "", sport: "general", price_cents: 1500, stripe_price_id: "", prompt_template: "", sort_order: 0 });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["admin-sport-guides"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Coach's Playbooks Store</h2>
          <p className="text-xs text-muted-foreground">
            {guides.length} guides · {purchased.length} sold · ~${totalRevenue} est. revenue
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={13} className="mr-1" /> Add Guide
        </Button>
      </div>

      {/* Add Guide Form */}
      {showAdd && (
        <div className="border border-primary/30 bg-primary/5 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary">New Guide</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Title (e.g. Football Combine Playbook)"
              value={newGuide.title}
              onChange={(e) => setNewGuide({ ...newGuide, title: e.target.value })}
              className="col-span-2"
            />
            <select
              value={newGuide.sport}
              onChange={(e) => setNewGuide({ ...newGuide, sport: e.target.value })}
              className="bg-background border border-border px-3 py-2 text-sm text-foreground"
            >
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input
              type="number"
              placeholder="Price (cents, e.g. 1500)"
              value={newGuide.price_cents}
              onChange={(e) => setNewGuide({ ...newGuide, price_cents: parseInt(e.target.value) || 1500 })}
            />
            <Input
              placeholder="Stripe Price ID (price_1...)"
              value={newGuide.stripe_price_id}
              onChange={(e) => setNewGuide({ ...newGuide, stripe_price_id: e.target.value })}
              className="col-span-2"
            />
            <textarea
              placeholder="Custom prompt template (optional — leave blank for default)"
              value={newGuide.prompt_template}
              onChange={(e) => setNewGuide({ ...newGuide, prompt_template: e.target.value })}
              rows={3}
              className="col-span-2 bg-background border border-border px-3 py-2 text-sm text-foreground resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveGuide} disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Save Guide
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Guides Table */}
      {guides.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <BookOpen size={28} className="mx-auto mb-3 opacity-40" />
          No guides yet. Add your first one above.
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Title</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Sport</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Price</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Sold</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Stripe</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g: any) => (
                <tr key={g.id} className="border-b border-border hover:bg-muted/10">
                  <td className="px-3 py-2 font-medium text-foreground max-w-48">{g.title}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{g.sport}</td>
                  <td className="px-3 py-2 font-bold text-foreground">${(g.price_cents / 100).toFixed(0)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{purchaseCounts[g.id] || 0}</td>
                  <td className="px-3 py-2">
                    {g.stripe_price_id ? (
                      <Badge variant="default" className="text-[10px]">Linked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">No price</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={g.is_active ? "default" : "secondary"} className="text-[10px]">
                      {g.is_active ? "Active" : "Hidden"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(g)}
                      disabled={toggling === g.id}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {toggling === g.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : g.is_active ? (
                        <ToggleRight size={16} className="text-primary" />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminGuideStore;
