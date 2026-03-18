import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Save, X, Quote } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  author_initials: string;
  sport: string | null;
  page: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY: Omit<Testimonial, "id"> = {
  quote: "",
  author_name: "",
  author_role: "",
  author_initials: "",
  sport: "",
  page: "home",
  is_active: true,
  sort_order: 0,
};

const PAGES = ["home", "about", "welcome", "for-parents"];

const AdminTestimonials = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Testimonial | (Omit<Testimonial, "id"> & { id?: undefined }) | null>(null);

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Testimonial[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (t: Omit<Testimonial, "id"> & { id?: string }) => {
      const payload = {
        quote: t.quote,
        author_name: t.author_name,
        author_role: t.author_role,
        author_initials: t.author_initials,
        sport: t.sport || null,
        page: t.page,
        is_active: t.is_active,
        sort_order: t.sort_order,
      };
      if (t.id) {
        const { error } = await supabase.from("testimonials" as any).update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("testimonials" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      qc.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Testimonial saved" });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testimonials" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      qc.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Testimonial deleted" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  if (editing) {
    return (
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {editing.id ? "Edit Testimonial" : "New Testimonial"}
          </h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Quote</label>
          <textarea
            value={editing.quote}
            onChange={(e) => setEditing({ ...editing, quote: e.target.value })}
            rows={4}
            className="w-full bg-background border border-border p-2 text-sm text-foreground resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Author Name</label>
            <Input value={editing.author_name} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Role / Location</label>
            <Input value={editing.author_role} onChange={(e) => setEditing({ ...editing, author_role: e.target.value })} placeholder="Parent · Grosse Pointe" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Initials</label>
            <Input value={editing.author_initials} onChange={(e) => setEditing({ ...editing, author_initials: e.target.value.toUpperCase().slice(0, 3) })} placeholder="SM" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
            <Input value={editing.sport || ""} onChange={(e) => setEditing({ ...editing, sport: e.target.value })} placeholder="Baseball, Soccer..." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Show On Page</label>
            <select
              value={editing.page}
              onChange={(e) => setEditing({ ...editing, page: e.target.value })}
              className="w-full bg-background border border-border p-2 text-sm text-foreground"
            >
              {PAGES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sort Order</label>
            <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
          <span className="text-xs font-bold text-foreground">{editing.is_active ? "Active" : "Hidden"}</span>
        </div>

        <button
          onClick={() => saveMutation.mutate(editing)}
          disabled={saveMutation.isPending || !editing.quote.trim() || !editing.author_name.trim()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Testimonial
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Testimonials</h2>
          <p className="text-[10px] text-muted-foreground">Manage parent & athlete reviews across the site</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {testimonials.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center">
          <Quote size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No testimonials yet. Add your first review above.</p>
        </div>
      ) : (
        <div className="bg-card border border-border divide-y divide-border">
          {testimonials.map((t) => (
            <div key={t.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-primary">{t.author_initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground italic line-clamp-2">"{t.quote}"</p>
                  <p className="text-[10px] font-bold text-foreground mt-1">
                    {t.author_name} <span className="font-normal text-muted-foreground">· {t.author_role} · {t.page}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] font-bold uppercase ${t.is_active ? "text-primary" : "text-muted-foreground"}`}>
                    {t.is_active ? "Active" : "Hidden"}
                  </span>
                  <button onClick={() => setEditing(t)} className="text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                  <button
                    onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(t.id); }}
                    className="text-muted-foreground hover:text-destructive"
                  ><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTestimonials;
